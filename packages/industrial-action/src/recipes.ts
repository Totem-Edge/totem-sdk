/**
 * RFC-011 §4.4 — action composition (recipes / workflows / sagas).
 *
 * Real operations are multi-step. A recipe is a DAG of industrial action steps
 * executed through the governed runtime (each step gets its own authorization,
 * reservation, and receipt). On failure, completed steps are compensated in
 * reverse dependency order (saga).
 */

import type { Condition } from './types.js';
import type { ActionOutcome, IndustrialExecutionResult } from './edge-adapter.js';
import { ActionDefinitionError } from './errors.js';
import { evaluateConditions } from './condition.js';

export interface ActionStep {
  id: string;
  /** Industrial action kind (registered with the edge action registry). */
  definition: string;
  params?: Record<string, unknown>;
  /** Step ids that must complete before this step starts. */
  dependsOn?: string[];
  /** Conditional inclusion: skipped when any condition fails. */
  when?: Condition[];
  /** Compensating step (saga rollback) run if a later step fails. */
  compensation?: ActionStep;
}

export interface ActionRecipe {
  id: string;
  version: number;
  steps: ActionStep[];
  /** Max steps in flight; default 1 (sequential). */
  concurrency?: number;
}

export type RecipeStepStatus = ActionOutcome | 'skipped' | 'compensated';

export interface CompensationResult {
  stepId: string;
  outcome: ActionOutcome;
  result: IndustrialExecutionResult;
}

export interface RecipeStepResult {
  stepId: string;
  status: RecipeStepStatus;
  outcome?: ActionOutcome;
  error?: string;
  result?: IndustrialExecutionResult;
  compensation?: CompensationResult;
}

export interface RecipeResult {
  recipeId: string;
  version: number;
  ok: boolean;
  steps: RecipeStepResult[];
  /** True when a failure triggered at least one compensation step. */
  compensated: boolean;
}

export interface RecipeRunOptions {
  /** Shared context passed to `when` condition evaluation. */
  context?: Record<string, unknown>;
  /** Execute one step (typically via the governed edge runtime). */
  execute: (step: ActionStep) => Promise<IndustrialExecutionResult>;
  /** Override `when` evaluation (default: `evaluateConditions`). */
  evaluateWhen?: (step: ActionStep, context: Record<string, unknown>) => boolean;
  /** Override the recipe concurrency. */
  concurrency?: number;
}

/** Kahn topological sort; throws on cycles or unknown dependencies. */
function orderSteps(steps: ActionStep[]): ActionStep[] {
  const byId = new Map<string, ActionStep>();
  for (const step of steps) {
    if (byId.has(step.id)) throw new ActionDefinitionError(`duplicate recipe step '${step.id}'`);
    byId.set(step.id, step);
  }
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!byId.has(dep)) {
        throw new ActionDefinitionError(`step '${step.id}' depends on unknown step '${dep}'`);
      }
    }
  }

  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const step of steps) {
    indegree.set(step.id, (step.dependsOn ?? []).length);
    for (const dep of step.dependsOn ?? []) {
      dependents.set(dep, [...(dependents.get(dep) ?? []), step.id]);
    }
  }

  const queue = steps.filter((s) => (indegree.get(s.id) ?? 0) === 0);
  const ordered: ActionStep[] = [];
  while (queue.length > 0) {
    const step = queue.shift()!;
    ordered.push(step);
    for (const next of dependents.get(step.id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(byId.get(next)!);
    }
  }
  if (ordered.length !== steps.length) {
    throw new ActionDefinitionError('recipe contains a dependency cycle');
  }
  return ordered;
}

export async function executeRecipe(
  recipe: ActionRecipe,
  options: RecipeRunOptions,
): Promise<RecipeResult> {
  const order = orderSteps(recipe.steps);
  const context = options.context ?? {};
  const concurrency = Math.max(1, options.concurrency ?? recipe.concurrency ?? 1);

  const state = new Map<string, RecipeStepResult>();
  const done = new Set<string>();
  let failed = false;

  const shouldInclude = (step: ActionStep): boolean => {
    if (options.evaluateWhen) return options.evaluateWhen(step, context);
    if (!step.when || step.when.length === 0) return true;
    return evaluateConditions(step.when, step.params ?? {}, context).passed;
  };

  while (!failed) {
    const ready = order.filter(
      (s) => !done.has(s.id) && (s.dependsOn ?? []).every((dep) => done.has(dep)),
    );
    if (ready.length === 0) break;
    const batch = ready.slice(0, concurrency);

    const outcomes = await Promise.all(
      batch.map(async (step) => {
        if (!shouldInclude(step)) return { step, skipped: true as const };
        const result = await options.execute(step);
        return { step, skipped: false as const, result };
      }),
    );

    for (const outcome of outcomes) {
      done.add(outcome.step.id);
      if (outcome.skipped) {
        state.set(outcome.step.id, { stepId: outcome.step.id, status: 'skipped' });
        continue;
      }
      const r = outcome.result;
      state.set(outcome.step.id, {
        stepId: outcome.step.id,
        status: r.outcome,
        outcome: r.outcome,
        ...(r.error !== undefined ? { error: r.error } : {}),
        result: r,
      });
      if (r.outcome !== 'confirmed') failed = true;
    }
  }

  // Saga: compensate confirmed steps in reverse dependency order.
  let compensated = false;
  if (failed) {
    for (const step of [...order].reverse()) {
      const result = state.get(step.id);
      if (!result || result.status !== 'confirmed' || !step.compensation) continue;
      const compResult = await options.execute(step.compensation);
      compensated = true;
      state.set(step.id, {
        ...result,
        compensation: { stepId: step.compensation.id, outcome: compResult.outcome, result: compResult },
      });
    }
  }

  const steps = order.map((s) => state.get(s.id)).filter((s): s is RecipeStepResult => s !== undefined);
  const ok = !failed && steps.every((s) => s.status === 'confirmed' || s.status === 'skipped');
  return { recipeId: recipe.id, version: recipe.version, ok, steps, compensated };
}

export function createRecipe(recipe: ActionRecipe): ActionRecipe {
  return recipe;
}

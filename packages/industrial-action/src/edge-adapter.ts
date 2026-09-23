/**
 * RFC-010 — industrial action definitions on the governed edge runtime.
 *
 * `@totemsdk/edge` already owns the governed execution path
 * (`AgentEdgeRuntime.executeAction`: ungrantable deny → resolve → capability →
 * prepare → deriveEffects → `GrantBoundAutonomyPolicy.authorizeAndReserve` →
 * execute → commit/abort, with `requires_human` escalation). This module lets an
 * industrial definition plug into that registry instead of re-implementing a
 * parallel lifecycle.
 *
 * The adapter's `prepare` performs, in order and before any port is touched:
 * schema validation → guardrail evaluation → device-op construction →
 * commitment + deterministic operation id. `execute` wraps the device actuation
 * in the industrial execution policy (timeout, bounded retry, rollback).
 */

import type {
  EdgeActionDefinition,
  EdgeActionEffect,
  EdgeActionInput,
  EdgeCapability,
  EdgeOperationResult,
} from '@totemsdk/edge';
import type { StepEffects } from '@totemsdk/agent-policy';

import type { ActionError, ActionSchema, Condition } from './types.js';
import { ActionConditionError } from './errors.js';
import { assertValidParameters, assertValidContext } from './definition.js';
import { evaluateConditions } from './condition.js';
import { computeCommitmentHash, computeOperationId } from './ids.js';

/** Adapter-prepared device command (before commitment/identity are attached). */
export interface DeviceOpBase {
  /** Target resource (RFC-011 formalizes the full `ResourceId`). */
  resourceId?: string;
  /** Opaque, adapter-specific prepared command. */
  command?: unknown;
}

/** A fully prepared, commitment-bound device operation. */
export interface PreparedDeviceOp extends DeviceOpBase {
  kind: string;
  parameters: Record<string, unknown>;
  context: Record<string, unknown>;
  commitmentHash: string;
  operationId: string;
}

/**
 * Industrial execution policy (RFC-010 §6.5).
 *
 * Retries are opt-in and must only be enabled for idempotent device operations;
 * a timeout is never treated as success.
 */
export interface ExecutionPolicy {
  /** Actuation timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
  /** Total attempts (1 = no retry). Default 1. */
  maxAttempts?: number;
  /** Linear backoff base in milliseconds between attempts. Default 0. */
  backoffMs?: number;
  /** Whether a failed attempt is retryable. Default: timeout/transport only. */
  retryable?: (error: ActionError) => boolean;
  /** Compensating action run after a terminal failure (saga hook). */
  rollback?: (op: PreparedDeviceOp, error: ActionError) => Promise<void>;
}

/**
 * An industrial action definition that compiles to an edge
 * `EdgeActionDefinition` via {@link toEdgeActionDefinition}.
 */
export interface IndustrialActionDefinition<TResult = unknown> {
  kind: string;
  description: string;
  /** Parameter + context schema, validated before authorization. */
  schema: ActionSchema;
  /** Runtime capability the action requires (support check, not authorization). */
  capability: EdgeCapability;
  /** Effect class — device writes are `'write'`. */
  effect: EdgeActionEffect;
  /** Pre-execution guardrails evaluated before authorization. */
  guardrails?: Condition[];
  /** Timeout / retry / rollback policy. */
  policy?: ExecutionPolicy;
  /** Build the real device operation from validated inputs. */
  prepare(params: Record<string, unknown>, context: Record<string, unknown>): Promise<DeviceOpBase>;
  /** Canonical safety facts derived from the PREPARED operation. */
  deriveEffects(op: PreparedDeviceOp): StepEffects;
  /** Actuate the device through the edge port. */
  actuate(op: PreparedDeviceOp): Promise<EdgeOperationResult<TResult>>;
}

const EMPTY_SCHEMA: ActionSchema = { parameters: [], context: [] };

/** Compile an industrial definition into an edge action definition. */
export function toEdgeActionDefinition<TResult = unknown>(
  def: IndustrialActionDefinition<TResult>,
  now: () => number = () => Date.now(),
): EdgeActionDefinition {
  return {
    capability: def.capability,
    effect: def.effect,

    async prepare(input: EdgeActionInput): Promise<PreparedDeviceOp> {
      const params = (input.payload ?? {}) as Record<string, unknown>;
      const context = (input.context ?? {}) as Record<string, unknown>;

      assertValidParameters(def.schema, params);
      assertValidContext(def.schema, context, now());

      const guard = evaluateConditions(def.guardrails ?? [], params, context);
      if (!guard.passed) {
        const reason = guard.failed.map((f) => f.reason).join('; ');
        throw new ActionConditionError(`guardrails failed: ${reason}`);
      }

      const base = await def.prepare(params, context);
      const commitmentHash = computeCommitmentHash({
        kind: def.kind,
        parameters: params,
        context,
      });
      const operationId = computeOperationId(commitmentHash, base.resourceId);

      return { ...base, kind: def.kind, parameters: params, context, commitmentHash, operationId };
    },

    deriveEffects(prepared: unknown): StepEffects {
      return def.deriveEffects(prepared as PreparedDeviceOp);
    },

    async execute(prepared: unknown): Promise<EdgeOperationResult> {
      return runWithPolicy(def, prepared as PreparedDeviceOp);
    },
  };
}

/**
 * Run an industrial definition's actuation under its execution policy.
 * Exported for direct use in tests and by adapters that own their own runtime.
 */
export async function runWithPolicy<TResult = unknown>(
  def: IndustrialActionDefinition<TResult>,
  op: PreparedDeviceOp,
): Promise<EdgeOperationResult<TResult>> {
  const policy = def.policy ?? {};
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 1);
  const timeoutMs = policy.timeoutMs ?? 30_000;
  const retryable = policy.retryable ?? defaultRetryable;

  let last: EdgeOperationResult<TResult> = {
    ok: false,
    error: 'actuation was not attempted',
    errorCode: 'NOT_ATTEMPTED',
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await withTimeout(() => def.actuate(op), timeoutMs);
    if (last.ok) return last;
    if (attempt >= maxAttempts || !retryable(toActionError(last))) break;
    if (policy.backoffMs) await sleep(policy.backoffMs * attempt);
  }

  if (!last.ok && policy.rollback) {
    try {
      await policy.rollback(op, toActionError(last));
    } catch {
      // Rollback failures are surfaced by the caller's event/receipt layer.
    }
  }

  return last;
}

function defaultRetryable(error: ActionError): boolean {
  return (
    error.code === 'EXECUTION_TIMEOUT' ||
    error.code === 'TRANSPORT_ERROR' ||
    error.code === 'ECONNRESET'
  );
}

function toActionError(result: EdgeOperationResult<unknown>): ActionError {
  return {
    code: result.errorCode ?? 'EXECUTION_FAILED',
    message: result.error ?? 'execution returned failure',
  };
}

async function withTimeout<TResult>(
  fn: () => Promise<EdgeOperationResult<TResult>>,
  timeoutMs: number,
): Promise<EdgeOperationResult<TResult>> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return fn();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<EdgeOperationResult<TResult>>((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              ok: false,
              error: `actuation timed out after ${timeoutMs}ms`,
              errorCode: 'EXECUTION_TIMEOUT',
            }),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { EMPTY_SCHEMA };

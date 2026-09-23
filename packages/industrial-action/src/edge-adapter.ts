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
 * commitment (bound to the authorizing mandate proof) + deterministic operation
 * id. `execute` wraps the device actuation in the industrial execution policy
 * (declared failure mode, timeout, bounded retry, rollback) and, when a durable
 * operation store is supplied, gives the actuation an at-most-once guarantee.
 */

import type {
  EdgeActionDefinition,
  EdgeActionEffect,
  EdgeActionInput,
  EdgeCapability,
  EdgeOperationResult,
  EdgeReceipt,
} from '@totemsdk/edge';
import type { StepEffects } from '@totemsdk/agent-policy';

import type { ActionError, ActionSchema, Condition } from './types.js';
import { ActionConditionError, ActionDefinitionError, ActionValidationError, ActionInterlockError } from './errors.js';
import { assertValidParameters, assertValidContext } from './definition.js';
import { evaluateConditions } from './condition.js';
import { computeCommitmentHash, computeOperationId } from './ids.js';
import { createIndustrialReceipt } from './industrial-receipt.js';
import type { DeviceOperationRecord, DeviceOperationStore } from './operation-store.js';
import type { InterlockRegistry } from './interlocks.js';
import type { ResourceId, ResourceProtocol } from './resources.js';
import type { DeviceErrorTaxonomy } from './error-taxonomy.js';
import { defaultUnitRegistry, type UnitRegistry } from './units.js';
import { computeSchemaHash, definitionVersion } from './versioning.js';
import type { ActionEventSink } from './events.js';

/**
 * How an action behaves when an attempt does not confirm (RFC-011 §4.11).
 * Mandatory for `write`-effect actions; `read` defaults to `fail-silent`.
 */
export type FailureMode =
  | 'fail-safe'
  | 'fail-silent'
  | 'fail-closed'
  | 'fail-operational'
  | 'abort';

/** Terminal outcome of a governed actuation (never a bare boolean). */
export type ActionOutcome =
  | 'confirmed'
  | 'failed'
  | 'unknown'
  | 'aborted'
  | 'safe-stated'
  | 'suppressed'
  | 'requires-reset';

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
  /** Definition version the operation was prepared against (RFC-011 §4.5). */
  definitionVersion: number;
  /** Canonical schema hash (RFC-011 §4.5). */
  schemaHash: string;
  parameters: Record<string, unknown>;
  context: Record<string, unknown>;
  commitmentHash: string;
  operationId: string;
  /** Bound authorizing mandate proof, when supplied (RFC-010 §6.4). */
  mandateProofId?: string;
  /** Industrial proposal id, when supplied. */
  proposalId?: string;
}

/**
 * Industrial execution policy (RFC-010 §6.5).
 *
 * Retries are opt-in and must only be enabled for idempotent device operations;
 * a timeout is never treated as success.
 */
export interface ExecutionPolicy {
  /** Failure semantics (RFC-011 §4.11). Mandatory for `write` actions. */
  failureMode?: FailureMode;
  /** Actuation timeout in milliseconds. Default 30_000. */
  timeoutMs?: number;
  /** Total attempts (1 = no retry). Default 1. */
  maxAttempts?: number;
  /** Linear backoff base in milliseconds between attempts. Default 0. */
  backoffMs?: number;
  /** Whether a failed attempt is retryable. Default: timeout/transport only. */
  retryable?: (error: ActionError) => boolean;
  /** Behaviour when a durable record already exists for the operation. Default `fail`. */
  onInFlight?: 'fail' | 'return-existing';
  /** Compensating action run after a terminal failure (saga hook). */
  rollback?: (op: PreparedDeviceOp, error: ActionError) => Promise<void>;
}

/** Industrial execution result — `EdgeOperationResult` plus the outcome model. */
export interface IndustrialExecutionResult<TResult = unknown> extends EdgeOperationResult<TResult> {
  outcome: ActionOutcome;
  failureMode: FailureMode;
  attempts: number;
  safeStateApplied?: boolean;
  /** True when the result was served from an existing durable record (dedup). */
  deduplicated?: boolean;
  /** Authority-bound evidence (RFC-010 §6.7). */
  receipt?: EdgeReceipt;
}

/**
 * An industrial action definition that compiles to an edge
 * `EdgeActionDefinition` via {@link toEdgeActionDefinition}.
 */
export interface IndustrialActionDefinition<TResult = unknown> {
  kind: string;
  description: string;
  /** Monotonic definition version (default 1; RFC-011 §4.5). */
  version?: number;
  /** Parameter + context schema, validated before authorization. */
  schema: ActionSchema;
  /** Runtime capability the action requires (support check, not authorization). */
  capability: EdgeCapability;
  /** Effect class — device writes are `'write'`. */
  effect: EdgeActionEffect;
  /** Pre-execution guardrails evaluated before authorization. */
  guardrails?: Condition[];
  /** Field protocol (error classification / wire units; RFC-011 §4.7). */
  protocol?: ResourceProtocol;
  /** Device error taxonomy for retry/safety classification (RFC-011 §4.7). */
  errorTaxonomy?: DeviceErrorTaxonomy;
  /** Timeout / retry / rollback / failure-mode policy. */
  policy?: ExecutionPolicy;
  /** Command the resource's safe state (required for `fail-safe`). */
  safeState?: (op: PreparedDeviceOp) => Promise<EdgeOperationResult>;
  /** Fallback/redundant path used by `fail-operational`. */
  fallback?: (op: PreparedDeviceOp) => Promise<EdgeOperationResult<TResult>>;
  /** Build the real device operation from validated inputs. */
  prepare(params: Record<string, unknown>, context: Record<string, unknown>): Promise<DeviceOpBase>;
  /** Canonical safety facts derived from the PREPARED operation. */
  deriveEffects(op: PreparedDeviceOp): StepEffects;
  /** Actuate the device through the edge port. */
  actuate(op: PreparedDeviceOp): Promise<EdgeOperationResult<TResult>>;
}

export interface ToEdgeActionOptions {
  /** Injectable clock (defaults to `Date.now`). */
  now?: () => number;
  /** Durable operation store enabling at-most-once actuation (RFC-010 §6.6). */
  operationStore?: DeviceOperationStore;
  /** Unit registry for quantity validation (RFC-011 §4.1). Defaults to the built-in units. */
  units?: UnitRegistry;
  /** Interlocks evaluated before authorization (RFC-011 §4.3). */
  interlocks?: InterlockRegistry;
  /** Resolve the target resource so resource-scoped interlocks apply. */
  resolveResourceId?: (params: Record<string, unknown>, context: Record<string, unknown>) => ResourceId | undefined;
  /** Expected definition version/schema hash; a mismatch fails closed (RFC-011 §4.5). */
  expectedVersion?: number;
  expectedSchemaHash?: string;
  /** Lifecycle event stream (RFC-011 §4.6). */
  events?: ActionEventSink;
}

/** Effective failure mode: explicit, else `fail-silent` for reads. */
function effectiveFailureMode(def: IndustrialActionDefinition): FailureMode | undefined {
  return def.policy?.failureMode ?? (def.effect === 'read' ? 'fail-silent' : undefined);
}

/** Compile an industrial definition into an edge action definition. */
export function toEdgeActionDefinition<TResult = unknown>(
  def: IndustrialActionDefinition<TResult>,
  options: ToEdgeActionOptions = {},
): EdgeActionDefinition {
  const now = options.now ?? (() => Date.now());
  const store = options.operationStore;
  const units = options.units ?? defaultUnitRegistry();
  const events = options.events;

  // Version binding (RFC-011 §4.5): fail closed when the resolved definition no
  // longer matches the version/hash a proposal was bound to.
  const version = definitionVersion(def);
  const schemaHash = computeSchemaHash(def.schema);
  if (options.expectedVersion !== undefined && options.expectedVersion !== version) {
    throw new ActionDefinitionError(
      `definition '${def.kind}' version ${version} does not match expected ${options.expectedVersion}`,
    );
  }
  if (options.expectedSchemaHash !== undefined && options.expectedSchemaHash !== schemaHash) {
    throw new ActionDefinitionError(
      `definition '${def.kind}' schema hash does not match the expected schema`,
    );
  }

  // Registration-time validation (RFC-011 §4.11): writes must declare how they
  // fail; `fail-safe` must be able to command a safe state.
  const mode = effectiveFailureMode(def);
  if (def.effect === 'write' && mode === undefined) {
    throw new ActionDefinitionError(
      `write action '${def.kind}' must declare policy.failureMode`,
    );
  }
  if (mode === 'fail-safe' && !def.safeState) {
    throw new ActionDefinitionError(
      `action '${def.kind}' uses fail-safe but declares no safeState`,
    );
  }

  return {
    capability: def.capability,
    effect: def.effect,

    async prepare(input: EdgeActionInput): Promise<PreparedDeviceOp> {
      const params = (input.payload ?? {}) as Record<string, unknown>;
      const context = (input.context ?? {}) as Record<string, unknown>;

      // Temporal deadline (RFC-010 §6.8): evaluated against the adapter clock.
      if (input.deadlineAt !== undefined && now() > input.deadlineAt) {
        throw new ActionValidationError('action deadline has passed');
      }

      assertValidParameters(def.schema, params, units);
      assertValidContext(def.schema, context, now());
      await events?.emit({ type: 'validated', at: now(), detail: { kind: def.kind }, ...(input.proposalId !== undefined ? { proposalId: input.proposalId } : {}) });

      const guard = evaluateConditions(def.guardrails ?? [], params, context);
      if (!guard.passed) {
        const reason = guard.failed.map((f) => f.reason).join('; ');
        throw new ActionConditionError(`guardrails failed: ${reason}`);
      }
      await events?.emit({ type: 'guardrails_passed', at: now(), detail: { kind: def.kind }, ...(input.proposalId !== undefined ? { proposalId: input.proposalId } : {}) });

      // Interlocks (RFC-011 §4.3): fail closed before authorization/actuation.
      if (options.interlocks) {
        const resourceId = options.resolveResourceId?.(params, context);
        const failures = await options.interlocks.evaluate({
          parameters: params,
          context,
          now: now(),
          ...(resourceId !== undefined ? { resourceId } : {}),
        });
        if (failures.length > 0) {
          throw new ActionInterlockError(
            `interlocks failed: ${failures.map((f) => `${f.interlockId}: ${f.reason}`).join('; ')}`,
            failures.map((f) => ({ interlockId: f.interlockId, reason: f.reason })),
          );
        }
      }
      await events?.emit({ type: 'interlocks_passed', at: now(), detail: { kind: def.kind }, ...(input.proposalId !== undefined ? { proposalId: input.proposalId } : {}) });

      const base = await def.prepare(params, context);
      const commitmentHash = computeCommitmentHash({
        kind: def.kind,
        parameters: params,
        context,
        ...(input.mandateProofId !== undefined ? { mandateProofId: input.mandateProofId } : {}),
      });
      const operationId = computeOperationId(commitmentHash, base.resourceId);

      return {
        ...base,
        kind: def.kind,
        definitionVersion: version,
        schemaHash,
        parameters: params,
        context,
        commitmentHash,
        operationId,
        ...(input.mandateProofId !== undefined ? { mandateProofId: input.mandateProofId } : {}),
        ...(input.proposalId !== undefined ? { proposalId: input.proposalId } : {}),
      };
    },

    deriveEffects(prepared: unknown): StepEffects {
      return def.deriveEffects(prepared as PreparedDeviceOp);
    },

    async execute(prepared: unknown): Promise<IndustrialExecutionResult> {
      const op = prepared as PreparedDeviceOp;
      const startedAt = now();

      const run = async (): Promise<IndustrialExecutionResult> => {
        const base = { operationId: op.operationId, ...(op.proposalId !== undefined ? { proposalId: op.proposalId } : {}) };
        await events?.emit({ type: 'actuation_started', at: now(), ...base });
        const result = await runWithPolicy(def, op);
        await events?.emit({
          type: result.outcome === 'confirmed' ? 'actuation_succeeded' : 'actuation_failed',
          at: now(),
          outcome: result.outcome,
          attempts: result.attempts,
          ...base,
        });
        await events?.emit({ type: 'settled', at: now(), outcome: result.outcome, ...base });
        return result;
      };

      if (!store) {
        const result = await run();
        return { ...result, receipt: createIndustrialReceipt(op, result, { startedAt, completedAt: now() }) };
      }

      const claim = await store.claimOperation(op.operationId, op.proposalId, now());
      if (!claim.claimed) {
        const existing = resolveExisting(def, claim.record);
        return { ...existing, receipt: createIndustrialReceipt(op, existing, { startedAt, completedAt: now() }) };
      }

      const result = await run();
      const next: DeviceOperationRecord = {
        operationId: op.operationId,
        ...(op.proposalId !== undefined ? { proposalId: op.proposalId } : {}),
        status: result.outcome,
        attempts: result.attempts,
        outcome: result.outcome,
        updatedAt: now(),
        ...(result.data !== undefined ? { result: result.data } : {}),
      };
      await store.transitionOperation(next);
      return { ...result, receipt: createIndustrialReceipt(op, result, { startedAt, completedAt: now() }) };
    },
  };
}

/** Serve a result from an existing durable record (idempotent dedup). */
function resolveExisting<TResult>(
  def: IndustrialActionDefinition<TResult>,
  record: DeviceOperationRecord,
): IndustrialExecutionResult<TResult> {
  const mode = effectiveFailureMode(def) ?? 'abort';
  if (record.status === 'in-flight') {
    const onInFlight = def.policy?.onInFlight ?? 'fail';
    return {
      ok: false,
      error: 'operation already in flight',
      errorCode: 'OPERATION_IN_FLIGHT',
      outcome: onInFlight === 'return-existing' ? 'unknown' : 'aborted',
      failureMode: mode,
      attempts: record.attempts,
      deduplicated: true,
    };
  }
  return {
    ok: record.status === 'confirmed',
    ...(record.result !== undefined ? { data: record.result as TResult } : {}),
    outcome: record.outcome ?? (record.status as ActionOutcome),
    failureMode: mode,
    attempts: record.attempts,
    deduplicated: true,
  };
}

/**
 * Run an industrial definition's actuation under its execution policy.
 * Exported for direct use in tests and by adapters that own their own runtime.
 */
export async function runWithPolicy<TResult = unknown>(
  def: IndustrialActionDefinition<TResult>,
  op: PreparedDeviceOp,
): Promise<IndustrialExecutionResult<TResult>> {
  const policy = def.policy ?? {};
  const mode = effectiveFailureMode(def) ?? 'abort';
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 1);
  const timeoutMs = policy.timeoutMs ?? 30_000;
  const retryable = policy.retryable ?? buildRetryable(def);

  let attempts = 0;
  let last: EdgeOperationResult<TResult> = {
    ok: false,
    error: 'actuation was not attempted',
    errorCode: 'NOT_ATTEMPTED',
  };

  while (attempts < maxAttempts) {
    attempts += 1;
    last = await withTimeout(() => def.actuate(op), timeoutMs);
    if (last.ok) {
      return { ...last, outcome: 'confirmed', failureMode: mode, attempts };
    }
    if (attempts >= maxAttempts || !retryable(toActionError(last))) break;
    if (policy.backoffMs) await sleep(policy.backoffMs * attempts);
  }

  const error = toActionError(last);

  if (policy.rollback) {
    try {
      await policy.rollback(op, error);
    } catch {
      // Rollback failures are surfaced by the caller's event/receipt layer.
    }
  }

  // Safety-class errors never retry and require a safe state (RFC-011 §4.7/§4.11).
  const classification = def.errorTaxonomy?.classify(def.protocol, error.code);
  if (classification?.class === 'safety') {
    return applySafetyStop(def, op, error, mode, attempts);
  }

  return applyFailureMode(def, op, mode, error, attempts);
}

/** A taxonomy-aware retry predicate, or the transport-default one. */
function buildRetryable<TResult>(def: IndustrialActionDefinition<TResult>): (error: ActionError) => boolean {
  const taxonomy = def.errorTaxonomy;
  if (!taxonomy) return defaultRetryable;
  return (error) => taxonomy.classify(def.protocol, error.code).retryable;
}

async function applySafetyStop<TResult>(
  def: IndustrialActionDefinition<TResult>,
  op: PreparedDeviceOp,
  error: ActionError,
  mode: FailureMode,
  attempts: number,
): Promise<IndustrialExecutionResult<TResult>> {
  let applied = false;
  if (def.safeState) {
    try {
      await def.safeState(op);
      applied = true;
    } catch {
      // Safe-state command failed — require operator reset.
    }
  }
  return {
    ok: false,
    error: error.message,
    errorCode: error.code,
    outcome: applied ? 'safe-stated' : 'requires-reset',
    failureMode: mode,
    attempts,
    safeStateApplied: applied,
  };
}

async function applyFailureMode<TResult>(
  def: IndustrialActionDefinition<TResult>,
  op: PreparedDeviceOp,
  mode: FailureMode,
  error: ActionError,
  attempts: number,
): Promise<IndustrialExecutionResult<TResult>> {
  const failure = (outcome: ActionOutcome): IndustrialExecutionResult<TResult> => ({
    ok: false,
    error: error.message,
    errorCode: error.code,
    outcome,
    failureMode: mode,
    attempts,
  });

  switch (mode) {
    case 'abort':
      return failure('aborted');
    case 'fail-silent':
      return failure('suppressed');
    case 'fail-closed':
      return failure('requires-reset');
    case 'fail-safe': {
      let applied = false;
      if (def.safeState) {
        try {
          await def.safeState(op);
          applied = true;
        } catch {
          // Safe-state command failed — surface as failed, not safe-stated.
        }
      }
      return { ...failure(applied ? 'safe-stated' : 'failed'), safeStateApplied: applied };
    }
    case 'fail-operational': {
      if (def.fallback) {
        const result = await def.fallback(op);
        return {
          ...result,
          outcome: result.ok ? 'confirmed' : 'failed',
          failureMode: mode,
          attempts,
        };
      }
      return failure('failed');
    }
  }
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

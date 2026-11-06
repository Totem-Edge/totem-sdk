/**
 * edge/agent-runtime.ts — Governed agent-facing Edge runtime facade.
 *
 * The agent receives ONLY this facade. It exposes a single entry point —
 * `executeAction` — and never the raw ports. Every action flows through the
 * universal action registry:
 *
 *   resolve action
 *   → check runtime capability
 *   → prepare/simulate
 *   → derive actual effects
 *   → evaluate mandate and local bounds (GrantBoundAutonomyPolicy)
 *   → reserve usage
 *   → execute through private port
 *   → commit or abort
 *
 * Ungrantable activities (seed export, raw signing, key-lease ops, policy
 * replacement, raw port handles, identity-root rotation) are rejected before
 * any port is touched.
 */

import type { EdgeActionRegistry } from './action-registry.js';
import { isUngrantableAction } from './action-registry.js';
import type { EdgeCapabilitySet } from './capabilities.js';
import { hasCapability } from './capabilities.js';
import type { EdgeActionInput, EdgeExecutionResult } from './action-registry.js';
import type { EdgeActionResult } from './types.js';
import { computeSettlementId } from '@totemsdk/agent-policy/settlement';
import type {
  ActualConsumptionV1,
  CanonicalAgentAction,
  DispatchState,
  GrantBoundAutonomyPolicy,
  NonterminalPhase,
  SettlementDisposition,
  SettlementInstructionV1,
  TerminalOutcome,
} from '@totemsdk/agent-policy';

export interface AgentEdgeRuntimeOptions {
  deviceId: string;
  capabilities: EdgeCapabilitySet;
  registry: EdgeActionRegistry;
  /** Run-level autonomy policy — the authorization engine. */
  policy: GrantBoundAutonomyPolicy;
  runId: string;
  principal: string;
  agentId: string;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
}

export interface AgentEdgeRuntime {
  readonly version: number;
  readonly deviceId: string;
  /** Execute a single governed action. The agent has no other entry point. */
  executeAction(input: EdgeActionInput): Promise<EdgeActionResult>;
}

function preparedDigestOf(prepared: unknown): string | undefined {
  if (!prepared || typeof prepared !== 'object') return undefined;
  const value = prepared as { preparedCommandHash?: unknown; preparedCommandDigest?: unknown };
  if (typeof value.preparedCommandHash === 'string') return value.preparedCommandHash;
  if (typeof value.preparedCommandDigest === 'string') return value.preparedCommandDigest;
  return undefined;
}

function operationIdOf(prepared: unknown): string | undefined {
  if (!prepared || typeof prepared !== 'object') return undefined;
  const value = prepared as { operationId?: unknown; id?: unknown };
  if (typeof value.operationId === 'string') return value.operationId;
  if (typeof value.id === 'string') return value.id;
  return undefined;
}

export function createAgentEdgeRuntime(options: AgentEdgeRuntimeOptions): AgentEdgeRuntime {
  const { deviceId, capabilities, registry, policy, runId, principal, agentId } = options;
  const now = options.now ?? (() => Date.now());

  async function executeAction(input: EdgeActionInput): Promise<EdgeActionResult> {
    const { action, subject, payload, context } = input;

    // 0. Ungrantable activities are rejected before any port is touched.
    //    This is a hard deny — even if a matching port or action definition
    //    exists, the agent can never invoke these directly.
    if (isUngrantableAction(action)) {
      return {
        ok: false,
        action,
        error: `action '${action}' is ungrantable — the agent can never invoke it directly`,
        errorCode: 'UNGRANTABLE_ACTION',
      };
    }

    // 1. Resolve the action definition.
    const def = registry.resolve(action);
    if (!def) {
      return { ok: false, action, error: `Unknown action: ${action}`, errorCode: 'UNKNOWN_ACTION' };
    }

    // 2. Check runtime capability (support check — not authorization).
    if (!hasCapability(capabilities, def.capability)) {
      return {
        ok: false,
        action,
        error: `Capability not available: ${def.capability}`,
        errorCode: 'CAPABILITY_MISSING',
      };
    }

    // 3. Prepare/simulate the real operation.
    let prepared: unknown;
    try {
      prepared = await def.prepare(input);
    } catch (error) {
      return { ok: false, action, error: error instanceof Error ? error.message : String(error), errorCode: 'PREPARE_FAILED' };
    }

    // 4. Derive canonical security facts from the prepared operation.
    const effects = def.deriveEffects(prepared);

    // 5. Authorize + reserve atomically (mandate usage + run budgets + nonce).
    // RFC-019 P1-3: a caller-supplied idempotency key yields a stable step id +
    // nonce, so a retry maps to the same logical operation and is rejected as a
    // duplicate rather than reserving/paying twice.
    const idempotencyKey = input.idempotencyKey;
    const stepId = idempotencyKey ? `${action}:${idempotencyKey}` : `${action}:${now()}`;
    const nonce = idempotencyKey ? `${runId}:${action}:${idempotencyKey}` : `${runId}:${stepId}:${now()}`;
    const canonical: CanonicalAgentAction = {
      action,
      principal,
      agent: agentId,
      target: subject,
      effects,
      runId,
      stepId,
      nonce,
    };

    const authorization = await policy.authorizeAndReserve({
      runId,
      stepId,
      nonce,
      action: canonical,
      evidence: {
        simulation: context?.simulation,
        quoteTimestamp: context?.quoteTimestamp as number | undefined,
        executionReceipt: context?.executionReceipt,
        postconditionsVerified: context?.postconditionsVerified as boolean | undefined,
        // RFC-017: record the semantic decision reference as inert evidence.
        decisionRef: input.decisionRef,
      },
    });

    if (authorization.outcome !== 'approved') {
      const idempotentReplay = /nonce .*already used/i.test(authorization.reason ?? '');
      return {
        ok: false,
        action,
        error: authorization.reason,
        errorCode: idempotentReplay
          ? 'IDEMPOTENT_REPLAY'
          : authorization.outcome === 'requires_human'
            ? 'REQUIRES_HUMAN'
            : 'POLICY_REJECTED',
        policyResult: {
          allowed: false,
          reason: authorization.reason,
          suggestedGrant: authorization.suggestedGrant,
        },
      };
    }

    const reservationId = authorization.reservationId;

    // 6. Execute through the private port. Settlement is decided by the
    //    lifecycle facts, never by `ok` alone (RFC-022 Amendment A).
    try {
      const result = await def.execute(prepared);
      const dispatchState: DispatchState = result.dispatchState
        ?? (def.executionMode === 'asynchronous'
          ? 'unknown'
          : result.ok ? 'dispatched' : 'not-dispatched');
      const phase = result.phase;
      const terminalOutcome = result.terminalOutcome;

      const settled = await settleResult({
        result,
        dispatchState,
        phase,
        terminalOutcome,
        reservationId: reservationId,
        stepId,
        prepared,
      });
      if (settled) return settled;

      // A non-terminal accepted/running/reconciling operation keeps the
      // reservation held. `ok: true` means the request was handled, not that
      // the physical operation completed.
      return {
        ok: true,
        action,
        data: result.data,
        dispatchState,
        ...(phase !== undefined ? { phase } : {}),
        ...(terminalOutcome !== undefined ? { terminalOutcome } : {}),
        ...(result.operationId !== undefined ? { operationId: result.operationId } : {}),
        reservationId: reservationId,
        ...(result.settlementId !== undefined ? { settlementId: result.settlementId } : {}),
        policyResult: { allowed: true, reason: 'reservation held for reconciliation' },
      };
    } catch (error) {
      // 7. Classify the failure. Definitions with genuinely ambiguous dispatch
      //    (e.g. commerce after payment) override `classifyFailure` to return
      //    `'unknown'`, which HELDS the reservation. Async actions default to
      //    `'unknown'`; only an explicitly synchronous definition defaults to
      //    the historic release-on-failure behaviour.
      const outcome = def.classifyFailure?.(error, prepared)
        ?? (def.executionMode === 'asynchronous' ? 'unknown' : 'definitely-not-executed');
      if (outcome === 'definitely-not-executed') {
        await policy.abort(reservationId, error);
        return { ok: false, action, error: error instanceof Error ? error.message : String(error), errorCode: 'EXECUTION_FAILED' };
      }
      return {
        ok: false,
        action,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'EXECUTION_UNCERTAIN',
        dispatchState: 'unknown',
        reservationId: reservationId,
        policyResult: { allowed: true, reason: 'reservation held for reconciliation' },
      };
    }

    /**
     * Settle a terminal result or return `undefined` when the operation is
     * non-terminal and must remain held.
     */
    async function settleResult(input: {
      result: EdgeExecutionResult;
      dispatchState: DispatchState;
      phase?: NonterminalPhase;
      terminalOutcome?: TerminalOutcome;
      reservationId: string;
      stepId: string;
      prepared: unknown;
    }): Promise<EdgeActionResult | undefined> {
      const { result, dispatchState, phase, terminalOutcome, reservationId, stepId, prepared: preparedOp } = input;

      // An explicitly unknown dispatch/outcome is a held, non-terminal result.
      if (terminalOutcome === 'unknown' || dispatchState === 'unknown') {
        return {
          ok: false,
          action,
          error: result.error ?? 'execution outcome unknown',
          errorCode: 'EXECUTION_UNCERTAIN',
          dispatchState: 'unknown',
          ...(result.operationId !== undefined ? { operationId: result.operationId } : {}),
          reservationId,
          policyResult: { allowed: true, reason: 'reservation held for reconciliation' },
        };
      }

      // Accepted/running/cancelling/reconciling is non-terminal: hold.
      if (phase !== undefined) return undefined;

      // A dispatched failure with no terminal outcome is ambiguous; do not
      // release budget and do not claim failure.
      if (dispatchState === 'dispatched' && !result.ok && terminalOutcome === undefined) {
        return {
          ok: false,
          action,
          error: result.error ?? 'execution outcome unknown',
          errorCode: 'EXECUTION_UNCERTAIN',
          dispatchState,
          reservationId,
          policyResult: { allowed: true, reason: 'reservation held for reconciliation' },
        };
      }

      const succeeded = terminalOutcome === 'confirmed' || (terminalOutcome === undefined && result.ok);
      if (succeeded && dispatchState === 'dispatched') {
        if (result.actualConsumption) {
          const receipt = await policy.settleActual(
            buildInstruction('settle-actual', 'confirmed', result.actualConsumption, result.settlementId),
          );
          return {
            ok: true,
            action,
            data: result.data,
            dispatchState,
            terminalOutcome: 'confirmed',
            ...(result.operationId !== undefined ? { operationId: result.operationId } : {}),
            reservationId,
            settlementId: receipt.settlementId,
            actualConsumption: result.actualConsumption,
            policyResult: { allowed: true, reason: 'settled actual usage' },
          };
        }
        await policy.commit({
          reservationId,
          executionProof: result.data ?? { ok: result.ok },
        });
        return {
          ok: true,
          action,
          data: result.data,
          dispatchState,
          terminalOutcome: 'confirmed',
          ...(result.operationId !== undefined ? { operationId: result.operationId } : {}),
          reservationId,
          policyResult: { allowed: true },
        };
      }

      if (terminalOutcome === 'failed' || terminalOutcome === 'cancelled' || terminalOutcome === 'aborted') {
        if (dispatchState === 'dispatched') {
          if (result.actualConsumption) {
            const receipt = await policy.settleActual(
              buildInstruction('settle-actual', terminalOutcome, result.actualConsumption, result.settlementId),
            );
            return {
              ok: false,
              action,
              error: result.error ?? `operation ${terminalOutcome}`,
              errorCode: result.errorCode ?? 'EXECUTION_FAILED',
              dispatchState,
              terminalOutcome,
              ...(result.operationId !== undefined ? { operationId: result.operationId } : {}),
              reservationId,
              settlementId: receipt.settlementId,
              actualConsumption: result.actualConsumption,
              policyResult: { allowed: true, reason: 'settled actual usage' },
            };
          }
          // Executed but unmetered: conservatively charge the full reservation
          // rather than releasing budget that may have been consumed.
          await policy.commit({ reservationId, executionProof: result.data });
          return {
            ok: false,
            action,
            error: result.error ?? `operation ${terminalOutcome}`,
            errorCode: result.errorCode ?? 'EXECUTION_FAILED',
            dispatchState,
            terminalOutcome,
            ...(result.operationId !== undefined ? { operationId: result.operationId } : {}),
            reservationId,
            policyResult: { allowed: true, reason: 'conservative full-reservation charge' },
          };
        }
      }

      // Returned failure with no dispatch evidence, or not-dispatched terminal
      // outcome: release the reservation.
      const classified = def?.classifyResult?.(result, preparedOp);
      if (classified === 'unknown') {
        return {
          ok: false,
          action,
          error: result.error ?? 'execution outcome unknown',
          errorCode: 'EXECUTION_UNCERTAIN',
          dispatchState: 'unknown',
          reservationId,
          policyResult: { allowed: true, reason: 'reservation held for reconciliation' },
        };
      }
      await policy.abort(
        reservationId,
        result.error ?? `operation ${terminalOutcome ?? 'failed'} (not dispatched)`,
      );
      return {
        ok: false,
        action,
        error: result.error,
        errorCode: result.errorCode ?? 'EXECUTION_FAILED',
        dispatchState: dispatchState === 'not-dispatched' ? 'not-dispatched' : dispatchState,
        ...(terminalOutcome !== undefined ? { terminalOutcome } : {}),
        reservationId,
        policyResult: { allowed: true },
      };
    }

    function buildInstruction(
      disposition: SettlementDisposition,
      terminalOutcome: Exclude<TerminalOutcome, 'unknown'>,
      actual: ActualConsumptionV1 | undefined,
      settlementId: string | undefined,
    ): SettlementInstructionV1 {
      const body = {
        schema: 'totem:act:settlement/v1' as const,
        reservationId: reservationId,
        operationId: operationIdOf(prepared) ?? stepId,
        preparedCommandDigest: preparedDigestOf(prepared) ?? stepId,
        dispatchState: 'dispatched' as const,
        terminalOutcome,
        disposition,
        ...(actual !== undefined ? { actual } : {}),
        evidenceRefs: [] as string[],
      };
      return { ...body, settlementId: settlementId ?? computeSettlementId(body) };
    }
  }

  return {
    version: 1,
    deviceId,
    executeAction,
  };
}

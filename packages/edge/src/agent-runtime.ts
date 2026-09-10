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
import type { EdgeActionInput } from './action-registry.js';
import type { EdgeActionResult } from './types.js';
import type { GrantBoundAutonomyPolicy, CanonicalAgentAction } from '@totemsdk/agent-policy';

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

export function createAgentEdgeRuntime(options: AgentEdgeRuntimeOptions): AgentEdgeRuntime {
  const { deviceId, capabilities, registry, policy, runId, principal, agentId } = options;
  const now = options.now ?? (() => Date.now());

  async function executeAction(input: EdgeActionInput): Promise<EdgeActionResult> {
    const { action, subject, payload, context } = input;

    // 0. Ungrantable activities are rejected before any port is touched.
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
    const stepId = `${action}:${now()}`;
    const nonce = `${runId}:${stepId}:${now()}`;
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
      },
    });

    if (authorization.outcome !== 'approved') {
      return {
        ok: false,
        action,
        error: authorization.reason,
        errorCode: authorization.outcome === 'requires_human' ? 'REQUIRES_HUMAN' : 'POLICY_REJECTED',
        policyResult: {
          allowed: false,
          reason: authorization.reason,
          suggestedGrant: authorization.suggestedGrant,
        },
      };
    }

    // 6. Execute through the private port.
    try {
      const result = await def.execute(prepared);
      // 7. Commit the reservation (execution proof = the port result).
      await policy.commit({
        reservationId: authorization.reservationId,
        executionProof: result.data ?? { ok: result.ok },
      });
      return {
        ok: result.ok,
        action,
        data: result.data,
        error: result.error,
        errorCode: result.errorCode,
        policyResult: { allowed: true },
      };
    } catch (error) {
      // 8. Abort the reservation on failure.
      await policy.abort(authorization.reservationId, error);
      return { ok: false, action, error: error instanceof Error ? error.message : String(error), errorCode: 'EXECUTION_FAILED' };
    }
  }

  return {
    version: 1,
    deviceId,
    executeAction,
  };
}

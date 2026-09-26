/**
 * Edge runtime factory.
 */

import { EDGE_VERSION } from './constants.js';
import {
  EdgeCapabilitySet,
  EdgeCapability,
  hasCapability,
  assertCapability,
} from './capabilities.js';
import type { EdgeRuntimePorts } from './ports.js';
import type { EdgeRuntime, EdgeActionParams, EdgeActionResult } from './types.js';
import { deriveRequiredCapabilities } from '@totemsdk/decision';
import type { DecisionRequest } from '@totemsdk/decision';

export function createEdgeRuntime(opts: {
  deviceId: string;
  capabilities: EdgeCapabilitySet;
  ports: EdgeRuntimePorts;
}): EdgeRuntime {
  const { deviceId, capabilities, ports } = opts;

  async function executeAction(params: EdgeActionParams): Promise<EdgeActionResult> {
    const { action, subject, payload, context } = params;

    // 1. Policy gate — if a policy port is configured, check before executing
    let policyResult: { allowed: boolean; reason?: string } | undefined;
    if (ports.policy) {
      const result = await ports.policy.check({ action, subject, context });
      if (!result.ok) {
        return {
          ok: false,
          action,
          error: result.error ?? 'Policy check failed',
          errorCode: result.errorCode,
        };
      }
      policyResult = result.data;
      if (!result.data?.allowed) {
        return {
          ok: false,
          action,
          policyResult,
          error: result.data?.reason ?? 'Action blocked by policy',
          errorCode: 'POLICY_REJECTED',
        };
      }
    }

    // 2. Route to the appropriate port based on action prefix
    if (action.startsWith('payment:')) {
      if (!ports.payment) {
        return { ok: false, action, policyResult, error: 'No payment port configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.payment.pay({
        recipient: subject,
        amount: (payload?.amount as string) ?? '0',
        tokenId: payload?.tokenId as string,
        memo: payload?.memo as string,
      });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('lookup:query')) {
      if (!ports.lookup) {
        return { ok: false, action, policyResult, error: 'No lookup port configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.lookup.lookup({ query: subject });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('lookup:announce')) {
      if (!ports.lookup) {
        return { ok: false, action, policyResult, error: 'No lookup port configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.lookup.announce(payload as any);
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('proof:create')) {
      if (!ports.proof) {
        return { ok: false, action, policyResult, error: 'No proof port configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.proof.createProof({
        subject,
        claims: (payload?.claims as unknown[]) ?? [],
        context,
      });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('proof:verify')) {
      if (!ports.proof) {
        return { ok: false, action, policyResult, error: 'No proof port configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.proof.verifyProof({
        proof: payload?.proof,
        subject,
      });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('intelligence:invoke')) {
      if (!ports.intelligence) {
        return { ok: false, action, policyResult, error: 'No intelligence port configured', errorCode: 'PORT_MISSING' };
      }
      const domain = (payload?.domain as string) ?? 'llm';
      if (!hasCapability(capabilities, `intelligence:${domain}` as EdgeCapability)) {
        return {
          ok: false,
          action,
          policyResult,
          error: `Intelligence capability not granted: intelligence:${domain}`,
          errorCode: 'CAPABILITY_MISSING',
        };
      }
      const result = await ports.intelligence.invoke({
        requestId: payload?.requestId as string | undefined,
        domain,
        op: (payload?.op as string) ?? 'completion',
        params: (payload?.params as Record<string, unknown>) ?? {},
        context,
        signal: payload?.signal as AbortSignal | undefined,
      });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('intelligence:cancel')) {
      if (!ports.intelligence?.cancel) {
        return { ok: false, action, policyResult, error: 'No intelligence port cancel configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.intelligence.cancel(payload?.requestId as string);
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('decision:decide')) {
      if (!ports.decision) {
        return { ok: false, action, policyResult, error: 'No decision port configured', errorCode: 'PORT_MISSING' };
      }
      const request = payload?.request as DecisionRequest | undefined;
      if (!request || typeof request !== 'object' || (request.kind !== 'questions' && request.kind !== 'action')) {
        return { ok: false, action, policyResult, error: 'decision:decide requires a valid request payload', errorCode: 'INVALID_REQUEST' };
      }
      // Gate on the union (de-duplicated) of the request's decision types.
      const required = deriveRequiredCapabilities(request);
      const missing = required.filter((cap) => !hasCapability(capabilities, cap as EdgeCapability));
      if (missing.length > 0) {
        return {
          ok: false,
          action,
          policyResult,
          error: `Decision capability not granted: ${missing.join(', ')}`,
          errorCode: 'CAPABILITY_MISSING',
        };
      }
      const result = await ports.decision.decide({ request });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('decision:cancel')) {
      // Capability-ungated: control of an existing in-flight operation, not a
      // new semantic decision (RFC-012 §27).
      if (!ports.decision?.cancel) {
        return { ok: false, action, policyResult, error: 'No decision port cancel configured', errorCode: 'PORT_MISSING' };
      }
      const result = await ports.decision.cancel(payload?.requestId as string);
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    if (action.startsWith('omnia:')) {
      if (!ports.omnia) {
        return { ok: false, action, policyResult, error: 'No Omnia port configured', errorCode: 'PORT_MISSING' };
      }
      const operation = action.slice('omnia:'.length);
      const handlers: Record<string, (value: Record<string, unknown>) => Promise<import('./types.js').EdgeOperationResult>> = {
        getChannels: (value) => ports.omnia!.getChannels(value),
        openChannel: (value) => ports.omnia!.openChannel(value),
        pay: (value) => ports.omnia!.pay(value),
        settle: (value) => ports.omnia!.settle(value),
        closeChannel: (value) => ports.omnia!.closeChannel(value),
        getRoute: (value) => ports.omnia!.getRoute(value),
        payMultiHop: (value) => ports.omnia!.payMultiHop(value),
        getSwapRate: (value) => ports.omnia!.getSwapRate(value),
        createFactory: (value) => ports.omnia!.createFactory(value),
        openVirtualChannel: (value) => ports.omnia!.openVirtualChannel(value),
        closeFactory: (value) => ports.omnia!.closeFactory(value),
        spliceIn: (value) => ports.omnia!.spliceIn(value),
        spliceOut: (value) => ports.omnia!.spliceOut(value),
      };
      const handler = handlers[operation];
      if (!handler) {
        return { ok: false, action, policyResult, error: `Unknown Omnia operation: ${operation}`, errorCode: 'UNKNOWN_ACTION' };
      }
      const result = await handler({ subject, ...(payload ?? {}) });
      return { ok: result.ok, action, data: result.data, policyResult, error: result.error, errorCode: result.errorCode };
    }

    return {
      ok: false,
      action,
      policyResult,
      error: `Unknown action: ${action}`,
      errorCode: 'UNKNOWN_ACTION',
    };
  }

  return {
    version: EDGE_VERSION,
    deviceId,
    capabilities,
    ports,
    hasCapability(cap: EdgeCapability): boolean {
      return hasCapability(capabilities, cap);
    },
    assertCapability(cap: EdgeCapability): void {
      assertCapability(capabilities, cap);
    },
    executeAction,
  };
}

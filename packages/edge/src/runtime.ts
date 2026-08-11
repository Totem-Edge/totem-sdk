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

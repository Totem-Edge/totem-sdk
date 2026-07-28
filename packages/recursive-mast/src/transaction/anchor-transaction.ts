/**
 * Anchor transaction plan — creates the Policy Anchor Coin transaction.
 *
 * The anchor coin is the on-chain commitment that binds a subject
 * (vehicle, device, site) to a policy root, epoch, and manifest hash.
 * It is the root of all recursive MAST policy execution for that subject.
 */

import type { ScriptDescriptor, StateValue } from '@totemsdk/core/scripts';
import type { PolicyAnchorConfig } from '../policy-anchor.js';
import { buildPolicyAnchorScript, buildPolicyAnchorState } from '../policy-anchor.js';
import { createPolicyTransactionPlan } from './transaction-plan.js';
import type { PolicyTransactionPlan } from './transaction-plan.js';

export interface AnchorTransactionConfig {
  anchorConfig: PolicyAnchorConfig;
  initialRoots: {
    regulatorRoot?: string;
    ownerRoot?: string;
    serviceProviderRoot?: string;
    firmwareApprovalRoot?: string;
    manifestHash?: string;
  };
  fundingCoinId: string;
  fundingAddress: string;
  fundingAmount: string;
  anchorAmount: string;
  fundingScriptDescriptor: ScriptDescriptor;
}

export function createAnchorTransactionPlan(
  config: AnchorTransactionConfig,
): PolicyTransactionPlan {
  const script = buildPolicyAnchorScript(config.anchorConfig);
  const state = buildPolicyAnchorState(config.anchorConfig, config.initialRoots);

  const stateValues: StateValue[] = Object.entries(state).map(([port, value]) => ({
    port: Number(port),
    value,
    type: 'string' as const,
  }));

  const stateRecord: Record<number, string> = {};
  for (const sv of stateValues) {
    stateRecord[sv.port] = String(sv.value);
  }

  return createPolicyTransactionPlan({
    inputs: [
      {
        coinId: config.fundingCoinId,
        address: config.fundingAddress,
        amount: config.fundingAmount,
        scriptDescriptor: config.fundingScriptDescriptor,
      },
    ],
    outputs: [
      {
        address: config.fundingAddress,
        amount: config.anchorAmount,
        storeState: true,
        state: stateRecord,
      },
    ],
    transactionState: stateValues,
  });
}

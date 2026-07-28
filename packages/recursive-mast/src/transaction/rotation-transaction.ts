/**
 * Root rotation transaction plan — creates a transaction that rotates
 * a policy role root or advances the policy epoch.
 *
 * Root rotation is how the policy evolves: a regulator updates its
 * approval rules, an owner changes, or the epoch advances to
 * invalidate old credentials.
 */

import type { ScriptDescriptor, StateValue } from '@totemsdk/core/scripts';
import { createPolicyTransactionPlan } from './transaction-plan.js';
import type { PolicyTransactionPlan } from './transaction-plan.js';
import type { PolicyAnchorConfig } from '../policy-anchor.js';
import { buildRootRotationScript, buildEpochAdvancementScript } from '../policy-anchor.js';

export interface RotationTransactionConfig {
  anchorCoinId: string;
  anchorAddress: string;
  anchorAmount: string;
  anchorScriptDescriptor: ScriptDescriptor;
  anchorConfig: PolicyAnchorConfig;
  rotationType: 'root' | 'epoch';
  port?: number;
  newRoot?: string;
  newEpoch?: number;
  authorizerPkd: string;
  reason: string;
}

export function createRootRotationTransactionPlan(
  config: RotationTransactionConfig,
): PolicyTransactionPlan {
  if (config.rotationType === 'root') {
    if (config.port === undefined || config.newRoot === undefined) {
      throw new Error('Root rotation requires port and newRoot');
    }
  } else {
    if (config.newEpoch === undefined) {
      throw new Error('Epoch rotation requires newEpoch');
    }
  }

  const stateChanges: Record<number, string> = {};
  if (config.rotationType === 'root' && config.port !== undefined && config.newRoot !== undefined) {
    stateChanges[config.port] = config.newRoot;
  } else if (config.rotationType === 'epoch' && config.newEpoch !== undefined) {
    stateChanges[config.anchorConfig.ports.epoch] = String(config.newEpoch);
  }

  const stateValues: StateValue[] = Object.entries(stateChanges).map(([port, value]) => ({
    port: Number(port),
    value,
    type: 'string' as const,
  }));

  return createPolicyTransactionPlan({
    inputs: [
      {
        coinId: config.anchorCoinId,
        address: config.anchorAddress,
        amount: config.anchorAmount,
        scriptDescriptor: config.anchorScriptDescriptor,
      },
    ],
    outputs: [
      {
        address: config.anchorAddress,
        amount: config.anchorAmount,
        storeState: true,
        state: stateChanges,
      },
    ],
    transactionState: stateValues,
  });
}

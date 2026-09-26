/**
 * Action transaction plan — creates a transaction that exercises a
 * policy action through the recursive MAST path.
 *
 * This is the transaction that actually executes a policy branch
 * (e.g., firmware install, maintenance restart, ownership transfer).
 */

import type { ScriptDescriptor, StateValue } from '@totemsdk/core/scripts';
import { createPolicyTransactionPlan } from './transaction-plan.js';
import type { PolicyTransactionPlan, PolicyTransactionInput, PolicyTransactionOutput } from './transaction-plan.js';
import type { RecursiveWitnessPlan } from '../kissvm/witness-adapter.js';
import type { ScriptDisclosure } from '../policy-signing.js';

export interface ActionTransactionConfig {
  anchorCoinId: string;
  anchorAddress: string;
  anchorAmount: string;
  anchorScriptDescriptor: ScriptDescriptor;
  action: string;
  subjectId: string;
  /** Anchor action-selector port (state). When set, the plan selects the normal-action branch (0). */
  actionSelectorPort?: number;
  disclosedScripts: ScriptDisclosure[];
  witnessPlan: RecursiveWitnessPlan;
  outputs: PolicyTransactionOutput[];
  stateChanges?: Record<number, string>;
}

export function createActionTransactionPlan(
  config: ActionTransactionConfig,
): PolicyTransactionPlan {
  // RFC-016 P3: bind the plan to the action selector (normal action = 0) so the
  // anchor script cannot silently select a different branch.
  const stateChanges: Record<number, string> = { ...(config.stateChanges ?? {}) };
  if (config.actionSelectorPort !== undefined) {
    stateChanges[config.actionSelectorPort] = '0';
  }

  const anchorInput: PolicyTransactionInput = {
    coinId: config.anchorCoinId,
    address: config.anchorAddress,
    amount: config.anchorAmount,
    scriptDescriptor: config.anchorScriptDescriptor,
    witnessPlan: config.witnessPlan,
    disclosedScripts: config.disclosedScripts,
  };

  const anchorOutput: PolicyTransactionOutput = {
    address: config.anchorAddress,
    amount: config.anchorAmount,
    storeState: true,
    state: Object.keys(stateChanges).length > 0 ? stateChanges : undefined,
  };

  const stateValues: StateValue[] | undefined = Object.keys(stateChanges).length > 0
    ? Object.entries(stateChanges).map(([port, value]) => ({
        port: Number(port),
        value,
        type: 'string' as const,
      }))
    : undefined;

  return createPolicyTransactionPlan({
    inputs: [anchorInput],
    outputs: [anchorOutput, ...config.outputs],
    transactionState: stateValues ?? [],
  });
}

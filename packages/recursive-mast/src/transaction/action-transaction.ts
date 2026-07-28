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
  disclosedScripts: ScriptDisclosure[];
  witnessPlan: RecursiveWitnessPlan;
  outputs: PolicyTransactionOutput[];
  stateChanges?: Record<number, string>;
}

export function createActionTransactionPlan(
  config: ActionTransactionConfig,
): PolicyTransactionPlan {
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
    state: config.stateChanges,
  };

  const stateValues: StateValue[] | undefined = config.stateChanges
    ? Object.entries(config.stateChanges).map(([port, value]) => ({
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

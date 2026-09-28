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
  /** Anchor action-selector port (state). Required to bind the normal-action branch (0). */
  actionSelectorPort?: number;
  /** Anchor execution root; recorded as the action argument when present. */
  executionRoot?: string;
  disclosedScripts: ScriptDisclosure[];
  witnessPlan: RecursiveWitnessPlan;
  outputs: PolicyTransactionOutput[];
  stateChanges?: Record<number, string>;
}

export function createActionTransactionPlan(
  config: ActionTransactionConfig,
): PolicyTransactionPlan {
  // RFC-016 hardening: the plan must bind the action (selector) and subject
  // identity, rather than silently omitting them.
  if (!config.action) throw new Error('createActionTransactionPlan: action is required');
  // RFC-018 RM-ACTION-001: port 0 is the reserved subject identity, so the
  // selector must live on a positive port — otherwise the selector write below
  // would clobber `stateChanges[0] = subjectId`.
  if (config.actionSelectorPort === undefined || config.actionSelectorPort <= 0) {
    throw new Error(
      'createActionTransactionPlan: actionSelectorPort must be a positive port (> 0); port 0 is reserved for the subject identity',
    );
  }
  const stateChanges: Record<number, string> = { ...(config.stateChanges ?? {}) };
  // State 0 is the reserved subject identity (policy-anchor).
  stateChanges[0] = config.subjectId;
  // Select the normal-action branch (0); carry the execution root as argument.
  stateChanges[config.actionSelectorPort] = '0';
  if (config.executionRoot !== undefined) {
    stateChanges[config.actionSelectorPort + 1] = config.executionRoot;
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

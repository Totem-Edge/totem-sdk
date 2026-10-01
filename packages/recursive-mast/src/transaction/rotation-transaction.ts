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
import type { PolicyTransactionPlan, PolicyTransactionInput } from './transaction-plan.js';
import type { PolicyAnchorConfig } from '../policy-anchor.js';
import { buildRootRotationScript, buildEpochAdvancementScript } from '../policy-anchor.js';
import type { ScriptDisclosure } from '../policy-signing.js';
import type { RecursiveWitnessPlan } from '../kissvm/witness-adapter.js';

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
  /** Revealed rotation branch (owner-root MAST) — wires the authorizer. */
  disclosedScripts?: ScriptDisclosure[];
  witnessPlan?: RecursiveWitnessPlan;
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
  // RFC-016 I1/P3: a rotation must name the authority that authorizes it.
  if (!config.authorizerPkd) {
    throw new Error('Rotation requires authorizerPkd');
  }
  // RFC-020 P2-9: the reason is committed (not merely a script comment).
  if (!config.reason || config.reason.trim().length === 0) {
    throw new Error('Rotation requires a non-empty reason');
  }
  const authorizerPkd = config.authorizerPkd.replace(/^0x/i, '').toLowerCase();
  // RFC-020 P2-9: when a witness is supplied it must actually carry the
  // authorizer's signature, so the branch cannot be selected by an unrelated key.
  if (config.witnessPlan && config.witnessPlan.signatures.size > 0) {
    const keys = [...config.witnessPlan.signatures.keys()].map((k) => k.replace(/^0x/i, '').toLowerCase());
    if (!keys.includes(authorizerPkd)) {
      throw new Error('Rotation witness does not contain a signature for authorizerPkd');
    }
  }

  const ports = config.anchorConfig.ports;
  const stateChanges: Record<number, string> = {};
  if (config.rotationType === 'root' && config.port !== undefined && config.newRoot !== undefined) {
    stateChanges[config.port] = config.newRoot;
    // RFC-016 P3: select the anchor's root-rotation branch (action 1) and carry
    // the rotated port as the action argument.
    stateChanges[ports.actionRoot] = '1';
    stateChanges[ports.actionRoot + 1] = String(config.port);
    // RFC-020 P2-9: commit the authorizer + reason into the successor state.
    stateChanges[ports.actionRoot + 2] = authorizerPkd;
    stateChanges[ports.actionRoot + 3] = config.reason;
  } else if (config.rotationType === 'epoch' && config.newEpoch !== undefined) {
    stateChanges[ports.epoch] = String(config.newEpoch);
    // Select the epoch-advancement branch (action 2).
    stateChanges[ports.actionRoot] = '2';
    stateChanges[ports.actionRoot + 1] = String(config.newEpoch);
    stateChanges[ports.actionRoot + 2] = authorizerPkd;
    stateChanges[ports.actionRoot + 3] = config.reason;
  }

  const stateValues: StateValue[] = Object.entries(stateChanges).map(([port, value]) => ({
    port: Number(port),
    value,
    type: 'string' as const,
  }));

  // RFC-016 hardening: wire the rotation authorizer into the witness — the
  // revealed owner-root branch (with its proof) plus the call-specific witness.
  const anchorInput: PolicyTransactionInput = {
    coinId: config.anchorCoinId,
    address: config.anchorAddress,
    amount: config.anchorAmount,
    scriptDescriptor: config.anchorScriptDescriptor,
    ...(config.disclosedScripts ? { disclosedScripts: config.disclosedScripts } : {}),
    ...(config.witnessPlan ? { witnessPlan: config.witnessPlan } : {}),
  };

  return createPolicyTransactionPlan({
    inputs: [anchorInput],
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

/**
 * Policy transaction plan — converts recursive-mast policy execution
 * plans into tx-builder-compatible EnhancedBuildParams.
 *
 * This module is the bridge between "this is the policy we intend to
 * execute" and "this is the exact Minima transaction every signer is
 * authorizing."
 *
 * @totemsdk/tx-builder is an optional peer dependency. The types
 * defined here are compatible with tx-builder's EnhancedBuildParams,
 * EnhancedCoinInput, and EnhancedCoinOutput. Consumers with tx-builder
 * installed can pass the return value of toEnhancedBuildParams()
 * directly to tx-builder functions.
 */

import type { ScriptDescriptor, StateValue } from '@totemsdk/core/scripts';
import type { RecursiveWitnessPlan } from '../kissvm/witness-adapter.js';
import type { ScriptDisclosure } from '../policy-signing.js';

export interface PolicyTransactionInput {
  coinId: string;
  address: string;
  amount: string;
  tokenId?: string;
  scriptDescriptor: ScriptDescriptor;
  coinProofHex?: string;
  witnessPlan?: RecursiveWitnessPlan;
  disclosedScripts?: ScriptDisclosure[];
}

export interface PolicyTransactionOutput {
  address: string;
  amount: string;
  tokenId?: string;
  storeState?: boolean;
  state?: Record<number, string>;
}

export interface PolicyTransactionPlan {
  inputs: PolicyTransactionInput[];
  outputs: PolicyTransactionOutput[];
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
}

export function createPolicyTransactionPlan(config: {
  inputs: PolicyTransactionInput[];
  outputs: PolicyTransactionOutput[];
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
}): PolicyTransactionPlan {
  return {
    inputs: config.inputs,
    outputs: config.outputs,
    transactionState: config.transactionState,
    linkHash: config.linkHash,
  };
}

function stateRecordToStateValues(state: Record<number, string>): StateValue[] {
  return Object.entries(state).map(([port, value]) => ({
    port: Number(port),
    value,
    type: 'string' as const,
  }));
}

function witnessPlanToDescriptor(plan: RecursiveWitnessPlan): {
  signatures?: Array<{ pubkeyHex: string; signature: Uint8Array }>;
  scriptProofs?: Array<{ script: string; scriptProof: string; expectedRoot: string }>;
} {
  const descriptor: {
    signatures?: Array<{ pubkeyHex: string; signature: Uint8Array }>;
    scriptProofs?: Array<{ script: string; scriptProof: string; expectedRoot: string }>;
  } = {};

  if (plan.signatures.size > 0) {
    descriptor.signatures = Array.from(plan.signatures.entries()).map(([pubkeyHex, sigHex]) => {
      const sigBytes = new Uint8Array(sigHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? []);
      return { pubkeyHex, signature: sigBytes };
    });
  }

  return descriptor;
}

function disclosedScriptsToProofs(
  disclosedScripts: ScriptDisclosure[],
): Array<{ script: string; scriptProof: string; expectedRoot: string }> {
  return disclosedScripts.map(ds => ({
    script: ds.script,
    scriptProof: ds.mmrProof,
    expectedRoot: '',
  }));
}

/**
 * Convert a PolicyTransactionPlan to tx-builder-compatible build params.
 *
 * The return type is compatible with @totemsdk/tx-builder's EnhancedBuildParams.
 * Consumers with tx-builder installed can pass this directly to tx-builder functions.
 */
export function toEnhancedBuildParams(plan: PolicyTransactionPlan): {
  inputs: Array<{
    coinId: string;
    address: string;
    amount: string;
    tokenId?: string;
    scriptDescriptor: ScriptDescriptor;
    coinProofHex?: string;
    witness?: {
      signatures?: Array<{ pubkeyHex: string; signature: Uint8Array }>;
      scriptProofs?: Array<{ script: string; scriptProof: string; expectedRoot: string }>;
    };
  }>;
  outputs: Array<{
    address: string;
    amount: string;
    tokenId?: string;
    storeState?: boolean;
    state?: StateValue[];
  }>;
  transactionState?: StateValue[];
  linkHash?: Uint8Array;
} {
  const inputs = plan.inputs.map(input => {
    const witness = input.witnessPlan
      ? witnessPlanToDescriptor(input.witnessPlan)
      : undefined;

    if (witness && input.disclosedScripts) {
      witness.scriptProofs = disclosedScriptsToProofs(input.disclosedScripts);
    }

    return {
      coinId: input.coinId,
      address: input.address,
      amount: input.amount,
      tokenId: input.tokenId,
      scriptDescriptor: input.scriptDescriptor,
      coinProofHex: input.coinProofHex,
      witness,
    };
  });

  const outputs = plan.outputs.map(output => ({
    address: output.address,
    amount: output.amount,
    tokenId: output.tokenId,
    storeState: output.storeState,
    state: output.state ? stateRecordToStateValues(output.state) : undefined,
  }));

  return {
    inputs,
    outputs,
    transactionState: plan.transactionState,
    linkHash: plan.linkHash,
  };
}

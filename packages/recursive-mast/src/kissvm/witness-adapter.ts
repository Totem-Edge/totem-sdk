/**
 * Witness adapter — converts recursive-mast witness plans to KISSVM
 * ScriptWitness objects for transaction evaluation.
 *
 * recursive-mast plans the witness structure; kissvm materializes it.
 */

import { buildWitness } from '@totemsdk/kissvm';
import type { ScriptWitness, ScriptProof, WitnessInput } from '@totemsdk/kissvm';
import { hexToBytes } from '@totemsdk/core';

export interface RecursiveWitnessPlan {
  mastBranches: Map<string, string>;
  signatures: Map<string, string>;
  /** Canonical ScriptProofs for MAST branch revelation */
  scriptProofs?: ScriptProof[];
}

export function convertWitnessPlanToKissvmInputs(
  plan: RecursiveWitnessPlan,
): WitnessInput[] {
  const inputs: WitnessInput[] = [];
  for (const [pubkeyHex, signatureHex] of plan.signatures) {
    inputs.push({
      pubkeyHex,
      signature: hexToBytes(signatureHex),
    });
  }
  return inputs;
}

export function materializeRecursiveWitness(
  plan: RecursiveWitnessPlan,
): { witness: ScriptWitness; mastBranches: Map<string, string> } {
  const witnessInputs = convertWitnessPlanToKissvmInputs(plan);
  const witness = buildWitness(witnessInputs);
  if (plan.scriptProofs) {
    witness.scriptProofs = plan.scriptProofs;
  }
  return { witness, mastBranches: plan.mastBranches };
}

import type { ScriptWitness } from './types.js';

export interface WitnessInput {
  /** Public key digest hex (32 bytes, with or without 0x prefix) */
  pubkeyHex: string;
  /** 1088-byte flat WOTS signature */
  signature: Uint8Array;
}

/**
 * buildWitness — constructs a ScriptWitness from a list of signed inputs.
 *
 * Each entry provides the public-key digest and the corresponding WOTS
 * signature over the transaction digest. The evaluator uses this witness
 * when verifying SIGNEDBY / MULTISIG opcodes.
 */
export function buildWitness(inputs: WitnessInput[]): ScriptWitness {
  const signatures = new Map<string, Uint8Array>();
  for (const inp of inputs) {
    const key = normalizeKey(inp.pubkeyHex);
    signatures.set(key, inp.signature);
  }
  return { signatures };
}

function normalizeKey(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return raw.toLowerCase();
}

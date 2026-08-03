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
 *
 * For convenience, a `{ signatures }` map (pubkey hex → signature bytes or
 * hex string) is also accepted — used by the canonical example suite.
 */
export function buildWitness(
  inputs: WitnessInput[] | { signatures: Record<string, Uint8Array | string> },
): ScriptWitness {
  const signatures = new Map<string, Uint8Array>();

  if (Array.isArray(inputs)) {
    for (const inp of inputs) {
      signatures.set(normalizeKey(inp.pubkeyHex), inp.signature);
    }
    return { signatures };
  }

  for (const [pubkeyHex, sig] of Object.entries(inputs.signatures ?? {})) {
    const value = typeof sig === 'string'
      ? hexToBytes(sig.replace(/^0x/i, ''))
      : sig;
    signatures.set(normalizeKey(pubkeyHex), value);
  }
  return { signatures };
}

function hexToBytes(hex: string): Uint8Array {
  const raw = hex.replace(/^0x/i, '');
  if (raw.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(raw.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function normalizeKey(hex: string): string {
  const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return raw.toLowerCase();
}

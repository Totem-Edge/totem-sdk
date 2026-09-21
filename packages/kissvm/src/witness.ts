import { getRootPublicKey, bytesToHex } from '@totemsdk/core';
import type { TreeSignature } from '@totemsdk/core';
import type { ScriptWitness } from './types.js';

/**
 * One witness signature entry (RFC-009).
 *
 * - a flat single-key WOTS signature (`{ pubkeyHex, signature }`), or
 * - a Minima tree signature (`TreeSignature`) whose root public key is the
 *   signer identity.
 */
export type WitnessInput =
  | { pubkeyHex: string; signature: Uint8Array }
  | TreeSignature;

function isTreeSignature(value: unknown): value is TreeSignature {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { proofs?: unknown }).proofs)
  );
}

/** Signer identity = the root public key of a tree signature's first proof. */
function rootKeyHex(sig: TreeSignature): string {
  return bytesToHex(getRootPublicKey(sig.proofs[0])).toLowerCase();
}

/**
 * buildWitness — constructs a ScriptWitness from signed entries.
 *
 * Flat entries are keyed by their declared WOTS public-key digest; tree
 * signatures are keyed by their **computed root public key** (never a
 * caller-supplied value), so `SIGNEDBY(<root>)` can only be satisfied by a
 * signature that actually reconstructs to that root.
 *
 * For convenience, a `{ signatures }` map (key → signature bytes/hex or
 * `TreeSignature`) is also accepted.
 */
export function buildWitness(
  inputs:
    | WitnessInput[]
    | { signatures: Record<string, Uint8Array | string | TreeSignature> },
): ScriptWitness {
  const signatures = new Map<string, Uint8Array | TreeSignature>();

  if (Array.isArray(inputs)) {
    for (const inp of inputs) {
      if (isTreeSignature(inp)) {
        signatures.set(rootKeyHex(inp), inp);
      } else {
        signatures.set(normalizeKey(inp.pubkeyHex), inp.signature);
      }
    }
    return { signatures };
  }

  for (const [pubkeyHex, sig] of Object.entries(inputs.signatures ?? {})) {
    if (isTreeSignature(sig)) {
      signatures.set(rootKeyHex(sig), sig);
    } else {
      const value = typeof sig === 'string'
        ? hexToBytes(sig.replace(/^0x/i, ''))
        : sig;
      signatures.set(normalizeKey(pubkeyHex), value);
    }
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

/**
 * RFC-032: post-quantum lookup identity.
 *
 * The lookup identity is a hash-based (WOTS/TreeKey) key, not an Ed25519
 * keypair. A TreeKey has a stable root public key and many one-time signing
 * indices, so the same identity signs many messages without re-keying.
 *
 * One-time safety: each `sign` consumes one TreeKey use. The use counter is the
 * anti-replay nonce carried on the wire; the node rejects non-increasing or
 * repeated nonces per identity. Callers that want restart-safety should persist
 * the use counter (or delegate leasing to `@totemsdk/wots-lease` /
 * `@totemsdk/root-identity`, per RFC-032 §9 Q1).
 */

import {
  createPerAddressTreeKey,
  serializeTreeSignature,
  verifyTreeSignature,
  deserializeTreeSignature,
  bytesToHex,
  hexToBytes,
  sha3_256,
} from '@totemsdk/core';
import type { TreeKey } from '@totemsdk/core';

/** Core's WASM hex encoder emits uppercase; lookup uses lowercase hex. */
function toHexLower(bytes: Uint8Array): string {
  return bytesToHex(bytes).toLowerCase();
}

export interface LookupIdentityOptions {
  /** Address index for per-address derivation. Default 0. */
  addressIndex?: number;
  /** Resume the TreeKey use counter from a persisted value (restart safety). */
  startUses?: number;
}

export class LookupIdentity {
  private readonly _treeKey: TreeKey;

  private constructor(treeKey: TreeKey) {
    this._treeKey = treeKey;
  }

  /**
   * Build a lookup identity from a 32-byte seed.
   *
   * NOTE: production deployments should derive this from the root identity
   * (`@totemsdk/root-identity`) and coordinate indices via `@totemsdk/wots-lease`;
   * this constructor is the low-level primitive those will call.
   */
  static fromSeed(seed: Uint8Array, options: LookupIdentityOptions = {}): LookupIdentity {
    const tk = createPerAddressTreeKey(seed, options.addressIndex ?? 0);
    if (options.startUses !== undefined) tk.setUses(options.startUses);
    return new LookupIdentity(tk);
  }

  /** Hex of the 32-byte WOTS/TreeKey root public key (what verifiers need). */
  get rootPublicKey(): string {
    return toHexLower(this._treeKey.getPublicKey());
  }

  /** Total signatures this identity can produce. */
  get maxUses(): number {
    return this._treeKey.getMaxUses();
  }

  /** Number of signatures consumed so far. */
  get uses(): number {
    return this._treeKey.getUses();
  }

  /**
   * Sign a 32-byte digest, consuming one use. Returns { signature, nonce } where
   * `nonce` is the use index that was consumed (the anti-replay value to put on
   * the wire).
   */
  sign(digest: Uint8Array): { signature: Uint8Array; nonce: number } {
    const nonce = this._treeKey.getUses();
    const sig = this._treeKey.sign(digest);
    return { signature: serializeTreeSignature(sig), nonce };
  }
}

/** Verify a TreeKey signature against a root public key and digest. */
export function verifyIdentitySignature(
  rootPublicKeyHex: string,
  digest: Uint8Array,
  signatureHex: string,
): boolean {
  try {
    const pk = hexToBytes(rootPublicKeyHex);
    const sigBytes = hexToBytes(signatureHex);
    const sig = deserializeTreeSignature(sigBytes);
    return verifyTreeSignature(pk, digest, sig);
  } catch {
    return false;
  }
}

/** SHA3-256 digest of arbitrary bytes (used as the signed value). */
export function digestBytes(bytes: Uint8Array): Uint8Array {
  return sha3_256(bytes);
}

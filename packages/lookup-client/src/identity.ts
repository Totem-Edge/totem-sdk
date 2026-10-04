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
import type { UnifiedIdentityWallet } from '@totemsdk/root-identity';

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

/**
 * Which key of the root identity signs lookup messages.
 *  - `'root'`  — the root identity key (off-chain attestation; never a spend key).
 *  - number    — child address index (0–63).
 */
export type IdentitySlot = 'root' | number;

export interface FromWalletOptions {
  /** Key slot. Default `'root'`. */
  slot?: IdentitySlot;
}

export class LookupIdentity {
  private readonly _treeKey: TreeKey;
  /** Advance the underlying watermark after each signature (wallet-backed). */
  private readonly _advance?: (consumedUses: number) => void;
  private readonly _pubKeyHex: string;

  private constructor(treeKey: TreeKey, pubKeyHex: string, advance?: (uses: number) => void) {
    this._treeKey = treeKey;
    this._pubKeyHex = pubKeyHex;
    this._advance = advance;
  }

  /**
   * Build a lookup identity from a 32-byte seed (low-level primitive / tests).
   *
   * Production deployments should use {@link LookupIdentity.fromWallet} so the
   * lookup identity is the same root identity used elsewhere, with its watermark
   * persisted (see `UnifiedIdentityWallet.getWatermarkState`).
   */
  static fromSeed(seed: Uint8Array, options: LookupIdentityOptions = {}): LookupIdentity {
    const tk = createPerAddressTreeKey(seed, options.addressIndex ?? 0);
    if (options.startUses !== undefined) tk.setUses(options.startUses);
    return new LookupIdentity(tk, toHexLower(tk.getPublicKey()));
  }

  /**
   * RFC-032 §9 Q1: use the root identity as the lookup identity.
   *
   * Signs with the wallet's root key (`slot: 'root'`) or a child (numeric slot),
   * advancing the wallet's forward-only watermark after each signature. Persist
   * the wallet's `getWatermarkState()` so the counter survives restarts and no
   * WOTS leaf is ever reused.
   */
  static fromWallet(wallet: UnifiedIdentityWallet, options: FromWalletOptions = {}): LookupIdentity {
    const slot = options.slot ?? 'root';
    if (slot === 'root') {
      const tk = wallet.getRootTreeKey();
      const advance = (consumed: number): void => {
        // getRootUses reflects signatures already made; set to consumed+1.
        wallet.setRootUses(consumed + 1);
      };
      tk.setUses(wallet.getRootUses());
      return new LookupIdentity(tk, toHexLower(tk.getPublicKey()), advance);
    }

    const tk = wallet.getChildTreeKey(slot);
    const advance = (consumed: number): void => wallet.setChildUses(slot, consumed + 1);
    tk.setUses(wallet.getChildUses(slot));
    return new LookupIdentity(tk, toHexLower(tk.getPublicKey()), advance);
  }

  /** Hex of the 32-byte WOTS/TreeKey public key (what verifiers need). */
  get rootPublicKey(): string {
    return this._pubKeyHex;
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
    this._advance?.(nonce);
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

/**
 * UnifiedIdentityWallet — single root identity with true hierarchical key derivation.
 *
 * Architecture
 * ────────────
 *  baseSeed (32 bytes)
 *    │
 *    ├── root_priv_seed = deriveRootPrivSeed(baseSeed)
 *    │     └── rootTreeKey = createUnifiedRootTreeKey(baseSeed)  ← identity anchor (NEVER a spend address)
 *    │
 *    ├── child_seed_0 = deriveUnifiedChildSeed(baseSeed, 0)
 *    │     └── childTreeKey_0                                     ← spend address 0
 *    ├── child_seed_1 = deriveUnifiedChildSeed(baseSeed, 1)
 *    │     └── childTreeKey_1                                     ← spend address 1
 *    │   …
 *    └── child_seed_N = deriveUnifiedChildSeed(baseSeed, N)
 *          └── childTreeKey_N                                     ← spend address N
 *
 * Child seeds are cryptographically descended from root_priv_seed, not siblings.
 * This enables genuine ancestral proofs: the root can prove control of any child
 * without revealing relationships between children.
 *
 * Addresses are Minima-compatible: RETURN SIGNEDBY(treeKey.rootPubKey) scripts,
 * WOTS proof-chain signatures. Nodes never see the derivation hierarchy.
 *
 * Watermarks are tracked in memory. Callers that need persistence should read
 * `getRootUses()` / `getChildUses(index)` after each signing operation and
 * restore them via `setRootUses()` / `setChildUses()` on the next session.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import {
  createUnifiedChildTreeKey,
  createUnifiedRootTreeKey,
  serializeTreeSignature,
  verifySignatureDetailed,
  scriptFromWotsPk,
  scriptToAddress,
  bytesToHex,
  hexToBytes,
  phraseToSeed,
  generateSeedPhrase,
  validatePhrase,
  type TreeKey,
} from '@totemsdk/core';
import type { WotsProof, OwnershipProof } from './types.js';

export const MAX_CHILD_COUNT = 64;

const OWNERSHIP_OP = 'TOTEM_OWNERSHIP_PROOF_V1';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hashMessage(message: string): Uint8Array {
  return sha3_256(new TextEncoder().encode(message));
}

function addressFromPublicKeyBytes(pkBytes: Uint8Array): string {
  const script = scriptFromWotsPk(pkBytes);
  return scriptToAddress(script);
}

/**
 * Build the deterministic ownership-proof message that the root key signs.
 *
 * Child public keys are sorted lexicographically before serialization so that
 * the same child set always produces the same canonical message regardless of
 * the order in which indices were passed to `proveOwnership`.
 */
function buildOwnershipMessage(
  rootAddress: string,
  childPublicKeys: string[],
  timestamp: string
): string {
  return JSON.stringify({
    op: OWNERSHIP_OP,
    rootAddress,
    childPublicKeys: [...childPublicKeys].sort(),
    timestamp,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UnifiedIdentityWallet
// ─────────────────────────────────────────────────────────────────────────────

export class UnifiedIdentityWallet {
  private readonly baseSeed: Uint8Array;
  private readonly childCount: number;

  /** Cached root TreeKey (identity anchor). Created lazily. */
  private cachedRootTreeKey?: TreeKey;

  /** Cached child TreeKey instances. Created lazily. */
  private readonly childTreeKeyCache: Map<number, TreeKey> = new Map();

  /** Cached addresses and public keys (populated on first access per key). */
  private cachedRootAddress?: string;
  private cachedRootPublicKey?: string;
  private readonly childAddressCache: Map<number, string> = new Map();
  private readonly childPubKeyCache: Map<number, string> = new Map();

  /** Per-slot watermarks (in-memory; persist via getWatermarkState / restoreWatermarkState). */
  private rootUses: number = 0;
  private readonly childUsesMap: Map<number, number> = new Map();

  // ── Construction ────────────────────────────────────────────────────────────

  /**
   * @param baseSeed   - 32-byte raw seed (use `UnifiedIdentityWallet.fromPhrase` for mnemonic input)
   * @param childCount - Number of child addresses (1–64, default 64)
   */
  constructor(baseSeed: Uint8Array, childCount: number = MAX_CHILD_COUNT) {
    if (baseSeed.length !== 32) {
      throw new Error(`baseSeed must be exactly 32 bytes, got ${baseSeed.length}`);
    }
    if (childCount < 1 || childCount > MAX_CHILD_COUNT) {
      throw new Error(`childCount must be 1–${MAX_CHILD_COUNT}, got ${childCount}`);
    }
    this.baseSeed = baseSeed;
    this.childCount = childCount;
  }

  /** Create a wallet from a Minima-compatible BIP39 seed phrase. */
  static fromPhrase(phrase: string, childCount: number = MAX_CHILD_COUNT): UnifiedIdentityWallet {
    return new UnifiedIdentityWallet(phraseToSeed(phrase), childCount);
  }

  /** Generate a new random Minima-compatible 24-word seed phrase. */
  static generatePhrase(): string {
    return generateSeedPhrase();
  }

  /** Validate a Minima-compatible seed phrase. */
  static validatePhrase(phrase: string): boolean {
    return validatePhrase(phrase);
  }

  // ── Address accessors ────────────────────────────────────────────────────────

  /** Minima address for the root key. NEVER use this address for spending. */
  getRootAddress(): string {
    if (!this.cachedRootAddress) {
      this.populateRootCache();
    }
    return this.cachedRootAddress!;
  }

  /** 64-char hex public key for the root key. */
  getRootPublicKey(): string {
    if (!this.cachedRootPublicKey) {
      this.populateRootCache();
    }
    return this.cachedRootPublicKey!;
  }

  /** Minima spend address for child `index` (0-based). */
  getChildAddress(index: number): string {
    this.assertChildIndex(index);
    if (!this.childAddressCache.has(index)) {
      this.getOrCreateChildTreeKey(index);
    }
    return this.childAddressCache.get(index)!;
  }

  /** 64-char hex public key for child `index`. */
  getChildPublicKey(index: number): string {
    this.assertChildIndex(index);
    if (!this.childPubKeyCache.has(index)) {
      this.getOrCreateChildTreeKey(index);
    }
    return this.childPubKeyCache.get(index)!;
  }

  /** All addresses: root first, then all children in order. */
  getAllAddresses(): string[] {
    const out: string[] = [this.getRootAddress()];
    for (let i = 0; i < this.childCount; i++) {
      out.push(this.getChildAddress(i));
    }
    return out;
  }

  /** Root address and children as a structured object. */
  getAddressMap(): { root: string; children: string[] } {
    const children: string[] = [];
    for (let i = 0; i < this.childCount; i++) {
      children.push(this.getChildAddress(i));
    }
    return { root: this.getRootAddress(), children };
  }

  // ── Signing ─────────────────────────────────────────────────────────────────

  /**
   * Sign `message` with the root identity key (for off-chain attestations).
   * Hashes the message with SHA3-256 before signing.
   * @throws if root TreeKey is exhausted (262 144 uses)
   */
  signFromRoot(message: string): WotsProof {
    const treeKey = this.getRootTreeKey();
    treeKey.setUses(this.rootUses);
    const sig = treeKey.sign(hashMessage(message));
    this.rootUses++;
    return {
      address: this.getRootAddress(),
      publicKey: this.getRootPublicKey(),
      signature: bytesToHex(serializeTreeSignature(sig)),
      message,
    };
  }

  /**
   * Sign `message` with child key `index` (0-based) for on-chain transactions.
   * Each child maintains its own independent use counter.
   * @throws if child TreeKey is exhausted or index out of range
   */
  signFromChild(index: number, message: string): WotsProof {
    this.assertChildIndex(index);
    const treeKey = this.getOrCreateChildTreeKey(index);
    const uses = this.childUsesMap.get(index) ?? 0;
    treeKey.setUses(uses);
    const sig = treeKey.sign(hashMessage(message));
    this.childUsesMap.set(index, uses + 1);
    return {
      address: this.getChildAddress(index),
      publicKey: this.getChildPublicKey(index),
      signature: bytesToHex(serializeTreeSignature(sig)),
      message,
    };
  }

  // ── Ownership proofs ─────────────────────────────────────────────────────────

  /**
   * Produce an ownership proof demonstrating that this root identity controls
   * all given child addresses.
   *
   * The root key signs a canonical JSON message containing all child public keys
   * (sorted) and a timestamp, enabling third-party verification without any
   * network access.
   *
   * @param childIndices - Which children to include (0-based)
   */
  proveOwnership(childIndices: number[]): OwnershipProof {
    if (childIndices.length === 0) {
      throw new Error('childIndices must contain at least one index');
    }
    const seen = new Set<number>();
    for (const idx of childIndices) {
      this.assertChildIndex(idx);
      if (seen.has(idx)) throw new Error(`Duplicate child index: ${idx}`);
      seen.add(idx);
    }

    const timestamp = new Date().toISOString();
    const childAddresses = childIndices.map(i => this.getChildAddress(i));
    const childPublicKeys = childIndices.map(i => this.getChildPublicKey(i));
    const rootAddress = this.getRootAddress();
    const rootPublicKey = this.getRootPublicKey();

    const message = buildOwnershipMessage(rootAddress, childPublicKeys, timestamp);
    const rootProof = this.signFromRoot(message);

    return { rootAddress, rootPublicKey, childAddresses, childPublicKeys, rootProof, timestamp };
  }

  /**
   * Verify an ownership proof produced by `proveOwnership`.
   *
   * Returns `true` only when:
   * - The canonical message is reconstructed correctly (child keys are sorted).
   * - The root WOTS signature validates against the root public key and address.
   * - Every child public key correctly derives the corresponding child address.
   *
   * Pure crypto — no network access required.
   * Always returns `false` (never throws) on malformed or incomplete proof data.
   */
  static verifyOwnershipProof(proof: OwnershipProof): boolean {
    try {
      if (!proof || typeof proof !== 'object') return false;

      const { rootAddress, rootPublicKey, childAddresses, childPublicKeys, rootProof, timestamp } = proof;

      if (
        !rootAddress || !rootPublicKey || !timestamp ||
        !Array.isArray(childAddresses) || !Array.isArray(childPublicKeys) ||
        !rootProof || typeof rootProof.signature !== 'string'
      ) {
        return false;
      }

      if (childAddresses.length === 0) return false;
      if (childAddresses.length !== childPublicKeys.length) return false;

      const canonicalMessage = buildOwnershipMessage(rootAddress, childPublicKeys, timestamp);
      if (rootProof.message !== canonicalMessage) return false;

      const sigResult = verifySignatureDetailed(rootAddress, canonicalMessage, rootProof.signature, rootPublicKey);
      if (!sigResult.valid) return false;

      for (let i = 0; i < childPublicKeys.length; i++) {
        const pkBytes = hexToBytes(childPublicKeys[i]);
        const derivedAddress = addressFromPublicKeyBytes(pkBytes);
        if (derivedAddress.toLowerCase() !== childAddresses[i].toLowerCase()) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ── TreeKey access (for low-level transaction signing) ───────────────────────

  /**
   * Get (or create and cache) the TreeKey for child `index` (0-based).
   *
   * Use this for transaction signing — the child TreeKey is the spend key.
   * Call `getChildUses` / `setChildUses` to manage the watermark manually.
   */
  getChildTreeKey(index: number): TreeKey {
    this.assertChildIndex(index);
    return this.getOrCreateChildTreeKey(index);
  }

  /**
   * Get (or create and cache) the root identity TreeKey.
   *
   * Use this only for off-chain attestation signing, not for spending.
   */
  getRootTreeKey(): TreeKey {
    if (!this.cachedRootTreeKey) {
      this.cachedRootTreeKey = createUnifiedRootTreeKey(this.baseSeed);
    }
    return this.cachedRootTreeKey;
  }

  // ── Watermark access ─────────────────────────────────────────────────────────

  /** Number of times the root identity key has signed (for persistence). */
  getRootUses(): number { return this.rootUses; }

  /** Restore root watermark from a previously persisted value. */
  setRootUses(uses: number): void {
    if (uses < 0) throw new Error('uses must be non-negative');
    this.rootUses = uses;
  }

  /** Number of times child `index` has signed (for persistence). */
  getChildUses(index: number): number {
    this.assertChildIndex(index);
    return this.childUsesMap.get(index) ?? 0;
  }

  /** Restore child watermark from a previously persisted value. */
  setChildUses(index: number, uses: number): void {
    this.assertChildIndex(index);
    if (uses < 0) throw new Error('uses must be non-negative');
    this.childUsesMap.set(index, uses);
  }

  /** Number of child addresses configured for this wallet. */
  getChildCount(): number { return this.childCount; }

  /** Maximum one-time signatures available per slot (3 levels × 64 keys = 262 144). */
  getMaxUsesPerSlot(): number { return 64 * 64 * 64; }

  /**
   * Return a serialisable snapshot of all current watermark counters.
   *
   * Persist the returned object (e.g. to encrypted storage) and pass it back
   * to `restoreWatermarkState()` at the start of the next session so that no
   * one-time-use signing slot is ever reused.
   */
  getWatermarkState(): { rootUses: number; childUses: Record<number, number> } {
    const childUses: Record<number, number> = {};
    for (const [index, uses] of this.childUsesMap) {
      childUses[index] = uses;
    }
    return { rootUses: this.rootUses, childUses };
  }

  /**
   * Restore watermark counters from a previously persisted snapshot.
   *
   * Call this immediately after constructing the wallet to prevent slot reuse
   * across sessions. Out-of-range or invalid entries are silently skipped.
   */
  restoreWatermarkState(state: { rootUses?: number; childUses?: Record<number, number> }): void {
    if (typeof state?.rootUses === 'number' && state.rootUses >= 0) {
      this.rootUses = Math.floor(state.rootUses);
    }
    if (state?.childUses && typeof state.childUses === 'object') {
      for (const [key, uses] of Object.entries(state.childUses)) {
        const index = Number(key);
        if (Number.isInteger(index) && index >= 0 && index < this.childCount && typeof uses === 'number' && uses >= 0) {
          this.childUsesMap.set(index, Math.floor(uses));
        }
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private assertChildIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.childCount) {
      throw new Error(`Child index ${index} is out of range [0, ${this.childCount - 1}]`);
    }
  }

  private populateRootCache(): void {
    const pkBytes = this.getRootTreeKey().getPublicKey();
    this.cachedRootPublicKey = bytesToHex(pkBytes);
    this.cachedRootAddress = addressFromPublicKeyBytes(pkBytes);
  }

  private getOrCreateChildTreeKey(index: number): TreeKey {
    const cached = this.childTreeKeyCache.get(index);
    if (cached) return cached;
    const treeKey = createUnifiedChildTreeKey(this.baseSeed, index);
    this.childTreeKeyCache.set(index, treeKey);
    const pkBytes = treeKey.getPublicKey();
    this.childPubKeyCache.set(index, bytesToHex(pkBytes));
    this.childAddressCache.set(index, addressFromPublicKeyBytes(pkBytes));
    return treeKey;
  }
}

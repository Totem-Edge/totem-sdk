/**
 * @module se-server/seIdentity
 *
 * RFC-008 Phase 1 — SE identity and one-time WOTS signing.
 *
 * The SE is no longer a single reused WOTS leaf at index 0. It is a
 * `@totemsdk/root-identity` `UnifiedIdentityWallet`:
 *
 *   - a **root identity** (anchor) that publishes a versioned `OwnershipProof`
 *     over the child slot(s) the SE signs from, and
 *   - **child** TreeKey leaves, each of which signs at most one message.
 *
 * Leaf allocation is owned by `@totemsdk/wots-lease`'s `LocalLeaseProvider`
 * (durable watermark + journal): every signature leases the next leaf, signs,
 * then commits (or burns on failure). That makes reuse impossible across
 * restarts, concurrent requests and provider instances (AUD-003/AUD-004/
 * AUD-005), and the advertised identity is the actual signer's root
 * (AUD-025).
 *
 * The single child used today is written as "member `i` of a set" so the
 * federation phases (RFC-008 §5.8) are additive: the published identity is
 * already a root + a set of authorized leaves, and verification is already a
 * set-membership + signature check.
 */

import type { StorageAdapter } from '@totemsdk/core';
import type { OwnershipProof } from '@totemsdk/root-identity';

const WATERMARK_KEY = 'totem_se_identity_watermark:v1';
const DEFAULT_TREE_ID = 'se-identity';
const DEFAULT_PROOF_VERSION = 1;

/** Flat WOTS leaf index over the lease provider's 3-level index space. */
function flatLeafIndex(indices: { addressIndex: number; l1: number; l2: number }): number {
  const MAX_L = 64;
  return indices.addressIndex * MAX_L * MAX_L + indices.l1 * MAX_L + indices.l2;
}

export interface SeIdentityOptions {
  /** 32-byte SE seed. */
  readonly seed: Uint8Array;
  /** Durable storage for the lease watermark/journal and the identity watermark. */
  readonly storage: StorageAdapter;
  /** Lease tree id (default `se-identity`). */
  readonly treeId?: string;
  /** Child slot the SE signs from (default 0). Federation generalizes this to a member list. */
  readonly childIndex?: number;
  /** Monotonic identity-proof version (bump on rotation/revocation). */
  readonly proofVersion?: number;
  /** Reservation TTL for the lease (default 60s). */
  readonly ttlMs?: number;
}

/** Published SE identity: the root anchor and its authorized leaf set. */
export interface SePublishedIdentity {
  readonly rootAddress: string;
  readonly rootPublicKey: string;
  readonly proofVersion: number;
  readonly ownershipProof: OwnershipProof;
}

/** One SE signature: a leased WotsProof plus the identity version it belongs to. */
export interface SeSignature {
  /** `child` = off-chain transfer blind-signature; `root` = on-chain claim co-signature. */
  readonly kind: 'child' | 'root';
  readonly member: string;
  readonly childIndex: number;
  readonly address: string;
  readonly publicKey: string;
  /** Serialized `TreeSignature` hex (one-time leaf signature). */
  readonly signature: string;
  readonly message: string;
  readonly proofVersion: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Wallet = {
  getRootAddress(): string;
  getRootPublicKey(): string;
  getChildAddress(index: number): string;
  getChildPublicKey(index: number): string;
  getMaxUsesPerSlot(): number;
  signFromRoot(message: string): { address: string; publicKey: string; signature: string; message: string };
  signFromChild(index: number, message: string): { address: string; publicKey: string; signature: string; message: string };
  proveOwnership(indices: number[]): OwnershipProof;
  setChildUses(index: number, uses: number): void;
  setRootUses(uses: number): void;
  getWatermarkState(): unknown;
  restoreWatermarkState(state: unknown): void;
};
type WalletCtor = {
  new (seed: Uint8Array, childCount?: number): Wallet;
  verifyOwnershipProof(proof: OwnershipProof): boolean;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

async function loadWallet(): Promise<{ UnifiedIdentityWallet: WalletCtor }> {
  return import('@totemsdk/root-identity') as unknown as Promise<{ UnifiedIdentityWallet: WalletCtor }>;
}

async function loadLease(storage: StorageAdapter) {
  const mod = (await import('@totemsdk/wots-lease')) as unknown as {
    LocalLeaseProvider: new (storage: StorageAdapter) => {
      initialize(): Promise<void>;
      reserveKeyUse(params: { treeId: string; ttlMs?: number; payloadHash?: string }): Promise<{
        reservationId: string;
        indices: { addressIndex: number; l1: number; l2: number };
      }>;
      commitKeyUse(reservationId: string, txId: string): Promise<void>;
      burnReservation(reservationId: string, reason: string): Promise<void>;
    };
  };
  return new mod.LocalLeaseProvider(storage);
}

export class SeIdentity {
  private constructor(
    private readonly wallet: Wallet,
    private readonly walletCtor: WalletCtor,
    private readonly lease: Awaited<ReturnType<typeof loadLease>>,
    private readonly opts: Required<Pick<SeIdentityOptions, 'storage' | 'treeId' | 'childIndex' | 'proofVersion'>> & { ttlMs?: number },
    private ownershipProof: OwnershipProof,
  ) {}

  static async create(options: SeIdentityOptions): Promise<SeIdentity> {
    const opts = {
      storage: options.storage,
      treeId: options.treeId ?? DEFAULT_TREE_ID,
      childIndex: options.childIndex ?? 0,
      proofVersion: options.proofVersion ?? DEFAULT_PROOF_VERSION,
      ttlMs: options.ttlMs,
    };

    const { UnifiedIdentityWallet } = await loadWallet();
    // single child slot for the single-SE deployment; federates to a list later.
    const wallet = new UnifiedIdentityWallet(options.seed, opts.childIndex + 1);

    const savedWatermark = await opts.storage.get<unknown>(WATERMARK_KEY);
    if (savedWatermark) wallet.restoreWatermarkState(savedWatermark);

    const lease = await loadLease(opts.storage);
    await lease.initialize();

    const ownershipProof = wallet.proveOwnership([opts.childIndex]);
    // Persist the watermark immediately: proving ownership consumes a root leaf.
    await opts.storage.set(WATERMARK_KEY, wallet.getWatermarkState());

    return new SeIdentity(wallet, UnifiedIdentityWallet, lease, opts, ownershipProof);
  }

  getPublishedIdentity(): SePublishedIdentity {
    return {
      rootAddress: this.wallet.getRootAddress(),
      rootPublicKey: this.wallet.getRootPublicKey(),
      proofVersion: this.opts.proofVersion,
      ownershipProof: this.ownershipProof,
    };
  }

  /**
   * Lease the next child leaf, sign `message` with it, and commit (the
   * off-chain transfer blind-signature path). The leaf is burned, never reused,
   * if signing fails.
   */
  async sign(message: string): Promise<SeSignature> {
    return this.signChild(message);
  }

  /** Off-chain transfer blind-signature (leased child leaf). */
  async signChild(message: string): Promise<SeSignature> {
    return this.signLeased(message, 'child');
  }

  /** On-chain claim co-signature (leased root leaf; verifies against the published root). */
  async signRoot(message: string): Promise<SeSignature> {
    return this.signLeased(message, 'root');
  }

  private async signLeased(message: string, kind: 'child' | 'root'): Promise<SeSignature> {
    const treeId = kind === 'root' ? `${this.opts.treeId}:root` : this.opts.treeId;
    const reservation = await this.lease.reserveKeyUse({
      treeId,
      ...(this.opts.ttlMs !== undefined ? { ttlMs: this.opts.ttlMs } : {}),
    });

    try {
      const use = flatLeafIndex(reservation.indices);
      const maxUses = this.wallet.getMaxUsesPerSlot();
      if (use >= maxUses) {
        throw new Error(
          `SE leaf space exhausted (use ${use} >= capacity ${maxUses}); rotate the identity proof version / child slot`,
        );
      }

      // Sign exactly at the leased leaf, never below it.
      let proof: { address: string; publicKey: string; signature: string; message: string };
      if (kind === 'root') {
        this.wallet.setRootUses(use);
        proof = this.wallet.signFromRoot(message);
      } else {
        this.wallet.setChildUses(this.opts.childIndex, use);
        proof = this.wallet.signFromChild(this.opts.childIndex, message);
      }
      await this.opts.storage.set(WATERMARK_KEY, this.wallet.getWatermarkState());
      await this.lease.commitKeyUse(reservation.reservationId, proof.address);

      return {
        kind,
        member: `se:${this.getPublishedIdentity().rootPublicKey.slice(0, 16)}`,
        childIndex: this.opts.childIndex,
        address: proof.address,
        publicKey: proof.publicKey,
        signature: proof.signature,
        message: proof.message,
        proofVersion: this.opts.proofVersion,
      };
    } catch (err) {
      await this.lease.burnReservation(reservation.reservationId, err instanceof Error ? err.message : 'sign failed');
      throw err;
    }
  }

  /**
   * Verify an SE signature. A `child` signature must be a member of the
   * member's root `OwnershipProof`; a `root` signature must be the published
   * root identity itself. Either way the one-time signature must verify over
   * `message`.
   */
  static async verify(
    message: string,
    signature: SeSignature,
    published: SePublishedIdentity,
  ): Promise<boolean> {
    const core = (await import('@totemsdk/core')) as unknown as {
      verifySignatureDetailed(address: string, message: string, signature: string, publicKey: string): { valid: boolean };
    };

    if (signature.proofVersion !== published.proofVersion) return false;
    if (signature.message !== message) return false;

    if (signature.kind === 'root') {
      if (signature.publicKey !== published.rootPublicKey) return false;
      if (signature.address !== published.rootAddress) return false;
    } else {
      const { UnifiedIdentityWallet } = await loadWallet();
      if (!UnifiedIdentityWallet.verifyOwnershipProof(published.ownershipProof)) return false;
      if (!published.ownershipProof.childPublicKeys.includes(signature.publicKey)) return false;
      if (!published.ownershipProof.childAddresses.includes(signature.address)) return false;
    }

    try {
      return core.verifySignatureDetailed(
        signature.address,
        message,
        signature.signature,
        signature.publicKey,
      ).valid === true;
    } catch {
      return false;
    }
  }
}

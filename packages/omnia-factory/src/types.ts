import type { OmniaChannel } from '@totemsdk/omnia';
import type { ChannelSigner } from '@totemsdk/omnia';
import type { SigningIndices } from '@totemsdk/wots-lease';

// Re-export OmniaChannel for convenience so callers import only from this package.
export type { OmniaChannel };

export type FactoryStatus = 'opening' | 'active' | 'closing' | 'closed';

// ─── Participants ─────────────────────────────────────────────────────────────

export interface FactoryParticipant {
  partyId: string;
  publicKeyDigest: string;
  addressIndex: number;
  /** Amount this participant contributes to the factory. */
  contributionAmount: bigint;
  /**
   * UTXO coin ID this participant contributes to the factory funding TX.
   * When ALL participants supply a fundingCoinId and a chainProvider is given
   * to `createFactory`, the N-input → 1-output funding TX is built, mined,
   * and broadcast on-chain.  Omit for in-memory / test-only factories.
   */
  fundingCoinId?: string;
  /** Address to receive funds on cooperative settlement. Falls back to publicKeyDigest. */
  settlementAddress?: string;
}

// ─── Lease bundle ─────────────────────────────────────────────────────────────

/**
 * Minimal lease operations required by the factory signing cycle.
 *
 * This is a structural subset of `WotsLeaseProvider` from `@totemsdk/wots-lease`.
 * Any real `WotsLeaseProvider` satisfies this interface.  In tests, only these
 * three methods need to be mocked — no other watermark or sync methods required.
 */
export interface FactoryLeaseOps {
  reserveKeyUse(params: {
    treeId: string;
    purpose?: string;
    payloadHash?: string;
    ttlMs?: number;
  }): Promise<{ reservationId: string; indices: SigningIndices; expiresAt: number }>;
  commitKeyUse(reservationId: string, txId: string): Promise<void>;
  burnReservation(reservationId: string, reason: string): Promise<void>;
}

/**
 * Bundle of `FactoryLeaseOps` + `ChannelSigner` for one factory participant.
 *
 * In production, wire a real `WotsLeaseProvider` (which satisfies `FactoryLeaseOps`
 * structurally) and a `ChannelSigner` backed by the participant's WOTS tree key.
 * In tests, provide mock implementations of all three methods on `leaseProvider`.
 *
 * The optional `verify` callback overrides the default `wotsVerifyDigest` from
 * `@totemsdk/core`, allowing test code to inject a no-op verifier without
 * requiring real WOTS key material.
 */
export interface WotsLeaseBundle {
  leaseProvider: FactoryLeaseOps;
  signer: ChannelSigner;
  /**
   * Optional verify override. When absent, the implementation falls back to
   * `wotsVerifyDigest(sig, commitment, fromHex(pkd))` from `@totemsdk/core`.
   *
   * Signature: `(sig, commitment, pkd_hex) => boolean`
   */
  verify?: (sig: Uint8Array, commitment: Uint8Array, pkdHex: string) => boolean;
}

// ─── Factory state ────────────────────────────────────────────────────────────

export type FactorySignature = Uint8Array;

export interface FactoryLogEntry {
  sequence: number;
  timestamp: number;
  event: 'create' | 'accept' | 'reallocate' | 'virtual_open' | 'virtual_close' | 'dispute';
  allocations: Record<string, bigint>;
  virtualChannelIds: string[];
}

export interface ChannelFactory {
  factoryId: string;
  participants: FactoryParticipant[];
  totalValue: bigint;
  tokenId: string;

  /** Current committed allocations: sum must equal `totalValue − sum(vc.totalValue)`. */
  allocations: Record<string, bigint>;
  /** Currently open virtual channels backed by this factory's shared UTXO. */
  virtualChannels: OmniaChannel[];

  /** Monotonically increasing. Incremented on every committed state transition. */
  currentSequence: number;
  status: FactoryStatus;
  stateLog: FactoryLogEntry[];

  /** N-of-N MULTISIG KISSVM script for the factory's on-chain UTXO. */
  fundingScript: string;
  /** Script address (SHA3-256 of normalised script). */
  fundingAddress: string;
  /** TxPoW ID of the factory funding TX (hex) — set after createFactory mines the TX. */
  fundingTxId?: string;
  /** CoinID of the factory's shared UTXO — required for settlement and dispute. */
  fundingCoinId?: string;

  /**
   * Hex-encoded commitment (TX draft digest or state hash) that all participants
   * must sign during the current opening or signing round.
   * Set by `createFactory`; cleared when the factory becomes 'active'.
   */
  pendingCommitment?: string;
  /**
   * Partial signatures collected so far for the pending commitment.
   * Keyed by `partyId`.  Cleared when all N parties have signed.
   */
  pendingSignatures: Record<string, FactorySignature>;
}

// ─── Settlement & dispute payloads ───────────────────────────────────────────

export interface FactorySettlementPayload {
  factoryId: string;
  sequence: number;
  /** Serialized settlement OmniaTxDraft (hex) — built by `serializeTxDraft` from @totemsdk/omnia. */
  settlementTxHex: string;
  finalAllocations: Record<string, bigint>;
  /** SHA3-256 TxPoW ID (hex) — populated when closeFactory is given a chainProvider. */
  txpowId?: string;
}

export interface FactoryDisputePayload {
  factoryId: string;
  latestSequence: number;
  fundingTxId: string;
  allocations: Record<string, bigint>;
  virtualChannelIds: string[];
  stateLog: FactoryLogEntry[];
  evidence: string;
}

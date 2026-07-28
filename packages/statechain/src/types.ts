export type StatechainStatus = 'active' | 'claiming' | 'claimed' | 'abandoned';

export interface SEClient {
  blindSign(chainId: string, commitmentHex: string): Promise<string>;
  revokeKey(chainId: string, opts: {
    previousOwnerPartyId: string;
    previousOwnerPkd: string;
    newOwnerPartyId: string;
    newOwnerPkd: string;
    newReclaimTxHex: string;
  }): Promise<void>;
  isRevoked(ownerPartyId: string): Promise<boolean>;
  /**
   * Optional: register a newly locked coin with the SE.
   * Called during `createStateChain` when present.
   */
  registerChain?(
    chainId: string,
    coinId: string,
    ownerPublicKeyDigest: string,
    lockingScript: string,
  ): Promise<void>;
}

/**
 * StatechainOwner — owner identity and signing capability.
 *
 * `sign(message)` signs a `computeTransactionDigest` byte-array with this
 * owner's WOTS key. Used for: lock TX, reclaimTx building, cooperative claim.
 *
 * Creation-time fields (only required on the owner passed to `createStateChain`):
 *   `address`  — the coin's current address (spending address of the input UTXO).
 *                If absent, `chainProvider.getCoin(coinId)` is used as fallback.
 *   `tokenId`  — token ID of the coin being locked.
 *   `amount`   — coin amount in MIN base units.
 * These three fields are stripped from the stored `StateChain.currentOwner`.
 *
 * `transferKeySeed` — WOTS seed (hex) for this owner's key slot.
 * Moved into `TransferRecord.transferKey` on outbound transfer, then zeroed
 * in-place on the original owner object so the secret does not linger in hot state.
 */
export interface StatechainOwner {
  partyId: string;
  publicKeyDigest: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
  transferKeySeed?: string;
  /** Source coin address — required for the lock TX in createStateChain. */
  address?: string;
  /** Coin token ID — required when creating a new statechain. */
  tokenId?: string;
  /** Coin amount in MIN base units — required when creating a new statechain. */
  amount?: bigint;
}

/**
 * TransferRecord — one entry per ownership hop in transferHistory.
 *
 * `transferKey`    — prior owner's WOTS seed (hex) for custody-lineage proofs.
 * `ownerSignature` — hex of the old owner's WOTS sig over `signedDigest`.
 *   Stored so `verifyStateChain` can verify per-hop old-owner signatures.
 * `signedDigest`   — hex of computeTransactionDigest(stateUpdateTx).
 *   Bound to `txBodyHex` — `verifyStateChain` recomputes this digest from
 *   `txBodyHex` and rejects records where they do not match.
 * `txBodyHex`      — hex of the raw serialized Transaction bytes (NOT the full
 *   TxPoW). Used by `verifyStateChain` to prevent signature grafting: the
 *   stored `signedDigest` must equal sha3_256(fromHex(txBodyHex)).
 * `txHex`          — full TxPoW hex of the on-chain state-update TX.
 */
export interface TransferRecord {
  from: string;
  to: string;
  fromPublicKeyDigest: string;
  toPublicKeyDigest: string;
  blindedSignature: string;
  /** Prior owner's WOTS seed for custody lineage verification. */
  transferKey: string;
  /** Hex of old owner's signature over signedDigest. */
  ownerSignature: string;
  /** Hex of sha3_256(txBodyHex) — the TX body digest signed by old owner + SE. */
  signedDigest: string;
  /**
   * Hex of the raw serialized Transaction bytes (not TxPoW envelope).
   * `verifyStateChain` recomputes sha3_256(txBodyHex) and asserts it equals
   * `signedDigest`, binding all signatures to the specific TX data.
   */
  txBodyHex: string;
  /** Full TxPoW hex of the on-chain state-update TX. */
  txHex: string;
  timestamp: number;
}

export interface ClaimPayload {
  chainId: string;
  coinId: string;
  claimAddress: string;
  txHex: string;
  txpowId?: string;
}

export interface AbandonedProof {
  timelockBlock?: number;
  evidence?: string;
}

/**
 * StateChain — in-memory state of a Mercury-protocol statechain UTXO.
 *
 * `lockingAddress` — same for all transfers (STATE(0) design).
 * `coinId`         — the CURRENT on-chain coin ID (updated per transfer hop).
 *   Starts as the LOCK TX output coin ID (not the original input coinId).
 * `reclaimTx`      — pre-signed unilateral reclaim TX for the CURRENT owner.
 *   Pre-built at createStateChain; rebuilt on every transferOwnership.
 *   Valid after @COINAGE >= reclaimTimelock without SE cooperation.
 * `reclaimAddress` — SIGNEDBY(currentOwnerPkd) output address of reclaimTx.
 */
export interface StateChain {
  chainId: string;
  coinId: string;
  tokenId: string;
  amount: bigint;
  sePublicKey: string;
  lockingScript: string;
  lockingAddress: string;
  currentOwner: StatechainOwner;
  transferHistory: TransferRecord[];
  status: StatechainStatus;
  reclaimTx: string;
  reclaimAddress: string;
  reclaimTimelock: number;
  createdAt: number;
}

export interface StatechainLeaseOps {
  reserveKeyUse(keyIndex: number): Promise<{ reservationId: string }>;
  commitKeyUse(reservationId: string): Promise<void>;
  burnReservation(reservationId: string): Promise<void>;
}

/**
 * StatechainLeaseProvider — operational context for SE-based flows.
 *
 * Used by `createStateChain`, `claimOwnership`, and `reclaimAbandoned`.
 *
 * `broadcast`  — if present, cooperative claim / reclaim broadcast the TxPoW.
 * `getTip`     — if present alongside `proof.timelockBlock`, `reclaimAbandoned`
 *   validates the current block height before broadcasting.
 * `verifyBlindSig` — test override for SE blind-sig verification.
 */
export interface StatechainLeaseProvider {
  seClient: SEClient;
  leaseOps?: StatechainLeaseOps;
  broadcast?: (txHex: string) => Promise<{ txpowid?: string; success?: boolean }>;
  getTip?: () => Promise<{ block: number } | undefined>;
  verifyBlindSig?: (sig: string, commitment: Uint8Array, sePkdHex: string) => boolean;
}

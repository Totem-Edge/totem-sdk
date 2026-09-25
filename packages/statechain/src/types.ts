export type StatechainStatus = 'active' | 'claiming' | 'claimed' | 'abandoned';

/**
 * SE signature envelope (RFC-008). Structural mirror of the envelope emitted by
 * `@totemsdk/se-server`'s `SeIdentity`. `kind` is `child` for off-chain transfer
 * blind-signatures (authorized by the SE root's `OwnershipProof`) and `root` for
 * on-chain claim co-signatures (verified against the published root identity).
 */
export interface SESignature {
  kind: 'child' | 'root';
  member: string;
  childIndex: number;
  address: string;
  publicKey: string;
  /** Serialized one-time `TreeSignature` hex. */
  signature: string;
  message: string;
  proofVersion: number;
}

/**
 * Root-identity `OwnershipProof` shape (RFC-008) as published by an SE. The root
 * key signs a canonical commitment to `childPublicKeys`; a child leaf is
 * authorized when its public key appears in that set.
 */
export interface SeOwnershipProof {
  rootAddress: string;
  rootPublicKey: string;
  childAddresses: string[];
  childPublicKeys: string[];
  rootProof: { address: string; publicKey: string; signature: string; message: string };
  timestamp: string;
}

export interface SEClient {
  /**
   * Blind-sign a commitment. Returns the SE signature envelope (RFC-008): a
   * leased one-time leaf authorized by the SE root's `OwnershipProof`.
   */
  blindSign(chainId: string, commitmentHex: string): Promise<SESignature>;
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
 * StatechainOwner — owner identity and Minima-faithful TreeKey signing
 * capability (RFC-009).
 *
 * `signTree(message)` signs a `computeTransactionDigest` byte-array with this
 * owner's TreeKey, producing a root-bound Minima `TreeSignature`. Used for the
 * lock TX, reclaim TX, state-update TX, and cooperative claim. Minima binds the
 * signer's **root** public key (`SignatureProof.getRootPublicKey()`), so
 * `publicKeyDigest` carries that root — it is the value bound by
 * `STATE(0)`/`SIGNEDBY`/`MULTISIG` in the locking script.
 *
 * Creation-time fields (only required on the owner passed to `createStateChain`):
 *   `address`  — the coin's current address (spending address of the input UTXO).
 *                If absent, `chainProvider.getCoin(coinId)` is used as fallback.
 *   `tokenId`  — token ID of the coin being locked.
 *   `amount`   — coin amount in MIN base units.
 * These three fields are stripped from the stored `StateChain.currentOwner`.
 */
export interface StatechainOwner {
  partyId: string;
  /** TreeKey **root** public key (32-byte hex) — the owner's Minima identity. */
  publicKeyDigest: string;
  /**
   * Sign a digest with this owner's TreeKey. The returned `TreeSignature` is
   * root-bound and serialized via `serializeTreeSignature` into the witness.
   */
  signTree(message: Uint8Array): Promise<import('@totemsdk/core').TreeSignature>;
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
 * `ownerSignature` — hex of the old owner's serialized Minima `TreeSignature`
 *   over `signedDigest` (root-bound). Stored so `verifyStateChain` can verify
 *   per-hop old-owner authorization.
 * `seSignature`    — the SE's leased-leaf signature envelope over `signedDigest`.
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
  /**
   * RFC-008: the SE signature envelope. Carries the leased leaf (`kind`,
   * `publicKey`, `address`, `proofVersion`) so `verifyStateChain` can check leaf
   * authorization against the SE root's `OwnershipProof`.
   */
  seSignature: SESignature;
  /** Hex of old owner's serialized Minima `TreeSignature` over signedDigest. */
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
  /**
   * AUD-012: the TxPoW header `timeMilli` used when `txHex` was built, so the
   * TxPoW can be reconstructed and bound to the signed body. Absent on records
   * created before this field (legacy `txHex` binding is skipped).
   */
  txTimeMilli?: number;
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
  /**
   * The locked coin id at creation (the LOCK TX output spent by the first
   * transfer). Required to bind the first transfer's `txBodyHex` to its
   * ownership labels (AUD-012); absent on chains created before this field.
   */
  genesisCoinId?: string;
  tokenId: string;
  amount: bigint;
  sePublicKey: string;
  /**
   * RFC-008: the SE's published identity — the root-identity `OwnershipProof`
   * that authorizes the leased child leaves used for transfer blind-signatures.
   * When present, `verifyStateChain` verifies leaf authorization against it.
   */
  seOwnershipProof?: SeOwnershipProof;
  /** RFC-008: monotonic SE identity-proof version. */
  seProofVersion?: number;
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

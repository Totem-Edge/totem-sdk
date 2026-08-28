/**
 * @totemsdk/wots-lease — canonical v3 watermark types and WotsLeaseProvider interface
 */

import type { LocalLeaseProvider } from './local.js';
import type { StorageAdapter } from '@totemsdk/core';

export type UnavailableReason = 'reserved' | 'committed' | 'burned' | 'reserved-expired';

export interface SigningIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export type LeaseStatus = 'pending' | 'active' | 'expired' | 'finalized' | 'cancelled';

export interface TreeWatermark {
  treeId: string;
  deviceId?: string;
  branchId?: string;
  addressCursor: number;
  l1Cursor: number;
  l2Cursor: number;
  unavailable: Record<number, UnavailableReason>;
  lastSyncTimestamp?: number;
}

export interface WotsWatermarkState {
  version: 3;
  trees: Record<string, TreeWatermark>;
}

export interface QuorumAttestation {
  peerId: string;
  indices: SigningIndices;
  expiresAt: number;
  signature?: string;
}

/**
 * Identity used to authenticate lease certificates (Layer 4/5).
 *
 * A certificate's `signature` is a signature over the canonical certificate
 * payload (see certificate.ts). Verifiers reject unsigned certificates.
 */
export interface CertificateSigner {
  /** Hex (0x-prefixed or bare) public key digest of the issuing identity. */
  publicKeyDigest: string;
  /** Identity label stored on issued certificates via `issuedBy`. */
  name?: string;
  /** Sign the canonical certificate message. */
  sign(message: Uint8Array): Promise<Uint8Array>;
  /** Verify a signature over the canonical certificate message. */
  verify?(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
}

export interface LeaseCertificate {
  reservationId: string;
  treeId: string;
  branchId?: string;
  deviceId?: string;
  indices: SigningIndices;
  purpose?: string;
  payloadHash?: string;
  issuedBy: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
  /** Layer 4 — quorum attestations collected from P2P peers. */
  attestations?: QuorumAttestation[];
  /** Layer 5 — content hash of the on-chain watermark TX (sha3-256 of TxPoW bytes). */
  txpowid?: string;
}

export interface LeaseReservation {
  reservationId: string;
  indices: SigningIndices;
  expiresAt: number;
  certificate?: LeaseCertificate;
  leaseToken?: string;
}

export interface ReserveParams {
  treeId: string;
  branchId?: string;
  purpose?: string;
  deviceId?: string;
  ttlMs?: number;
  payloadHash?: string;
  valueHint?: string;
}

export interface LocalWatermark {
  treeId: string;
  addressCursor: number;
  l1Cursor: number;
  l2Cursor: number;
  unavailableCount: number;
  capacity: number;
  lastSyncTimestamp?: number;
}

export interface ConflictRecord {
  treeId: string;
  localIndex: number;
  remoteIndex: number;
  timestamp: number;
}

export interface SyncResult {
  synced: boolean;
  conflicts: ConflictRecord[];
  advancedTo?: SigningIndices;
}

export interface WotsLeaseProvider {
  reserveKeyUse(params: ReserveParams): Promise<LeaseReservation>;
  commitKeyUse(reservationId: string, txId: string): Promise<void>;
  burnReservation(reservationId: string, reason: string): Promise<void>;
  getLocalWatermark(treeId: string): Promise<LocalWatermark>;
  publishWatermark(treeId: string): Promise<void>;
  syncLeaseJournal(): Promise<SyncResult>;
  verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean>;
}

export interface JournalEntry {
  treeId: string;
  branchId: string;
  wotsIndex: number;
  indices: SigningIndices;
  status: 'reserved' | 'committed' | 'burned' | 'reserved-expired';
  reservationId?: string;
  payloadHash?: string;
  txId?: string;
  timestamp: number;
  deviceId: string;
  previousHash?: string;
  hash?: string;
}

export interface DeviceKeyRange {
  deviceId: string;
  startAddressIndex: number;
  endAddressIndex: number;
  addressCount: number;
}

export interface PersonalLeaseNodeConfig {
  nodeUrl: string;
  nodePubkey: string;
  authToken?: string;
  /**
   * Identity that authenticates certificates issued by this node.
   * When set, `verifyLeaseCertificate` performs cryptographic signature
   * verification; without it, verification is issuer-only (no signature check).
   */
  certificateSigner?: CertificateSigner;
}

/**
 * Layer 4 — P2P quorum lease coordination.
 *
 * `peers` is the set of quorum members this device coordinates with. Each
 * entry is a transport-agnostic RPC handle: the provider sends the same
 * LEASE_RESERVE / LEASE_COMMIT / LEASE_BURN wire messages used by the
 * lookup protocol, so any peer that speaks that protocol can participate
 * (lookup nodes, other devices, or in-memory test peers).
 */
export interface QuorumPeer {
  peerId: string;
  request(
    message: {
      type: 'LEASE_RESERVE' | 'LEASE_COMMIT' | 'LEASE_BURN' | 'LEASE_WATERMARK';
      payload: Record<string, unknown>;
    },
    timeoutMs?: number,
  ): Promise<{ type: string; payload: Record<string, unknown> }>;
}

export interface P2PQuorumLeaseProviderConfig {
  /** Quorum members to coordinate with (excluding self). */
  peers: QuorumPeer[];
  /** Minimum attestations required for a reservation to be considered quorum-approved. Default: 1. */
  minAttestations?: number;
  /** Local provider used for the authoritative local watermark + journal. */
  local: LocalLeaseProvider;
  /** Timeout per peer request. Default: 5_000. */
  requestTimeoutMs?: number;
  /** Require quorum approval on commit as well as reserve. Default: false. */
  requireQuorumOnCommit?: boolean;
  /**
   * Identity that authenticates issued certificates. When set, reserved
   * certificates carry a real signature; without it, certificates are
   * issued unsigned and will FAIL verification.
   */
  certificateSigner?: CertificateSigner;
}

/**
 * Layer 5 — on-chain watermark anchoring.
 *
 * `chain` is any ChainStateProvider (hosted, Minima RPC, or lookup node).
 * The provider spends a dedicated watermark coin whose STATE(0) holds the
 * flat watermark cursor; every publish advances it on-chain so the watermark
 * is verifiable by third parties without trusting this device.
 */
export interface OnchainWatermarkProviderConfig {
  /** Chain access for coin queries, proofs, and broadcasting. */
  chain: {
    getCoin(coinId: string): Promise<{ coinid: string; address: string; amount: string; tokenid: string; state?: unknown[] } | null>;
    getProof(coinId: string): Promise<{ data: unknown }>;
    broadcastTxPoW(txpowHex: string): Promise<{ success: boolean; txpowid?: string; message?: string }>;
    getTip?(): Promise<{ block: number }>;
  };
  /** Coin ID of the dedicated watermark coin. */
  watermarkCoinId: string;
  /** Address the watermark coin currently sits at (spending address). */
  watermarkAddress: string;
  /** Token ID of the watermark coin. Default: '0x00'. */
  tokenId?: string;
  /** Amount of the watermark coin in MIN base units. Default: '1'. */
  amount?: string;
  /** Local provider used for the authoritative local watermark + journal. */
  local: LocalLeaseProvider;
  /** Signer for the watermark coin's script (SIGNEDBY digest). Also authenticates issued certificates. */
  signer: {
    publicKeyDigest: string;
    sign(message: Uint8Array): Promise<Uint8Array>;
    verify?(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
  };
  /** Port holding the flat watermark cursor in the coin state. Default: 0. */
  statePort?: number;
  /** Minimum blocks between on-chain publishes (rate limit). Default: 1. */
  minBlocksBetweenPublishes?: number;
  /**
   * Optional durable storage for the watermark coin's identity. When set, the
   * provider persists the advanced watermark coin ID after each publish so the
   * rollover survives restarts. Default: in-memory only.
   */
  storage?: StorageAdapter;
}

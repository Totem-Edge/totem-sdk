import type { VtxoClaimPolicy } from './claim-policy.js';
import type { VtxoExitEntitlement } from './exit-entitlement.js';

export type VtxoId = string;

export type VtxoStatus =
  | 'active' | 'transferred' | 'split' | 'merged'
  | 'refreshed' | 'exiting' | 'exited' | 'spent' | 'expired' | 'invalid'
  /**
   * OMN-041: issued but not yet transferable. A VTXO is provisional until the
   * operator co-signs its receipt and the pool backing is verified.
   */
  | 'provisional';

export type VtxoOp =
  | 'mint' | 'transfer' | 'split' | 'merge'
  | 'refresh' | 'exit_initiated' | 'exit_complete' | 'spent';

export interface VtxoPoolPolicy {
  minAmount: bigint;
  maxAmount: bigint;
  maxMergeInputs: number;
  maxSplitOutputs: number;
  exitTimelockSeconds: number;
}

/** One VTXO leaf committed by the pool's membership set (OMN-002). */
export interface VtxoPoolMember {
  vtxoId: VtxoId;
  /** `computeVtxoLeaf(vtxo)` — the exact leaf committed by the tree. */
  leaf: string;
  /** Epoch in which this leaf entered the pool set. */
  epoch: number;
}

/**
 * A published epoch root. The pool keeps every root it has published so a
 * proof minted in an earlier epoch stays verifiable after later batches.
 */
export interface VtxoEpochRoot {
  epoch: number;
  root: string;
  batchId: string;
  vtxoIds: VtxoId[];
}

/**
 * OMN-041: authoritative on-chain backing for a pool. Created only from a
 * verified deposit; `amount` is in atoms.
 */
export interface VtxoPoolBacking {
  coinId: string;
  amount: bigint;
  tokenId: string;
  confirmations: number;
  verifiedAt: number;
  address?: string;
}

export interface OmniaVtxoPool {
  poolId: string;
  operator: string;
  tokenId: string;
  totalCapacity: bigint;
  availableCapacity: bigint;
  epoch: number;
  /**
   * Root of the pool-wide membership set (`members`). Appended to by every
   * batch; earlier epoch roots are retained in `epochRoots`.
   */
  commitmentRoot: string;
  /**
   * Append-only membership set. `mintVtxo` appends a member and rebuilds the
   * tree instead of replacing the root with a single-leaf tree (OMN-002).
   */
  members: VtxoPoolMember[];
  /** Every root the pool has published, oldest first. */
  epochRoots: VtxoEpochRoot[];
  createdAt: number;
  policy: VtxoPoolPolicy;
  /** OMN-041: verified on-chain coin backing this pool's capacity. */
  backing?: VtxoPoolBacking;
  /**
   * OMN-055: ids consumed by a transfer/refresh/exit. A consumed VTXO can
   * never re-enter the membership set.
   */
  consumedVtxoIds?: string[];
}

export interface VtxoProof {
  leaf: string;
  root: string;
  siblings: string[];
  positions: Array<'left' | 'right'>;
  epoch: number;
  batchId: string;
}

export interface VtxoHistoryEntry {
  op: VtxoOp;
  at: number;
  from?: string;
  to?: string;
  relatedIds?: VtxoId[];
  meta?: Record<string, unknown>;
}

export interface OmniaVtxo {
  vtxoId: VtxoId;
  poolId: string;
  owner: string;
  amount: bigint;
  tokenId: string;
  status: VtxoStatus;
  epoch: number;
  proof: VtxoProof;
  history: VtxoHistoryEntry[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  /** The on-chain funding proof recorded at mint (deep proof, #28). */
  fundingProof?: unknown;
  /** Opt-in multiparty claim policy (M8–M18). */
  claimPolicy?: VtxoClaimPolicy;
  /** V1: independently executable exit package delivered to the owner. */
  exitEntitlement?: VtxoExitEntitlement;
  /** Set when an exit draft consumed this VTXO — prevents double-exit. */
  exitConsumedAt?: number;
  exitReceiptId?: string;
  /** The exit transaction's txpowId (set once the exit is broadcast). */
  exitTxpowId?: string;
  /**
   * OMN-089: how far the exit has progressed. `broadcast` means only that a
   * transaction id is known; `confirmed` means chain evidence accepted it;
   * `settled` is the final transition.
   */
  exitState?: VtxoExitState;
  /** Block that confirmed the exit, when the verifier supplied one. */
  exitBlock?: number;
}

export type VtxoExitState = 'broadcast' | 'confirmed' | 'settled';

export interface VtxoTransfer {
  inputId: VtxoId;
  outputId: VtxoId;
  changeId?: VtxoId;
  from: string;
  to: string;
  amount: bigint;
  changeAmount?: bigint;
  poolId: string;
  tokenId: string;
  at: number;
}

export interface VtxoOperatorReceipt {
  receiptId: string;
  poolId: string;
  op: VtxoOp;
  inputIds: VtxoId[];
  outputIds: VtxoId[];
  epoch: number;
  at: number;
  signature: string;
  draftType?: string;
}

export interface CreatePoolParams {
  operator: string;
  tokenId: string;
  totalCapacity: bigint;
  policy?: Partial<VtxoPoolPolicy>;
  nonce: string;
}

export interface MintVtxoParams {
  owner: string;
  amount: bigint;
  nonce: string;
  expiresAt?: number;
  /** The on-chain funding proof (deep proof) recorded at mint. */
  fundingProof?: unknown;
}

export interface TransferVtxoParams {
  recipient: string;
  amount: bigint;
  nonce: string;
  changeNonce?: string;
  /** V1: exit package the recipient must receive with the claim. */
  exitEntitlement?: VtxoExitEntitlement;
}

export interface SplitVtxoParams {
  amounts: bigint[];
  nonces: string[];
}

export interface MergeVtxosParams {
  nonce: string;
  owner: string;
}

export interface RefreshVtxoParams {
  newEpoch: number;
  nonce: string;
}

export interface MintResult {
  pool: OmniaVtxoPool;
  vtxo: OmniaVtxo;
  receipt: VtxoOperatorReceipt;
}

export interface TransferResult {
  input: OmniaVtxo;
  output: OmniaVtxo;
  change?: OmniaVtxo;
  transfer: VtxoTransfer;
  /**
   * True only when `output.exitEntitlement` was verified against the *output*
   * VTXO (recipient owner, output id, output amount) in this call. A transfer
   * without an entitlement is never exit-ready (OMN-003).
   */
  exitReady: boolean;
  /** The recipient-bound entitlement, when one was supplied and verified. */
  exitEntitlement?: VtxoExitEntitlement;
}

export interface SplitResult {
  input: OmniaVtxo;
  outputs: OmniaVtxo[];
}

export interface MergeResult {
  inputs: OmniaVtxo[];
  output: OmniaVtxo;
}

export interface RefreshResult {
  old: OmniaVtxo;
  refreshed: OmniaVtxo;
}

export interface ExitDraft {
  vtxoId: VtxoId;
  poolId: string;
  owner: string;
  amount: bigint;
  tokenId: string;
  draftType: 'vtxo-exit';
  timelockSeconds: number;
  createdAt: number;
  /** The verified share this exit is capped at (the VTXO's amount). */
  verifiedShare: bigint;
}

/**
 * OMN-042: chain evidence for an exit transaction. Produced by a trusted
 * verifier — never by the RPC caller.
 */
export interface VtxoExitEvidence {
  valid: boolean;
  reason?: string;
  /** Address paid by the exit output. */
  owner?: string;
  /** Paid amount in atoms. */
  amount?: bigint;
  tokenId?: string;
  /** Depth of the exit transaction at verification time. */
  confirmations?: number;
}

export type VtxoExitVerifier = (request: {
  vtxo: OmniaVtxo;
  txpowId: string;
}) => Promise<VtxoExitEvidence>;

export interface VerifyVtxoResult {
  valid: boolean;
  errors: string[];
}

export interface OmniaVtxoStore {
  savePool(pool: OmniaVtxoPool): Promise<void>;
  getPool(poolId: string): Promise<OmniaVtxoPool | undefined>;
  saveVtxo(vtxo: OmniaVtxo): Promise<void>;
  getVtxo(vtxoId: VtxoId): Promise<OmniaVtxo | undefined>;
  listVtxos(poolId?: string): Promise<OmniaVtxo[]>;
  markVtxoSpent(vtxoId: VtxoId, now?: number): Promise<void>;
}

export interface OmniaVtxoOperator {
  poolId: string;
  sign(data: Uint8Array): Promise<string>;
  verify(data: Uint8Array, sig: string): Promise<boolean>;
}

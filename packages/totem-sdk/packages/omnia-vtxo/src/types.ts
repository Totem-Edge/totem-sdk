export type VtxoId = string;

export type VtxoStatus =
  | 'active' | 'transferred' | 'split' | 'merged'
  | 'refreshed' | 'exiting' | 'exited' | 'spent' | 'expired' | 'invalid';

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

export interface OmniaVtxoPool {
  poolId: string;
  operator: string;
  tokenId: string;
  totalCapacity: bigint;
  availableCapacity: bigint;
  epoch: number;
  commitmentRoot: string;
  createdAt: number;
  policy: VtxoPoolPolicy;
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
}

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
}

export interface TransferVtxoParams {
  recipient: string;
  amount: bigint;
  nonce: string;
  changeNonce?: string;
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
  draftType: 'mock-exit';
  timelockSeconds: number;
  createdAt: number;
}

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

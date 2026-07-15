export type LiquidityBondVerifyCode =
  | 'OK'
  | 'POOL_MANIFEST_INVALID'
  | 'POOL_MANIFEST_EXPIRED'
  | 'POOL_IDENTITY_NOT_AUTHORISED'
  | 'LP_IDENTITY_NOT_AUTHORISED'
  | 'PROVIDER_REF_INVALID'
  | 'COMMITMENT_INVALID'
  | 'COMMITMENT_EXPIRED'
  | 'POSITION_INVALID'
  | 'POSITION_NOT_ACTIVE'
  | 'POSITION_LOCKED'
  | 'POSITION_DEPLETED'
  | 'RECEIPT_INVALID'
  | 'RECEIPT_OWNER_NOT_AUTHORISED'
  | 'ASSET_NOT_ACCEPTED'
  | 'AMOUNT_TOO_SMALL'
  | 'LOCK_TERMS_INVALID'
  | 'ALLOCATION_INVALID'
  | 'ALLOCATION_EXCEEDS_POSITION'
  | 'FEE_RECORD_INVALID'
  | 'WITHDRAWAL_NOT_ALLOWED'
  | 'DOUBLE_COUNTED_LIQUIDITY'
  | 'REQUIRES_LIVE_VERIFIER'
  | 'UNSUPPORTED_PROOF_TYPE';

export type LiquidityAsset = 'MINIMA' | 'MxUSD' | string;

export type LiquidityPurpose =
  | 'omnia-router-liquidity'
  | 'omnia-channel-capital'
  | 'omnia-factory-capital'
  | 'vtxo-pool-backing'
  | 'statechain-exit-reserve'
  | 'rfq-inventory'
  | 'merchant-settlement-reserve'
  | 'community-liquidity'
  | 'sandbox-liquidity';

export type LiquidityPoolType =
  | 'omnia-router'
  | 'omnia-channel'
  | 'omnia-factory'
  | 'vtxo-pool'
  | 'statechain-exit-reserve'
  | 'rfq-inventory'
  | 'merchant-settlement'
  | 'community-pool'
  | 'sandbox';

export type LiquidityPositionStatus =
  | 'draft'
  | 'committed'
  | 'active'
  | 'allocated'
  | 'partially-reserved'
  | 'fully-reserved'
  | 'quiescing'
  | 'withdrawal-requested'
  | 'withdrawn'
  | 'depleted'
  | 'disputed'
  | 'invalid'
  | 'expired';

export type LockType =
  | 'none'
  | 'fixed-duration'
  | 'until-block'
  | 'until-epoch'
  | 'manual-release'
  | 'future-covenant';

export type FeeModel = 'none' | 'record-only' | 'pro-rata' | 'fixed-bps' | 'external';

export type AllocationType =
  | 'route-reserve'
  | 'channel-capital'
  | 'factory-capital'
  | 'rfq-inventory'
  | 'settlement-reserve'
  | 'manual-reserve';

export type AllocationStatus = 'active' | 'reserved' | 'released' | 'depleted' | 'invalid';

export type CommitmentStatus = 'draft' | 'signed' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export type WithdrawalStatus = 'requested' | 'approved' | 'rejected' | 'cancelled' | 'settled-externally';

export type ProofRefType = 'manual' | 'declared' | 'totem-proof' | 'future-live-chain' | 'future-omnia-state';

export type FeeSource = 'route-fee' | 'rfq-spread' | 'merchant-fee' | 'manual-adjustment' | 'external-record';

export interface LiquidityBondVerifyResult {
  ok: boolean;
  reason?: string;
  code?: LiquidityBondVerifyCode | string;
  requiresLiveVerifier?: boolean;
}

export interface ProviderBondRef {
  providerId: string;
  providerBondId?: string;
  manifestId?: string;
  providerScore?: number;
  metadata?: Record<string, unknown>;
}

export interface LiquidityLockTerms {
  lockType: LockType;
  minLockMs?: number;
  unlockAfterMs?: number;
  unlockAfterBlock?: bigint;
  noticePeriodMs?: number;
  earlyWithdrawalAllowed?: boolean;
  earlyWithdrawalPenaltyBps?: number;
}

export interface LiquidityFeePolicy {
  feeModel: FeeModel;
  feeAsset?: LiquidityAsset;
  feeBps?: number;
  operatorFeeBps?: number;
  lpFeeBps?: number;
  metadata?: Record<string, unknown>;
}

export interface LiquidityRiskPolicy {
  haircutBps?: number;
  maxAllocationBps?: number;
  allowProviderScoreBelow?: number;
  requireProviderBond?: boolean;
  requireIdentity?: boolean;
  acceptedAssets?: LiquidityAsset[];
  acceptedPurposes?: LiquidityPurpose[];
}

export interface LiquidityPoolManifest {
  poolId: string;
  edgeServiceManifestId?: string;
  edgeService?: import('@totemsdk/manifest').EdgeServiceManifest;
  signedEdgeService?: import('@totemsdk/manifest').SignedManifest<import('@totemsdk/manifest').EdgeServiceManifest>;
  poolType: LiquidityPoolType;
  purpose: LiquidityPurpose;
  asset: LiquidityAsset;
  operatorIdentityId?: string;
  operatorAddress?: string;
  providerBondRef?: ProviderBondRef;
  minCommitment?: bigint;
  maxCommitment?: bigint;
  totalCapacity?: bigint;
  lockTerms: LiquidityLockTerms;
  feePolicy?: LiquidityFeePolicy;
  riskPolicy?: LiquidityRiskPolicy;
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface LiquidityProofRef {
  proofId: string;
  proofType: ProofRefType;
  createdAt: number;
  expiresAt?: number;
  proof?: unknown;
  metadata?: Record<string, unknown>;
}

export interface LiquidityCommitment {
  commitmentId: string;
  poolId: string;
  lpIdentityId?: string;
  lpAddress: string;
  asset: LiquidityAsset;
  amount: bigint;
  purpose: LiquidityPurpose;
  status: CommitmentStatus;
  terms: LiquidityLockTerms;
  createdAt: number;
  expiresAt?: number;
  proofRef?: LiquidityProofRef;
  metadata?: Record<string, unknown>;
}

export interface LiquidityPosition {
  positionId: string;
  commitmentId?: string;
  poolId: string;
  lpIdentityId?: string;
  lpAddress: string;
  providerBondRef?: ProviderBondRef;
  asset: LiquidityAsset;
  amount: bigint;
  effectiveAmount?: bigint;
  purpose: LiquidityPurpose;
  status: LiquidityPositionStatus;
  lockTerms: LiquidityLockTerms;
  allocatedAmount?: bigint;
  reservedAmount?: bigint;
  availableAmount?: bigint;
  underlyingUtxoRef?: string;
  omniaChannelId?: string;
  factoryId?: string;
  routerId?: string;
  vtxoPoolId?: string;
  statechainId?: string;
  rfqInventoryId?: string;
  merchantSettlementId?: string;
  receiptId?: string;
  createdAt: number;
  updatedAt?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface LiquidityReceipt {
  receiptId: string;
  positionId: string;
  poolId: string;
  ownerAddress: string;
  ownerIdentityId?: string;
  asset: LiquidityAsset;
  amount: bigint;
  effectiveAmount?: bigint;
  issuedAt: number;
  expiresAt?: number;
  receiptHash: string;
  proofRef?: LiquidityProofRef;
  metadata?: Record<string, unknown>;
}

export interface LiquidityAllocation {
  allocationId: string;
  positionId: string;
  poolId: string;
  amount: bigint;
  purpose: LiquidityPurpose;
  allocationType: AllocationType;
  status: AllocationStatus;
  createdAt: number;
  releasedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface LiquidityFeeRecord {
  feeRecordId: string;
  positionId: string;
  poolId: string;
  feeAsset: LiquidityAsset;
  grossFeeAmount: bigint;
  lpFeeAmount?: bigint;
  operatorFeeAmount?: bigint;
  source: FeeSource;
  recordedAt: number;
  proofRef?: LiquidityProofRef;
  metadata?: Record<string, unknown>;
}

export interface WithdrawalIntent {
  withdrawalId: string;
  positionId: string;
  poolId: string;
  ownerAddress: string;
  amount: bigint;
  status: WithdrawalStatus;
  requestedAt: number;
  approvedAt?: number;
  rejectedAt?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface LiquidityBondRegistryState {
  pools: Record<string, LiquidityPoolManifest>;
  commitments: Record<string, LiquidityCommitment>;
  positions: Record<string, LiquidityPosition>;
  receipts: Record<string, LiquidityReceipt>;
  allocations: Record<string, LiquidityAllocation[]>;
  feeRecords: Record<string, LiquidityFeeRecord[]>;
  withdrawals: Record<string, WithdrawalIntent[]>;
  updatedAt?: number;
}

export interface LiquidityBondPolicy {
  acceptedAssets?: LiquidityAsset[];
  acceptedPurposes?: LiquidityPurpose[];
  minAmount?: bigint;
  maxHaircutBps?: number;
  requireIdentity?: boolean;
  requireProviderBond?: boolean;
  minProviderScore?: number;
  allowWithdrawablePositions?: boolean;
  rejectDepleted?: boolean;
  rejectExpired?: boolean;
  now?: number;
}

export interface CreateLiquidityPoolManifestParams {
  poolId: string;
  edgeService?: import('@totemsdk/manifest').EdgeServiceManifest;
  signedEdgeService?: import('@totemsdk/manifest').SignedManifest<import('@totemsdk/manifest').EdgeServiceManifest>;
  poolType: LiquidityPoolType;
  purpose: LiquidityPurpose;
  asset: LiquidityAsset;
  operatorAddress?: string;
  operatorIdentityId?: string;
  providerBondRef?: ProviderBondRef;
  minCommitment?: bigint;
  maxCommitment?: bigint;
  totalCapacity?: bigint;
  lockTerms: LiquidityLockTerms;
  feePolicy?: LiquidityFeePolicy;
  riskPolicy?: LiquidityRiskPolicy;
  createdAt?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityPoolManifestParams {
  manifest: LiquidityPoolManifest;
  now?: number;
}

export interface VerifyPoolOperatorIdentityParams {
  manifest: LiquidityPoolManifest;
  identityGraph: unknown;
}

export interface VerifyLpIdentityParams {
  commitment: LiquidityCommitment;
  identityGraph: unknown;
}

export interface VerifyReceiptOwnerIdentityParams {
  receipt: LiquidityReceipt;
  identityGraph: unknown;
}

export interface CreateLiquidityCommitmentParams {
  poolId: string;
  lpAddress: string;
  lpIdentityId?: string;
  asset: LiquidityAsset;
  amount: bigint;
  purpose: LiquidityPurpose;
  terms: LiquidityLockTerms;
  createdAt?: number;
  expiresAt?: number;
  proofRef?: LiquidityProofRef;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityCommitmentParams {
  commitment: LiquidityCommitment;
  pool: LiquidityPoolManifest;
  now?: number;
}

export interface CreateLiquidityPositionParams {
  commitment: LiquidityCommitment;
  poolId: string;
  providerBondRef?: ProviderBondRef;
  underlyingUtxoRef?: string;
  omniaChannelId?: string;
  factoryId?: string;
  routerId?: string;
  vtxoPoolId?: string;
  statechainId?: string;
  rfqInventoryId?: string;
  merchantSettlementId?: string;
  createdAt?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityPositionParams {
  position: LiquidityPosition;
  pool: LiquidityPoolManifest;
  now?: number;
}

export interface IssueLiquidityReceiptParams {
  position: LiquidityPosition;
  poolId: string;
  ownerAddress: string;
  ownerIdentityId?: string;
  issuedAt?: number;
  expiresAt?: number;
  proofRef?: LiquidityProofRef;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityReceiptParams {
  receipt: LiquidityReceipt;
  position: LiquidityPosition;
}

export interface CreateLiquidityAllocationParams {
  positionId: string;
  poolId: string;
  amount: bigint;
  purpose: LiquidityPurpose;
  allocationType: AllocationType;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityAllocationParams {
  allocation: LiquidityAllocation;
  position: LiquidityPosition;
}

export interface RecordLiquidityFeeParams {
  positionId: string;
  poolId: string;
  feeAsset: LiquidityAsset;
  grossFeeAmount: bigint;
  lpFeeAmount?: bigint;
  operatorFeeAmount?: bigint;
  source: FeeSource;
  recordedAt?: number;
  proofRef?: LiquidityProofRef;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityFeeRecordParams {
  record: LiquidityFeeRecord;
  position: LiquidityPosition;
}

export interface CreateWithdrawalIntentParams {
  positionId: string;
  poolId: string;
  ownerAddress: string;
  amount: bigint;
  requestedAt?: number;
  metadata?: Record<string, unknown>;
}

export interface VerifyWithdrawalAllowedParams {
  intent: WithdrawalIntent;
  position: LiquidityPosition;
  pool: LiquidityPoolManifest;
  now?: number;
}

export interface ComputePositionRiskScoreParams {
  position: LiquidityPosition;
  pool: LiquidityPoolManifest;
  now?: number;
}

export interface ComputePoolUtilisationParams {
  pool: LiquidityPoolManifest;
  positions: LiquidityPosition[];
}

export interface ValidateLiquidityAgainstPolicyParams {
  position: LiquidityPosition;
  pool: LiquidityPoolManifest;
  policy: LiquidityBondPolicy;
}

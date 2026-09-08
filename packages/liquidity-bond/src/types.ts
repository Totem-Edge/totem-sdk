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

export type LiquidityAsset = 'MINIMA' | 'USDT' | 'TOTEM' | string;

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
  | 'vtxo-backing'
  | 'manual-reserve';

export type AllocationStatus = 'active' | 'reserved' | 'released' | 'depleted' | 'invalid';

export type CommitmentStatus = 'draft' | 'signed' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export type WithdrawalStatus = 'requested' | 'approved' | 'rejected' | 'cancelled' | 'settled-externally';

export type ProofRefType = 'manual' | 'declared' | 'totem-proof' | 'future-live-chain' | 'future-omnia-state';

export type FeeSource = 'route-fee' | 'rfq-spread' | 'merchant-fee' | 'manual-adjustment' | 'external-record';

/** Fee sources that must prove real earnings (HTLC fulfillment / signed route record). */
export type EarnableFeeSource = 'route-fee' | 'rfq-spread' | 'merchant-fee';

/** Verifier for a fee's earn-proof. "Verified" means a checked payment proof. */
export interface FeeProofVerifier {
  verifyFeeProof(params: {
    source: EarnableFeeSource;
    proof: unknown;
    positionId: string;
    poolId: string;
    grossAmount: bigint;
  }): Promise<{ valid: boolean; reason?: string }>;
}

/** A settled payout that a claim/compound is bound to (prevents claim-then-fail). */
export interface FeePayoutRef {
  payoutId: string;
  nonce: string;
  kind: 'vtxo-mint' | 'channel-settlement' | 'external';
}

export interface LiquidityBondVerifyResult {
  ok: boolean;
  reason?: string;
  code?: LiquidityBondVerifyCode | string;
  requiresLiveVerifier?: boolean;
}

export interface ProviderBondRef {
  providerId: string;
  providerBondId?: string;
  /** An audited on-chain bond coin (utxo id), not free text. */
  bondCoinId?: string;
  manifestId?: string;
  providerScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Operator autobond (#5): a WOTS signature by the pool operator over the
 * load-bearing pool parameters (poolId, asset, totalCapacity, lockTerms,
 * feePolicy). Signed manifests are the anchor of truth — an operator cannot
 * forge a pool they never committed to.
 */
export interface OperatorAutobond {
  autobondId: string;
  /** Address derived from the signer's public key digest. */
  address: string;
  publicKeyDigest: string;
  /** sha3_256(domain | canonicalJson({poolId, asset, totalCapacity, lockTerms, feePolicy})) */
  payloadHash: string;
  signature: string;
  createdAt: number;
}

/** Verifier that confirms a provider's bond coin exists and is unspent on-chain. */
export interface LiquidityProviderBondVerifier {
  verifyBond(params: {
    bondCoinId: string;
    ownerProviderId: string;
  }): Promise<{ valid: boolean; reason?: string }>;
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
  operatorBond?: OperatorAutobond;
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

/**
 * Structured funding proof. "Verified" here means an on-chain check, never a
 * declared string: a coin that exists, is unspent, is owned by the LP, and
 * covers the claimed token+amount. `chain-confirmed` is set only by
 * `confirmLiquidityCommitment` after `verifyDeposit` passes.
 */
export interface LiquidityFunding {
  utxoRef: string;
  tokenId: string;
  amount: bigint;
  status: 'declared' | 'chain-confirmed' | 'invalid';
  confirmedAt?: number;
  txpowId?: string;
  mmrProof?: unknown;
}

/**
 * Minimal on-chain funding verifier. Structurally satisfied by
 * `@totemsdk/chain-provider`'s `DepositVerifier` (extra fields are fine), so a
 * pool backend can pass the same provider both places without forcing a hard
 * dependency on chain-provider here.
 */
export interface LiquidityChainFundingVerifier {
  verifyDeposit(params: {
    coinId: string;
    ownerAddress: string;
    tokenId?: string;
    claimedAmount?: string;
  }): Promise<{ valid: boolean; reason?: string; error?: unknown }>;
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
  funding?: LiquidityFunding;
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
  funding?: LiquidityFunding;
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
  /** The raw payment proof backing an earnable fee (HTLC fulfillment / route record). */
  earnProof?: unknown;
  /** Set only when the earn-proof was verified on-chain/against a payment record. */
  verified?: boolean;
  /** Bound payout for claim/compound reductions (prevents claim-then-fail). */
  payoutRef?: FeePayoutRef;
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
  /**
   * The accepted registry anchor root — advanced only through signed transitions
   * (`applyRegistryTransition`). Verifiers require the next transition's
   * `previousRoot` to match it, so a fabricated registry without the anchor chain
   * is rejected. Excluded from `serializeRegistryState`/`computeRegistryRoot`.
   */
  root?: string;
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
  operatorBond?: OperatorAutobond;
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
  /** When true, a cryptographically valid operator autobond is required. */
  requireOperatorBond?: boolean;
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
  funding?: LiquidityFunding;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityCommitmentParams {
  commitment: LiquidityCommitment;
  pool: LiquidityPoolManifest;
  now?: number;
  /** On-chain funding verifier. Without it, verified commits return REQUIRES_LIVE_VERIFIER. */
  chainProvider?: LiquidityChainFundingVerifier;
}

export interface CreateLiquidityPositionParams {
  commitment: LiquidityCommitment;
  poolId: string;
  providerBondRef?: ProviderBondRef;
  funding?: LiquidityFunding;
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
  /** Required for earnable sources — the payment proof that backs the fee. */
  earnProof?: unknown;
  /** When set, the earn-proof was verified (see `verifyLiquidityFeeRecord`). */
  verified?: boolean;
  payoutRef?: FeePayoutRef;
  metadata?: Record<string, unknown>;
}

export interface VerifyLiquidityFeeRecordParams {
  record: LiquidityFeeRecord;
  position: LiquidityPosition;
  /** Verifier for earnable sources; absent => earnable records fail verification. */
  feeProofVerifier?: FeeProofVerifier;
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

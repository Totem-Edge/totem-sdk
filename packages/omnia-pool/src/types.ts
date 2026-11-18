/**
 * omnia-pool/types.ts — Public types and execution ports.
 */

import type {
  AddHTLCParams,
  ChannelSignature,
  ChannelSigner,
  CreateChannelParams,
  OmniaChannel,
  SettlementPayload,
  SignedChannelState,
  UpdateDelta,
} from '@totemsdk/omnia';
import type { ChannelFactory, FactoryParticipant, FactorySettlementPayload } from '@totemsdk/omnia-factory';
import type {
  ChannelGraph,
  ChannelGraphEdge,
  ChannelOps,
  LeaseProvider,
  PaymentRequest,
  PaymentResult,
  Route,
  RouteOptions,
  RouterChannel,
} from '@totemsdk/omnia-router';
import type {
  FinalizeSpliceOptions,
  QuiescedChannel,
  SpliceAcceptance,
  SpliceLeaseProvider,
  SpliceParams,
  SpliceProposal,
  SplicedChannel,
} from '@totemsdk/omnia-splice';
import type {
  ExitDraft,
  MintVtxoParams,
  OmniaVtxo,
  OmniaVtxoPool,
} from '@totemsdk/omnia-vtxo';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseBundle } from '@totemsdk/omnia-factory';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';
import type {
  RegistryOperation,
  RegistrySignedTransition,
  RegistryTransitionSigner,
  PayoutSettlementBinding,
  PayoutSettlementEvidence,
  PayoutSettlementVerifier,
} from '@totemsdk/liquidity-bond';
import type {
  AllocationStatus,
  AllocationType,
  FeeSource,
  LiquidityAllocation,
  LiquidityBondRegistryState,
  LiquidityFeePolicy,
  LiquidityLockTerms,
  LiquidityPoolManifest,
  LiquidityPoolType,
  LiquidityPosition,
  LiquidityPurpose,
  LiquidityReceipt,
  LiquidityRiskPolicy,
  OperatorAutobond,
  WithdrawalIntent,
} from '@totemsdk/liquidity-bond';

export interface DepositToPoolResult {
  poolId: string;
  pool: LiquidityPoolManifest;
  position: LiquidityPosition;
  receipt: LiquidityReceipt;
  state: LiquidityBondRegistryState;
  signedTransition?: RegistrySignedTransition;
}

export interface CreateOmniaPoolParams {
  poolId: string;
  operatorAddress: string;
  tokenId: string;
  purpose: LiquidityPurpose;
  poolType: LiquidityPoolType;
  capacity: string;
  feePolicy: LiquidityFeePolicy;
  riskPolicy?: LiquidityRiskPolicy;
  lockTerms?: LiquidityLockTerms;
  operatorSigner?: PoolSigner;
  operatorBond?: OperatorAutobond;
  metadata?: Record<string, unknown>;
}

export interface OmniaPoolDeploymentContext {
  /** WOTS lease bundle for pool-level signing. */
  leaseBundle?: WotsLeaseBundle;
  /** Chain state provider for coin lookup and broadcast. */
  chainProvider?: ChainStateProvider;
  /** On-chain funding verifier — required to confirm LP deposits. */
  fundingVerifier?: import('@totemsdk/liquidity-bond').LiquidityChainFundingVerifier;
  /** Optional signer for pool-level operations. */
  signer?: PoolSigner;
}

export interface OmniaPoolAllocationContext {
  /** Execute direct Omnia channel operations. */
  omnia?: OmniaExecutionPort;
  /** Execute channel factory operations. */
  factory?: FactoryExecutionPort;
  /** Execute router channel graph operations. */
  router?: RouterExecutionPort;
  /** Execute splice operations. */
  splice?: SpliceExecutionPort;
  /** Execute VTXO pool operations. */
  vtxo?: VtxoExecutionPort;
  /**
   * Materialize a live Omnia channel from its id. Default impl reads a stored
   * channel snapshot via `recoverChannel(deserializeChannelSnapshot(snapshot))` —
   * see `createChannelLoader`. The allocation/withdrawal path calls
   * `loadChannel(position.omniaChannelId)` instead of requiring the caller to
   * inject the live object.
   */
  loadChannel?: (channelId: string) => Promise<OmniaChannel>;
  /** Persist a channel snapshot after create/update/close so it can be reloaded later. */
  saveChannelSnapshot?: (channel: OmniaChannel) => Promise<void> | void;
  /** Lease-backed signer aligned with Omnia's `ChannelSigner` (WOTS + signing indices). */
  signer?: PoolSigner;
  /** WOTS lease provider used for per-signing key reservations. */
  leaseProvider?: WotsLeaseProvider;
  /**
   * Verifier used to prove payout finality. Required to settle a payout (either
   * here or as `ExecutePoolPayoutParams.settlementVerifier`); without it a
   * supplied `settlement` is rejected and no accounting is mutated.
   */
  settlementVerifier?: PayoutSettlementVerifier;
}

/**
 * Signer aligned with `@totemsdk/omnia` `ChannelSigner`: lease-backed WOTS with
 * signing indices — `sign(digest)` alone is too thin for Omnia. A `PoolSigner`
 * is structurally a `ChannelSigner` (plus an optional convenience reader).
 */
export interface PoolSigner extends ChannelSigner {
  getPublicKey?(): Promise<string>;
}

/** Result of closing a pool-backed Omnia channel. */
export interface ChannelCloseResult {
  channel: OmniaChannel;
  settlementPayload: SettlementPayload;
}

/** Minimal port wrapping live Omnia channel operations. */
export interface OmniaExecutionPort {
  createChannel(params: CreateChannelParams): Promise<OmniaChannel>;
  updateState(channel: OmniaChannel, delta: UpdateDelta): Promise<SignedChannelState>;
  addHTLC(channel: OmniaChannel, params: AddHTLCParams): Promise<OmniaChannel>;
  fulfillHTLC(channel: OmniaChannel, htlcId: string, preimage: Uint8Array): Promise<OmniaChannel>;
  proposeSettlement(channel: OmniaChannel): Promise<SettlementPayload>;
  /**
   * Validate a one-party state update before this node adds its co-signature.
   * The co-sign verification boundary is load-bearing — it prevents a taker from
   * attaching a signature to a bad state — so it is a port, not caller-side boilerplate.
   */
  verifyStateForCoSign(channel: OmniaChannel, state: SignedChannelState): Promise<{ valid: boolean; errors: string[] }>;
  /** Close a channel and return its final close artifact. */
  closeChannel(channel: OmniaChannel): Promise<ChannelCloseResult>;
}

/** Optional signing context that makes a registry transition anchorable. */
export interface RegistryRootingContext {
  signer: RegistryTransitionSigner;
  /**
   * WOTS indices leased for this transition. Required (AUD-006): registry
   * signing never defaults to a reusable genesis index.
   */
  signIndices: SigningIndices;
  previousRoot?: string;
  op?: RegistryOperation;
  reason?: string;
}

/** Parameters for factory creation via the live execution port. */
export interface FactoryCreationParams {
  participants: FactoryParticipant[];
  tokenId: string;
  bundle: WotsLeaseBundle;
  chainProvider?: ChainStateProvider;
  tokenScale?: number;
}

/** Parameters for opening a virtual channel inside a factory. */
export interface FactoryVirtualChannelParams {
  parties: [string, string];
  amounts: Record<string, string>;
  leaseProviders: Record<string, WotsLeaseBundle>;
  channelId?: string;
}

/** Minimal port wrapping live channel factory operations. */
export interface FactoryExecutionPort {
  createFactory(params: FactoryCreationParams): Promise<ChannelFactory>;
  reallocate(
    factory: ChannelFactory,
    fromPartyId: string,
    toPartyId: string,
    amount: bigint,
    leaseProviders: Record<string, WotsLeaseBundle>,
  ): Promise<ChannelFactory>;
  openVirtualChannel(
    factory: ChannelFactory,
    params: FactoryVirtualChannelParams,
  ): Promise<{ factory: ChannelFactory; channel: OmniaChannel }>;
  closeVirtualChannel(
    factory: ChannelFactory,
    channel: OmniaChannel,
    leaseProviders: Record<string, WotsLeaseBundle>,
  ): Promise<ChannelFactory>;
  closeFactory(
    factory: ChannelFactory,
    leaseProviders: Record<string, WotsLeaseBundle>,
    chainProvider?: ChainStateProvider,
  ): Promise<FactorySettlementPayload>;
}

/** Minimal port wrapping live router operations. */
export interface RouterExecutionPort {
  createChannelGraph(): ChannelGraph;
  addChannel(graph: ChannelGraph, edge: ChannelGraphEdge): void;
  findRoute(
    graph: ChannelGraph,
    from: string,
    to: string,
    amount: bigint,
    tokenId: string,
    opts?: RouteOptions,
  ): Route | undefined;
  executeMultiHopPayment(
    ops: ChannelOps,
    channels: Map<string, RouterChannel>,
    route: Route,
    paymentRequest: PaymentRequest,
    leaseProviders: Map<string, LeaseProvider>,
  ): Promise<PaymentResult>;
}

/** Minimal port wrapping live splice operations. */
export interface SpliceExecutionPort {
  quiesceChannel(channel: OmniaChannel, leaseProvider: SpliceLeaseProvider): Promise<QuiescedChannel>;
  proposeSpliceOut(
    channel: QuiescedChannel,
    withdrawAmount: bigint,
    withdrawAddress: string,
    leaseProvider: SpliceLeaseProvider,
  ): Promise<SpliceProposal>;
  acceptSplice(
    channel: OmniaChannel | QuiescedChannel,
    proposal: SpliceProposal,
    leaseProvider: SpliceLeaseProvider,
  ): Promise<SpliceAcceptance>;
  finalizeSplice(
    channel: OmniaChannel | QuiescedChannel,
    proposal: SpliceProposal,
    acceptance: SpliceAcceptance,
    options?: FinalizeSpliceOptions,
  ): Promise<SplicedChannel>;
}

/** Minimal port wrapping live VTXO pool operations. */
export interface VtxoExecutionPort {
  createPool(params: {
    poolId: string;
    operator: string;
    tokenId: string;
    totalCapacity: string;
    policy?: unknown;
    nonce: string;
  }): Promise<OmniaVtxoPool>;
  mintVtxo(pool: OmniaVtxoPool, params: MintVtxoParams): Promise<{ pool: OmniaVtxoPool; vtxo: OmniaVtxo }>;
  createExitDraft(vtxo: OmniaVtxo): Promise<ExitDraft>;
  markExiting(vtxo: OmniaVtxo, now?: number): Promise<OmniaVtxo>;
  markExited(vtxo: OmniaVtxo, txpowId: string, now?: number): Promise<OmniaVtxo>;
}

export interface OmniaPoolFeeRecord {
  feeRecordId: string;
  positionId: string;
  source: FeeSource;
  amount: string;
  tokenId: string;
  recordedAt: number;
}

export interface PoolNAV {
  /** Total committed capital across all positions. */
  totalCommitted: bigint;
  /** Capital currently allocated to live execution backends. */
  totalAllocated: bigint;
  /** Capital reserved but not yet allocated. */
  totalReserved: bigint;
  /** Capital available for new allocations. */
  totalAvailable: bigint;
  /** Sum of recorded but unclaimed LP fees. */
  accruedFees: bigint;
  /** Net asset value = totalCommitted + accruedFees. */
  nav: bigint;
}

export interface OmniaPool {
  poolId: string;
  manifest: LiquidityPoolManifest;
  registry: LiquidityBondRegistryState;
  deploymentContext?: OmniaPoolDeploymentContext;
}

/** Convenience type for allocation targets. */
export type AllocationTarget =
  | { type: 'channel'; params: CreateChannelParams }
  | { type: 'factory'; params: FactoryCreationParams }
  | { type: 'router'; channel: ChannelGraphEdge }
  | { type: 'vtxo'; pool: OmniaVtxoPool; params: MintVtxoParams }
  | { type: 'reserve'; purpose: string };

/** Options for creating a withdrawal intent. */
export interface WithdrawLiquidityOptions {
  positionId: string;
  amount: string;
  recipientAddress: string;
  reason?: string;
}

export interface OmniaPoolWithdrawalResult {
  intent: WithdrawalIntent;
  position: LiquidityPosition;
  state: LiquidityBondRegistryState;
  /** Optional live execution artifact (e.g. settlement payload, exit draft). */
  execution?: unknown;
}

/** Options for fee operations. */
export interface ClaimFeesOptions {
  positionId: string;
  amount?: string;
  recipientAddress?: string;
  /**
   * Required: a settled payout recorded by
   * `registerSettledFeePayout` (itself gated on a live settlement verifier).
   * The claim consumes it — unknown, mismatched or reused references are
   * rejected.
   */
  payoutRef?: import('@totemsdk/liquidity-bond').FeePayoutRef;
}

export interface CompoundFeesOptions {
  positionId: string;
  /** Required: a settled payout the compound consumes (single-use). */
  payoutRef?: import('@totemsdk/liquidity-bond').FeePayoutRef;
}

/** Params exported from allocate.ts for the public index. */
export type AllocatePositionCapitalParams = {
  position: LiquidityPosition;
  amount: string;
  allocationType: AllocationType;
  purpose: LiquidityPurpose;
  target: AllocationTarget;
  ctx?: OmniaPoolAllocationContext;
  metadata?: Record<string, unknown>;
  /** When set, the produced registry transition is signed and anchored. */
  rooting?: RegistryRootingContext;
  /** Pool registry anchor root — verified against the channel's program state at co-sign (#26). */
  anchorRoot?: string;
};

export type AllocationResult = {
  allocation: LiquidityAllocation;
  position: LiquidityPosition;
  registry: LiquidityBondRegistryState;
  execution?: unknown;
  signedTransition?: RegistrySignedTransition;
};

export type ReleaseAllocationParams = {
  allocation: LiquidityAllocation;
  position: LiquidityPosition;
};

export type RebalanceAllocationParams = {
  from: LiquidityAllocation;
  toTarget: AllocationTarget;
  amount: string;
  ctx?: OmniaPoolAllocationContext;
  rooting?: RegistryRootingContext;
};

/**
 * Finality evidence for a payout, bound to the exact payout it claims to settle.
 * `status`/`evidenceRef`/`txpowId`/`depth` are the claim; `withdrawalId`,
 * `poolId`, `positionId`, `recipientAddress` and `amount` are the binding that
 * `executePoolPayout` checks locally and the verifier checks against its
 * evidence source. Evidence that does not match the intent is rejected.
 */
export type PayoutFinality = PayoutSettlementEvidence &
  PayoutSettlementBinding & {
    /** Withdrawal intent this evidence settles — must equal `intent.withdrawalId`. */
    withdrawalId: string;
  };

export type ExecutePoolPayoutParams = {
  pool: LiquidityPoolManifest;
  position: LiquidityPosition;
  intent: WithdrawalIntent;
  recipientAddress: string;
  ctx?: OmniaPoolAllocationContext;
  rooting?: RegistryRootingContext;
  /**
   * Finality evidence (RFC-048 §3.3). A payout produces only a *draft* until a
   * verifiable settlement artifact is supplied and verified; without
   * `settlement` the intent stays `approved` and the position is NOT
   * decremented. `confirmed` and `offchain-final` are distinct guarantees, both
   * requiring a recovery policy.
   *
   * Supplying `settlement` REQUIRES `settlementVerifier` (or
   * `ctx.settlementVerifier`): the evidence is checked against a real source
   * bound to this intent, pool, position, recipient and amount. An unverified
   * settlement throws and leaves the registry untouched.
   */
  settlement?: PayoutFinality;
  /**
   * Verifier for `settlement`. Required when `settlement` is supplied. The
   * function is async and fails closed when it is missing or reports invalid
   * evidence — a caller assertion can never settle funds.
   */
  settlementVerifier?: PayoutSettlementVerifier;
};

export type RecordPoolFeeParams = {
  pool: LiquidityPoolManifest;
  position: LiquidityPosition;
  grossAmount: string;
  source: FeeSource;
  /** Required for earnable sources — the payment proof backing the fee. */
  earnProof?: unknown;
  /**
   * Required for earnable sources to become earnable. `recordPoolFee` calls
   * `verifyFeeProof` and derives `verified` from the verdict; it never accepts
   * a caller-supplied `verified` flag. Without a verifier (or with a failing
   * proof) the record is stored unverified, visible for audit but non-earnable.
   */
  feeProofVerifier?: import('@totemsdk/liquidity-bond').FeeProofVerifier;
  metadata?: Record<string, unknown>;
};

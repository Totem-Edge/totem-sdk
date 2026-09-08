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
  ChannelOps,
  PaymentRequest,
  PaymentResult,
  Route,
  RouterChannel,
} from '@totemsdk/omnia-router';
import type {
  QuiescedChannel,
  SpliceAcceptance,
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
  reallocate(factory: ChannelFactory, allocation: Record<string, string>): Promise<ChannelFactory>;
  openVirtualChannel(
    factory: ChannelFactory,
    params: FactoryVirtualChannelParams,
  ): Promise<{ factory: ChannelFactory; channel: OmniaChannel }>;
  closeVirtualChannel(factory: ChannelFactory, channelId: string): Promise<ChannelFactory>;
  closeFactory(factory: ChannelFactory): Promise<FactorySettlementPayload>;
}

/** Minimal port wrapping live router operations. */
export interface RouterExecutionPort {
  createChannelGraph(): ChannelGraph;
  addChannel(graph: ChannelGraph, channel: RouterChannel): ChannelGraph;
  findRoute(graph: ChannelGraph, request: PaymentRequest): Route | undefined;
  executeMultiHopPayment(graph: ChannelGraph, route: Route, channelOps: ChannelOps): Promise<PaymentResult>;
}

/** Minimal port wrapping live splice operations. */
export interface SpliceExecutionPort {
  quiesceChannel(channel: OmniaChannel): Promise<QuiescedChannel>;
  proposeSpliceOut(params: SpliceParams): Promise<SpliceProposal>;
  acceptSplice(proposal: SpliceProposal): Promise<SpliceAcceptance>;
  finalizeSplice(acceptance: SpliceAcceptance): Promise<SplicedChannel>;
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
  markExiting(pool: OmniaVtxoPool, vtxoId: string): Promise<OmniaVtxoPool>;
  markExited(pool: OmniaVtxoPool, vtxoId: string, txpowId: string): Promise<OmniaVtxoPool>;
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
  | { type: 'router'; channel: RouterChannel }
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
}

export interface CompoundFeesOptions {
  positionId: string;
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

export type ExecutePoolPayoutParams = {
  pool: LiquidityPoolManifest;
  position: LiquidityPosition;
  intent: WithdrawalIntent;
  recipientAddress: string;
  ctx?: OmniaPoolAllocationContext;
  rooting?: RegistryRootingContext;
};

export type RecordPoolFeeParams = {
  pool: LiquidityPoolManifest;
  position: LiquidityPosition;
  grossAmount: string;
  source: FeeSource;
  proofRef?: unknown;
  metadata?: Record<string, unknown>;
};

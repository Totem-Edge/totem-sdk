import { withChannelLock } from '../channel-lock.js';
import { assertTwoPartyFactory } from '../peer-guards.js';
import {
  activateChannel,
  addHTLC,
  createChannel,
  buildChannelOpening,
  finalizeChannelOpening,
  applyProgramTransition,
  decrementCounter,
  fulfillHTLC,
  incrementCounter,
  markChannelClosed,
  markChannelClosing,
  confirmationsAt,
  proposeSettlement,
  buildSettlementSigningRequest,
  recordMeterReading,
  setCounter,
  timeoutHTLC,
  updateState,
  attachCounterpartySignature,
  makeSelfCustody,
  buildStateUpdate,
  finalizeStateUpdateWithIndices,
  signRequestPayload,
  verifyChannelSignature,
} from '@totemsdk/omnia';
import type {
  ChannelParticipant,
  ChannelSigner,
  CreateChannelParams,
  CustodyMode,
  OmniaChannel,
  OmniaPeer,
  OmniaSwarm,
  ProgramTransition,
  SignedChannelState,
  SignRequest,
  SignerPort,
  UnsignedStateUpdate,
  UpdateStateResult,
  ChannelOpeningPlan,
} from '@totemsdk/omnia';
import {
  createPool as createVtxoPoolSdk,
  mintVtxo,
  transferVtxo,
  refreshVtxo,
  createExitDraft,
  createMemoryExitDraftStore,
  markExiting,
  markExited,
  buildVtxoReceiptPayload,
  verifyVtxoClaim,
  verifyVtxoExitEntitlement,
  type OmniaVtxo,
  type OmniaVtxoPool,
  type VtxoOperatorReceipt,
  transitionPoolMembers,
} from '@totemsdk/vtxo';
import {
  createOmniaPool,
  depositToPool,
  allocatePositionCapital,
  releaseAllocation,
  withdrawLiquidity,
  approveWithdrawal,
  executePoolPayout,
} from '@totemsdk/omnia-pool';
import {
  createEmptyLiquidityBondRegistryState,
  type LiquidityAllocation,
  type LiquidityBondRegistryState,
  type LiquidityPoolManifest,
  type LiquidityPosition,
  type WithdrawalIntent,
} from '@totemsdk/liquidity-bond';
import { amountToAtoms, atomsToAmount, coinAmountAtoms, decodeMx, MINIMA_DECIMALS, unscaledToAmount } from '@totemsdk/core';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { PayoutSettlementStatus, PayoutSettlementVerifier } from '@totemsdk/liquidity-bond';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';
import {
  addChannel as addRouterChannel,
  createChannelGraph,
  createCleartextRoutingCodec,
  executeCrossTokenPayment,
  executeMultiHopPayment,
  findRoute as findRouterRoute,
  type ChannelGraph,
  type ChannelGraphEdge,
  type ChannelOps,
  type CrossTokenRoute,
  type LeaseProvider,
  type PaymentRequest,
  type PaymentResult,
  type Route,
  type RouteOptions,
  type RouterChannel,
} from '@totemsdk/omnia-router';
import {
  acceptFactory,
  assembleFactorySettlement,
  assembleVirtualChannelClose,
  assembleVirtualChannelOpen,
  buildFactorySettlement,
  buildVirtualChannelClose,
  buildVirtualChannelOpen,
  closeFactory,
  buildFactoryOpening,
  finalizeFactoryOpening,
  proposeFactoryOpening,
  signFactorySettlement,
  signVirtualChannelClose,
  signVirtualChannelOpen,
  type ChannelFactory,
  type FactorySettlementSignature,
  type FactoryFundingMaterial,
  type FactoryOpeningPlan,
  type FactoryParticipant,
  type WotsLeaseBundle,
} from '@totemsdk/omnia-factory';
import {
  finalizeSplice,
  proposeSpliceIn,
  proposeSpliceOut,
  quiesceChannel,
  buildSpliceInProposal,
  buildSpliceOutProposal,
  type QuiescedChannel,
  type SpliceAcceptance,
  type SpliceLeaseProvider,
  type SpliceProposal,
  type UnsignedSpliceProposal,
} from '@totemsdk/omnia-splice';
import type { JsonRpcHandler } from './jsonrpc.js';
import type { RoutingProvider } from '../router/routing-provider.js';
import { CoinSelectionService, type CoinFetcher, type SpendableCoin } from '@totemsdk/tx-builder';
import { OperationConflictError } from '../stores/operations.js';
import type { OperationStore } from '../stores/operations.js';
import type { ObservationEmitter } from '../observe/emitter.js';
import { channelTransitionHash, hashTransition } from '../observe/emitter.js';

function vtxoExitDraftStoreFor(context: HostApiContext): import('@totemsdk/vtxo').VtxoExitDraftStore {
  return context.vtxoExitDrafts ?? (context.vtxoExitDrafts = createMemoryExitDraftStore());
}

export type OperationStoreLike = Pick<OperationStore, 'get' | 'create' | 'transition' | 'listByStatus'>;

export interface HostApiContext {
  channels: Map<string, OmniaChannel>;
  routing: RoutingProvider;
  refreshRouting?: () => void;
  operations?: OperationStoreLike;
  /** Durable observation emitter (optional; behind OMNIA_OBSERVE). */
  observe?: ObservationEmitter;
  signer?: ChannelSigner;
  leaseProvider?: WotsLeaseProvider;
  chainProvider?: ChainStateProvider;
  /**
   * OMN-004: verifies a pool payout's settlement evidence against a real source
   * before capital is decremented. Without it, pool payouts fail closed.
   */
  settlementVerifier?: PayoutSettlementVerifier;
  /**
   * OMN-007: verifies VTXO claim signatures over the canonical claim preimage
   * against the signer's trusted key. Without it, claim verification fails closed.
   */
  vtxoClaimVerifier?: import('@totemsdk/vtxo').VtxoClaimSignatureVerifier;
  /**
   * OMN-042: trusted chain verifier for VTXO exit transactions. Required by
   * `completeVtxoExit`; a caller assertion is never enough.
   */
  vtxoExitVerifier?: import('@totemsdk/vtxo').VtxoExitVerifier;
  /**
   * OMN-025: verifier for the serialized witness carried by an exit
   * entitlement. Without it the host refuses to certify an entitlement.
   */
  vtxoExitWitnessVerifier?: import('@totemsdk/vtxo').VerifyExitEntitlementOptions['verifyWitness'];
  /** Per-context exit-draft reservation store; defaults to a fresh memory store. */
  vtxoExitDrafts?: import('@totemsdk/vtxo').VtxoExitDraftStore;
  /**
   * OMN-049: durable record of consumed WOTS leaves (`addressIndex:l1:l2` →
   * digest hex). Supplied by deployments so prepared-signature submissions can
   * reject a leaf reused for a different digest.
   */
  consumedSigningLeaves?: Map<string, string>;
  /**
   * OMN-043: live execution ports for pool capital allocation. The host
   * supplies `router` and `vtxo` itself; `channel`/`factory` still require the
   * deployment to inject their ports.
   */
  allocationContext?: import('@totemsdk/omnia-pool').OmniaPoolAllocationContext;
  /** Default address to source funding coins from (OMNIA_FUNDING_ADDRESS). */
  fundingAddress?: string;
  swarm?: OmniaSwarm;
  /** Last authenticated peer seen for each channel; reply over it directly. */
  channelPeers?: Map<string, OmniaPeer>;
  localParticipant?: ChannelParticipant;
  /** Native transport identity, published in the signed manifest. */
  transportPubkey?: string;
  /**
   * Signs the funding-transaction digest with the funding coin's key, so
   * openChannel can assemble the funding witness without the caller reproducing
   * the funding draft. Configured from the node's `sign` command.
   */
  fundingSigner?: (digest: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  factories?: Map<string, ChannelFactory>;
  factoryBundles?: Record<string, WotsLeaseBundle>;
  spliceProposals?: Map<string, SpliceProposal>;
  spliceAcceptances?: Map<string, SpliceAcceptance>;
  spliceLeaseProvider?: SpliceLeaseProvider;
  /** When true, only read-only methods are registered (no signer material). */
  readOnly?: boolean;
  /**
   * Test/dev escape hatch for a local-only pay without a peer co-signature.
   * Never set on a network-facing host (OMN-024).
   */
  allowLocalOnlyPay?: boolean;
  /** Deployment custody mode (RFC-058); defaults to self. */
  custodyMode?: CustodyMode;
  /** RFC-058 signer port; when absent the local signer path is used. */
  signerPort?: SignerPort;
  /** Coordinator-mode prepared channel updates awaiting wallet signatures. */
  preparedPay?: Map<string, PreparedPayEntry>;
  /** Coordinator-mode cooperative settlements awaiting the local signature. */
  preparedSettle?: Map<string, PreparedSettleEntry>;
  /** Coordinator-mode channel openings awaiting the funding signature. */
  preparedOpen?: Map<string, PreparedOpenEntry>;
  /** Coordinator-mode splices awaiting wallet signatures. */
  preparedSplice?: Map<string, PreparedSpliceEntry>;
  /** Coordinator-mode factory openings awaiting the creator signature. */
  preparedFactory?: Map<string, PreparedFactoryEntry>;
  /** VTXO pools, live claims and unsigned/signed receipts. */
  vtxoPools?: Map<string, OmniaVtxoPool>;
  vtxos?: Map<string, OmniaVtxo>;
  vtxoReceipts?: Map<string, VtxoOperatorReceipt>;
  preparedVtxoReceipts?: Map<string, PreparedVtxoReceiptEntry>;
  /** Liquidity pools and their live registry state. */
  pools?: Map<string, { manifest: LiquidityPoolManifest; registry: LiquidityBondRegistryState }>;
  poolPositions?: Map<string, {
    position: LiquidityPosition;
    registry: LiquidityBondRegistryState;
    allocation?: LiquidityAllocation;
    intent?: WithdrawalIntent;
  }>;
  /** True when the host has no signer and exposes prepare/submit only. */
  coordinator?: boolean;
  /** Opt-in host identity (address, publicKeyDigest, optional delegation). */
  identity?: {
    address: string;
    publicKeyDigest: string;
    identityId?: string;
    delegation?: unknown;
  };
  /** Boot-time signed EdgeServiceManifest. */
  manifest?: unknown;
  /** RFC-062 loopback P2P hub endpoint, when enabled. */
  p2pHubUrl?: string;
}

function channelSummary(channel: OmniaChannel): Record<string, unknown> {
  const parties = channel.parties.map((party) => party.partyId);
  return {
    channelId: channel.channelId,
    status: channel.status,
    tokenId: channel.tokenId,
    totalValue: atomsToAmount(channel.totalValue),
    localBalance: atomsToAmount(channel.balances[parties[0]] ?? 0n),
    remoteBalance: atomsToAmount(channel.balances[parties[1]] ?? 0n),
    currentSequence: channel.currentSequence,
  };
}

/**
 * Response keys that carry MINIMA/token amounts. Bigints under these keys are
 * atoms internally and are rendered as decimal text at the RPC boundary.
 * Anything else bigint-shaped (sequence numbers, block heights, hashes) keeps
 * its plain integer string form.
 */
const AMOUNT_FIELDS = new Set([
  'amount', 'amounts', 'changeAmount', 'minAmount', 'maxAmount',
  'allocatedAmount', 'availableAmount', 'reservedAmount', 'effectiveAmount',
  'compoundedAmount', 'grossAmount', 'grossFeeAmount', 'lpFeeAmount',
  'operatorFeeAmount', 'claimAmount', 'claimedAmount', 'inputsAmount',
  'totalCapacity', 'availableCapacity', 'capacity',
  'totalCommitted', 'totalAllocated', 'totalReserved', 'totalAvailable',
  'accruedFees', 'nav', 'verifiedShare',
  'totalValue', 'localAmount', 'remoteAmount', 'withdrawAmount', 'additionalAmount',
  'principal', 'allocated', 'allocations', 'available', 'withdrawn', 'payout', 'dividend', 'shares',
  'lockedValue', 'spendCap', 'spent', 'dividendPool', 'balances', 'balance',
]);

function looksLikeVtxoExitEntitlement(value: unknown): value is {
  amount: string;
  shares: string[];
  holders: string[];
  txHex: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.amount === 'string'
    && Array.isArray(entry.shares)
    && Array.isArray(entry.holders)
    && typeof entry.txHex === 'string';
}

function entitlementJson(value: { amount: string; shares: string[] }): Record<string, unknown> {
  return {
    ...value,
    amount: atomsToAmount(BigInt(value.amount)),
    shares: value.shares.map((share) => atomsToAmount(BigInt(share))),
  };
}

function amountFieldJson(value: unknown): unknown {
  if (typeof value === 'bigint') return atomsToAmount(value);
  if (Array.isArray(value)) return value.map(amountFieldJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, amountFieldJson(v)]));
  }
  return value;
}

/** Recursively JSON-safe: amounts → decimal text, other bigints → integer string, bytes → 0x-hex. */
function jsonSafe(value: unknown, key?: string): unknown {
  if (key && AMOUNT_FIELDS.has(key)) return amountFieldJson(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString('hex')}`;
  if (Array.isArray(value)) return value.map((entry) => jsonSafe(entry));
  if (value && typeof value === 'object') {
    if (looksLikeVtxoExitEntitlement(value)) {
      const entitlement = entitlementJson(value);
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(entitlement)) out[k] = jsonSafe(val, k);
      return out;
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(value as Record<string, unknown>)) out[k] = jsonSafe(val, k);
    return out;
  }
  return value;
}

/**
 * CAN-006: a fully serializable channel-state view so RPC/HTTP consumers can
 * read everything they need without reaching into `getStore()`/`getMethods()`.
 */
export function channelStateView(channel: OmniaChannel): Record<string, unknown> {
  return jsonSafe({
    channelId: channel.channelId,
    status: channel.status,
    channelType: channel.channelType,
    tokenId: channel.tokenId,
    tokenScale: channel.tokenScale ?? 0,
    totalValue: atomsToAmount(channel.totalValue),
    currentSequence: channel.currentSequence,
    fundingAddress: channel.fundingAddress,
    fundingScript: channel.fundingScript,
    fundingTxId: channel.fundingTxId,
    fundingCoinId: channel.fundingCoinId,
    contestDelayBlocks: channel.contestDelayBlocks,
    parties: channel.parties,
    balances: amountRecordJson(channel.balances),
    pendingHTLCs: channel.pendingHTLCs.map(htlcView),
    latestState: channel.latestState
      ? {
          sequence: channel.latestState.sequence,
          balances: amountRecordJson(channel.latestState.balances),
          pendingHTLCs: channel.latestState.pendingHTLCs?.length ?? 0,
          stateVariables: (channel.latestState.stateVariables ?? []).map(stateVariableView),
          transactionHex: channel.latestState.transactionHex,
          signatures: Object.keys(channel.latestState.signatures ?? {}),
          signingIndices: channel.latestState.signingIndices,
        }
      : null,
    stateLogLength: channel.stateLog?.length ?? 0,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  }) as Record<string, unknown>;
}

function paramsObject(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
  return params as Record<string, unknown>;
}

function requiredString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} is required`);
  return value;
}

function requiredBigInt(params: Record<string, unknown>, key: string): bigint {
  const value = requiredString(params, key);
  try {
    return BigInt(value);
  } catch {
    throw new Error(`${key} must be an integer string`);
  }
}

/**
 * Amount parameters are decimal MINIMA/token text at the RPC boundary (the
 * node's own convention). Internally the channel works in atoms.
 */
/** MiniNumber.isValidMinimaValue(): 0 < amount <= 1,000,000,000 MINIMA. */
const MAX_RPC_AMOUNT_ATOMS = 10n ** BigInt(MINIMA_DECIMALS) * 1_000_000_000n;

function rpcAmountToAtoms(value: string, label: string): bigint {
  let atoms: bigint;
  try {
    atoms = amountToAtoms(value);
  } catch {
    throw new Error(`${label} must be a non-negative decimal amount string`);
  }
  if (atoms > MAX_RPC_AMOUNT_ATOMS) {
    throw new Error(
      `${label} exceeds the node's maximum amount; this looks like an atom integer. `
      + 'Pass decimal MINIMA/token text (for example "0.2").',
    );
  }
  return atoms;
}

function requiredAmount(params: Record<string, unknown>, key: string): bigint {
  return rpcAmountToAtoms(requiredString(params, key), key);
}

function amountRecord(params: Record<string, unknown>, key: string): Record<string, bigint> | undefined {
  const value = params[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key} must be an object`);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([partyId, amount]) => [
    partyId,
    rpcAmountToAtoms(String(amount), `${key}.${partyId}`),
  ]));
}

function operationId(params: Record<string, unknown>): string {
  return requiredString(params, 'operationId');
}

function optionalStringRecord(params: Record<string, unknown>, key: string): Record<string, string> | undefined {
  const value = params[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key} must be an object`);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, nested]) => {
    if (typeof nested !== 'string') throw new Error(`${key}.${name} must be a string`);
    return [name, nested];
  }));
}

const TRANSITION_AMOUNT_KEYS = new Set(['amount', 'unitPrice', 'holderABalance', 'holderBBalance', 'spendCap']);

/**
 * OMN-058/RFC-079 §4A: the output-enforced full-distribution branch is the
 * default for new factories. `settlement: 'per-party'` opts out to the smaller
 * covenant; `enforceCheckpoints` additionally pins allocation changes to a
 * checkpoint transaction.
 */
function factoryScriptOptions(params: Record<string, unknown>): {
  settlement: 'full-distribution' | 'per-party';
  enforceCheckpoints: boolean;
} {
  return {
    settlement: params.settlement === 'per-party' ? 'per-party' : 'full-distribution',
    // OMN-058: allocation changes must be committed on chain, so escape branches
    // can never pay a stale split. Opting out is explicit and unsafe for
    // factories that rely on unilateral exits.
    enforceCheckpoints: params.enforceCheckpoints !== false,
  };
}

function optionalTransitionInputs(params: Record<string, unknown>): ProgramTransition['inputs'] {
  const value = params.inputs;
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('inputs must be an object');
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, nested]) => {
    if (TRANSITION_AMOUNT_KEYS.has(name)) {
      if (typeof nested !== 'string' && typeof nested !== 'number') {
        throw new Error(`inputs.${name} must be a decimal amount`);
      }
      return [name, rpcAmountToAtoms(String(nested), `inputs.${name}`)];
    }
    if (typeof nested === 'string' || typeof nested === 'boolean') return [name, nested];
    if (typeof nested === 'number' && Number.isSafeInteger(nested)) return [name, BigInt(nested)];
    throw new Error(`inputs.${name} must be a string, boolean, or safe integer`);
  }));
}

/** Channel balances in the RPC unit: decimal MINIMA/token text. */
function balancesJson(channel: OmniaChannel): Record<string, string> {
  return Object.fromEntries(Object.entries(channel.balances).map(([partyId, balance]) => [partyId, atomsToAmount(balance)]));
}

function amountRecordJson(balances: Record<string, bigint>): Record<string, string> {
  return Object.fromEntries(Object.entries(balances).map(([partyId, amount]) => [partyId, atomsToAmount(amount)]));
}

function htlcView(htlc: OmniaChannel['pendingHTLCs'][number]): Record<string, unknown> {
  return { ...htlc, amount: atomsToAmount(htlc.amount), timeoutBlock: htlc.timeoutBlock.toString() };
}

function stateVariableView(sv: { port: number; value: unknown; type: string; scale?: number }): Record<string, unknown> {
  const isScaled = sv.type === 'number' && sv.scale !== undefined && sv.scale > 0;
  const value = typeof sv.value === 'bigint'
    ? (isScaled ? unscaledToAmount(sv.value, sv.scale!) : sv.value.toString())
    : sv.value;
  return { port: sv.port, value, type: sv.type, ...(sv.scale !== undefined ? { scale: sv.scale } : {}) };
}

async function withOperation<T>(
  context: HostApiContext,
  params: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  if (!context.operations) throw new Error('Operation store is not configured');
  const id = operationId(params);
  const existing = context.operations.get(id);
  const verifier = (context.operations as OperationStoreLike & {
    verifyRequest?: (operationId: string, request: unknown) => boolean;
  }).verifyRequest;
  if (existing && verifier && !verifier(id, params)) {
    throw new OperationConflictError(
      'operation-conflict', id, existing.status,
      `Operation ${id} request does not match the original request`,
    );
  }
  if (existing?.status === 'committed') {
    if (existing.result === undefined) {
      throw new OperationConflictError(
        'operation-result-missing', id, existing.status,
        `Operation ${id} is committed but has no stored result`,
      );
    }
    return existing.result as T;
  }
  if (existing && !['pending', 'failed'].includes(existing.status)) {
    throw new OperationConflictError(
      'operation-in-progress', id, existing.status,
      `Operation ${id} is already ${existing.status}`,
    );
  }
  if (!existing) {
    context.operations.create(id, params);
    await context.observe?.emit({
      domain: 'operation', kind: 'operation.created', phase: 'proposed',
      entity: { type: 'operation', id }, operationId: id,
      data: { request: params },
    });
  }
  context.operations.transition(id, existing?.status === 'failed' ? 'failed' : 'pending', 'executing');
  await context.observe?.emit({
    domain: 'operation', kind: 'operation.executing', phase: 'executing',
    entity: { type: 'operation', id }, operationId: id,
  });
  try {
    const result = await run();
    context.operations.transition(id, 'executing', 'committed', { result });
    await context.observe?.emit({
      domain: 'operation', kind: 'operation.committed', phase: 'committed',
      entity: { type: 'operation', id }, operationId: id,
      data: { result },
    });
    return result;
  } catch (error) {
    context.operations.transition(id, 'executing', 'failed', { error: error instanceof Error ? error.message : String(error) });
    await context.observe?.emit({
      domain: 'operation', kind: 'operation.failed', phase: 'failed',
      entity: { type: 'operation', id }, operationId: id,
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}

function requireMutationContext(context: HostApiContext): asserts context is HostApiContext & {
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  chainProvider: ChainStateProvider;
  localParticipant: ChannelParticipant;
} {
  if (!context.signer || !context.leaseProvider || !context.chainProvider || !context.localParticipant) {
    throw new Error('Omnia mutations require signer, WOTS lease provider, chain provider, and local participant configuration');
  }
}

async function persistProgramUpdate(
  context: HostApiContext & {
    signer: ChannelSigner;
    leaseProvider: WotsLeaseProvider;
    localParticipant: ChannelParticipant;
  },
  channelId: string,
  run: (channel: OmniaChannel) => Promise<UpdateStateResult>,
): Promise<Record<string, unknown>> {
  const channel = context.channels.get(channelId);
  if (!channel) throw new Error(`Channel ${channelId} not found`);
  const result = await run(channel);
  if (result.error) throw new Error(result.error);
  context.channels.set(channelId, result.channel);
  const remoteParty = channel.parties.find((party) => party.partyId !== context.localParticipant.partyId);
  if (context.swarm && remoteParty) {
    const peer = await context.swarm.connectToPeer(remoteParty.publicKeyDigest, channelId, remoteParty.transportPubkey);
    await peer.sendMessage({ type: 'STATE_UPDATE', channelId, nonce: Date.now(), payload: result.signedState });
  }
  return {
    success: true,
    channelId,
    sequence: result.channel.currentSequence,
    balances: balancesJson(result.channel),
  };
}

/**
 * Wait for the counterparty to acknowledge a channel proposal. A channel is not
 * usable on both sides until the peer has accepted it; without this, an
 * immediate `pay()` can race ahead of the peer's accept and its STATE_UPDATE is
 * dropped ("Unknown channel"). Resolves true on ACK, false on ERROR/timeout.
 */
interface PeerReply {
  type: string;
  channelId?: string;
  nonce?: number;
  payload?: unknown;
}

interface ReplyPeer {
  sendMessage(msg: PeerReply & { channelId: string }): Promise<void>;
  onMessage(cb: (msg: PeerReply) => void): () => void;
  onReconnected?(cb: () => void): () => void;
}

/**
 * Send a proposal and wait for its ACK/ERROR reply.
 *
 * The message is resent with the SAME nonce when the peer reconnects (a
 * proposal or its reply may have been lost when the old stream closed) and
 * once mid-flight in case the reply was lost without the stream closing.
 * Receivers are expected to deduplicate by `(type, channelId, nonce)` so a
 * resend never consumes another WOTS leaf or yields a different signature.
 */
export function requestPeerReply(
  peer: ReplyPeer,
  msg: PeerReply & { channelId: string },
  channelId: string,
  timeoutMs: number,
  types: string[] = ['ACK', 'ERROR'],
): Promise<PeerReply | null> {
  return new Promise((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const unsubs: Array<() => void> = [];
    const finish = (reply: PeerReply | null): void => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (fallback) clearTimeout(fallback);
      for (const unsub of unsubs) unsub();
      resolve(reply);
    };
    const resend = (reason: string): void => {
      if (done) return;
      if (process.env.OMNIA_DEBUG) {
        console.error('[peer] resend', msg.type, msg.nonce, reason, channelId);
      }
      void peer.sendMessage(msg).catch(() => { /* next reconnect/retry */ });
    };
    unsubs.push(peer.onMessage((reply) => {
      if (reply.channelId !== channelId) return;
      if (msg.nonce !== undefined && reply.nonce !== undefined && reply.nonce !== msg.nonce) return;
      if (types.includes(reply.type)) finish(reply);
    }));
    if (peer.onReconnected) {
      unsubs.push(peer.onReconnected(() => resend('reconnected')));
    }
    fallback = setTimeout(
      () => resend('no reply'),
      Math.min(10_000, Math.floor(timeoutMs / 2)),
    );
    timer = setTimeout(() => finish(null), timeoutMs);
    void peer.sendMessage(msg).catch(() => { /* resent on reconnect/fallback */ });
  });
}

export interface PreparedPayEntry {
  channelId: string;
  unsigned: UnsignedStateUpdate;
  intent: import('@totemsdk/omnia').SignRequest;
  update: import('@totemsdk/omnia').SignRequest;
  settlement: import('@totemsdk/omnia').SignRequest;
  expiresAt: number;
}

export interface PreparedOpenEntry {
  plan: ChannelOpeningPlan;
  fundingScript?: string;
  intent: import('@totemsdk/omnia').SignRequest;
  funding: import('@totemsdk/omnia').SignRequest;
  expiresAt: number;
}

export interface PreparedVtxoReceiptEntry {
  receipt: VtxoOperatorReceipt;
  payload: Uint8Array;
  request: SignRequest;
  expiresAt: number;
}

export interface PreparedFactoryEntry {
  plan: FactoryOpeningPlan;
  remotePartyId?: string;
  remoteFundingSignature?: Uint8Array;
  intent: import('@totemsdk/omnia').SignRequest;
  commitment: import('@totemsdk/omnia').SignRequest;
  expiresAt: number;
}

export interface PreparedSpliceEntry {
  channelId: string;
  quiescedChannel: QuiescedChannel;
  quiesce: {
    unsigned: UnsignedStateUpdate;
    intent: import('@totemsdk/omnia').SignRequest;
    update: import('@totemsdk/omnia').SignRequest;
    settlement: import('@totemsdk/omnia').SignRequest;
  };
  unsigned: UnsignedSpliceProposal;
  acceptance: SpliceAcceptance;
  intent: import('@totemsdk/omnia').SignRequest;
  splice: import('@totemsdk/omnia').SignRequest;
  expiresAt: number;
}

export interface PreparedSettleEntry {
  channelId: string;
  closing: OmniaChannel;
  request: ReturnType<typeof buildSettlementSigningRequest>;
  counterpartySignature: { partyId: string; signature: Uint8Array };
  intent: import('@totemsdk/omnia').SignRequest;
  settlement: import('@totemsdk/omnia').SignRequest;
  expiresAt: number;
}

function signingIndicesParam(value: unknown): SigningIndices {
  if (!value || typeof value !== 'object') throw new Error('signingIndices is required');
  const item = value as Record<string, unknown>;
  const num = (key: string): number => {
    const parsed = Number(item[key]);
    if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`signingIndices.${key} must be a non-negative integer`);
    return parsed;
  };
  return { addressIndex: num('addressIndex'), l1: num('l1'), l2: num('l2') };
}

function hexBytes(value: unknown, label: string): Uint8Array {
  if (typeof value !== 'string') throw new Error(`${label} must be a hex string`);
  return Buffer.from(value.replace(/^0x/i, ''), 'hex');
}

function registerPreparedPayMethods(
  methods: Map<string, JsonRpcHandler>,
  context: HostApiContext,
): void {
  const preparePay: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    const amount = requiredAmount(params, 'amount');
    const localPartyId = context.localParticipant?.partyId;
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPartyId || !localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedPay) throw new Error('Prepared-pay store is not configured');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    const remotePartyId = channel.parties.find((party) => party.partyId !== localPartyId)?.partyId;
    if (!remotePartyId) throw new Error('Channel counterparty not found');
    if (amount <= 0n || (channel.balances[localPartyId] ?? 0n) < amount) {
      throw new Error('Insufficient channel balance');
    }
    if ((context.custodyMode ?? 'self') === 'hosted') {
      throw new Error('preparePay requires an explicit hosted custody disclosure context (not yet configured)');
    }

    return withOperation(context, params, async () => {
      const preparedOperationId = operationId(params);
      const unsigned = buildStateUpdate(
        channel,
        {
          newSequence: channel.currentSequence + 1,
          newBalances: {
            ...channel.balances,
            [localPartyId]: (channel.balances[localPartyId] ?? 0n) - amount,
            [remotePartyId]: (channel.balances[remotePartyId] ?? 0n) + amount,
          },
        },
        { publicKeyDigest: localPkd },
      );

      const expiresAt = Date.now() + 120_000;
      const base = {
        domain: 'channel' as const,
        signers: [localPkd],
        custody: makeSelfCustody(),
        expiresAt,
      };
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest: unsigned.updateDigest,
        context: { summary: `Authorize payment of ${atomsToAmount(amount)} on channel ${channelId}` },
      };
      const update: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:update`,
        kind: 'chain',
        digest: unsigned.updateDigest,
        context: { summary: 'Sign the channel update transaction' },
      };
      const settlement: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:settlement`,
        kind: 'chain',
        digest: unsigned.settlementDigest,
        context: { summary: 'Sign the settlement close package' },
      };

      for (const [key, entry] of context.preparedPay!) {
        if (entry.expiresAt <= Date.now()) context.preparedPay!.delete(key);
      }
      context.preparedPay!.set(preparedOperationId, { channelId, unsigned, intent, update, settlement, expiresAt });
      return {
        success: true,
        status: 'signature-required',
        operationId: preparedOperationId,
        channelId,
        requests: { intent, update, settlement },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPreparePay', preparePay);
  methods.set('omnia/preparePay', preparePay);

  const prepareChannelUpdate: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    const localPartyId = context.localParticipant?.partyId;
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPartyId || !localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedPay) throw new Error('Prepared-pay store is not configured');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if ((context.custodyMode ?? 'self') === 'hosted') {
      throw new Error('prepareChannelUpdate requires an explicit hosted custody disclosure context (not yet configured)');
    }

    const newBalances = amountRecord(params, 'newBalances') ?? channel.balances;
    const programTransition = params.programTransition as ProgramTransition | undefined;

    return withOperation(context, params, async () => {
      const preparedOperationId = operationId(params);
      const unsigned = buildStateUpdate(
        channel,
        { newSequence: channel.currentSequence + 1, newBalances, programTransition },
        { publicKeyDigest: localPkd },
      );
      const expiresAt = Date.now() + 120_000;
      const base = {
        domain: 'channel' as const,
        signers: [localPkd],
        custody: makeSelfCustody(),
        expiresAt,
      };
      const summary = typeof params.memo === 'string' && params.memo ? params.memo : 'Channel state update';
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest: unsigned.updateDigest,
        context: { summary: `Authorize ${summary}` },
      };
      const update: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:update`,
        kind: 'chain',
        digest: unsigned.updateDigest,
        context: { summary: 'Sign the channel update transaction' },
      };
      const settlement: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:settlement`,
        kind: 'chain',
        digest: unsigned.settlementDigest,
        context: { summary: 'Sign the settlement close package' },
      };
      for (const [key, entry] of context.preparedPay!) {
        if (entry.expiresAt <= Date.now()) context.preparedPay!.delete(key);
      }
      context.preparedPay!.set(preparedOperationId, { channelId, unsigned, intent, update, settlement, expiresAt });
      return {
        success: true,
        status: 'signature-required',
        operationId: preparedOperationId,
        channelId,
        requests: { intent, update, settlement },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPrepareChannelUpdate', prepareChannelUpdate);
  methods.set('omnia/prepareChannelUpdate', prepareChannelUpdate);

  const submitPay: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const preparedOperationId = requiredString(params, 'preparedOperationId');
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedPay) throw new Error('Prepared-pay store is not configured');
    return withOperation(context, params, async () => {
      const entry = context.preparedPay!.get(preparedOperationId);
      if (!entry) throw new Error(`Prepared payment ${preparedOperationId} not found`);
      if (entry.expiresAt <= Date.now()) {
        context.preparedPay!.delete(preparedOperationId);
        throw new Error(`Prepared payment ${preparedOperationId} has expired`);
      }

      const intentSignature = hexBytes(params.intentSignature, 'intentSignature');
      const updateSignature = hexBytes(params.updateSignature, 'updateSignature');
      const settlementSignature = hexBytes(params.settlementSignature, 'settlementSignature');
      const updateIndices = signingIndicesParam(params.updateIndices);
      const settlementIndices = signingIndicesParam(params.settlementIndices);

      if (!verifyChannelSignature(intentSignature, signRequestPayload(entry.intent), localPkd)) {
        throw new Error('intent signature does not verify');
      }
      if (!verifyChannelSignature(updateSignature, entry.unsigned.updateDigest, localPkd)) {
        throw new Error('update signature does not verify');
      }
      if (!verifyChannelSignature(settlementSignature, entry.unsigned.settlementDigest, localPkd)) {
        throw new Error('settlement signature does not verify');
      }
      // OMN-049: a one-time WOTS leaf must never sign two different digests —
      // including the update and its pre-signed settlement in the same package.
      const leafKey = (indices: { addressIndex: number; l1: number; l2: number }): string =>
        `${indices.addressIndex}:${indices.l1}:${indices.l2}`;
      if (leafKey(updateIndices) === leafKey(settlementIndices)) {
        throw new Error('update and settlement signatures must use different WOTS leaves');
      }
      const consumedLeaves = context.consumedSigningLeaves;
      if (consumedLeaves) {
        const used = [
          { indices: updateIndices, digest: entry.unsigned.updateDigest },
          { indices: settlementIndices, digest: entry.unsigned.settlementDigest },
        ];
        for (const leaf of used) {
          const prior = consumedLeaves.get(leafKey(leaf.indices));
          const digestHex = Buffer.from(leaf.digest).toString('hex');
          if (prior !== undefined && prior !== digestHex) {
            throw new Error(`WOTS leaf ${leafKey(leaf.indices)} was already used for a different digest`);
          }
        }
        for (const leaf of used) {
          consumedLeaves.set(leafKey(leaf.indices), Buffer.from(leaf.digest).toString('hex'));
        }
      }

      const state = finalizeStateUpdateWithIndices(
        entry.unsigned,
        updateSignature,
        updateIndices,
        settlementSignature,
        settlementIndices,
      );
      const channel = entry.unsigned.channel;
      const updatedChannel = {
        ...channel,
        balances: state.balances!,
        currentSequence: state.sequence!,
        pendingProposal: { sequence: state.sequence!, payloadHash: entry.unsigned.payloadHash },
        stateLog: [
          ...channel.stateLog,
          {
            sequence: state.sequence!,
            timestamp: Date.now(),
            balances: { ...state.balances! },
            htlcCount: entry.unsigned.pendingHTLCs.length,
            event: 'update' as const,
          },
        ],
        updatedAt: Date.now(),
      };
      context.channels.set(entry.channelId, updatedChannel);

      const localPartyId = context.localParticipant!.partyId;
      const remote = channel.parties.find((party) => party.partyId !== localPartyId);
      if (!remote) throw new Error('Channel counterparty not found');
      if (context.swarm && !context.allowLocalOnlyPay) {
        const peer = await context.swarm.connectToPeer(remote.publicKeyDigest, entry.channelId, remote.transportPubkey);
        await peer.sendMessage({
          type: 'STATE_UPDATE',
          channelId: entry.channelId,
          nonce: Date.now(),
          payload: state,
        });
      }
      context.preparedPay!.delete(preparedOperationId);

      return {
        success: true,
        channelId: entry.channelId,
        sequence: state.sequence!,
        localBalance: state.balances![localPartyId]!.toString(),
        remoteBalance: state.balances![remote.partyId]!.toString(),
      };
    });
  };
  methods.set('totem_omniaSubmitPay', submitPay);
  methods.set('omnia/submitPay', submitPay);
  methods.set('totem_omniaSubmitChannelUpdate', submitPay);
  methods.set('omnia/submitChannelUpdate', submitPay);

  const prepareSettle: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    const localPartyId = context.localParticipant?.partyId;
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPartyId || !localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedSettle) throw new Error('Prepared-settle store is not configured');
    if (!context.swarm) throw new Error('prepareSettle requires swarm connectivity');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if (!['active', 'closing_mutual'].includes(channel.status)) {
      throw new Error(`Channel ${channelId} is not settleable (${channel.status})`);
    }
    const closing = markChannelClosing(channel, 'mutual');
    const partyAddresses = Object.fromEntries(
      closing.parties.map((party) => [party.partyId, party.settlementAddress ?? party.publicKeyDigest]),
    );
    const remote = closing.parties.find((party) => party.partyId !== localPartyId);
    if (!remote) throw new Error('Channel counterparty not found');
    const request = buildSettlementSigningRequest(closing, { partyAddresses });

    return withOperation(context, params, async () => {
      const peer = await context.swarm!.connectToPeer(remote.publicKeyDigest, channelId, remote.transportPubkey);
      const reply = await requestPeerReply(
        peer,
        {
          type: 'SETTLEMENT_PROPOSAL',
          channelId,
          nonce: Date.now(),
          payload: { signRequest: true, ...request },
        },
        channelId,
        30_000,
      );
      const payload = reply?.payload as { signature?: string; partyId?: string } | undefined;
      if (reply?.type !== 'ACK' || typeof payload?.signature !== 'string') {
        throw new Error(`Counterparty did not co-sign the settlement (${reply?.type ?? 'timeout'})`);
      }
      const counterpartySignature = {
        partyId: payload.partyId ?? remote.partyId,
        signature: Buffer.from(payload.signature.replace(/^0x/i, ''), 'hex'),
      };

      const preparedOperationId = operationId(params);
      const expiresAt = Date.now() + 120_000;
      const digest = Buffer.from(request.digestHex.replace(/^0x/i, ''), 'hex');
      const base = {
        domain: 'channel' as const,
        signers: [localPkd],
        custody: makeSelfCustody(),
        expiresAt,
      };
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest,
        context: { summary: 'Authorize cooperative settlement' },
      };
      const settlement: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:settlement`,
        kind: 'chain',
        digest,
        context: { summary: 'Sign the cooperative settlement transaction' },
      };
      for (const [key, entry] of context.preparedSettle!) {
        if (entry.expiresAt <= Date.now()) context.preparedSettle!.delete(key);
      }
      context.preparedSettle!.set(preparedOperationId, {
        channelId,
        closing,
        request,
        counterpartySignature,
        intent,
        settlement,
        expiresAt,
      });
      return {
        success: true,
        status: 'signature-required',
        operationId: preparedOperationId,
        channelId,
        requests: { intent, settlement },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPrepareSettle', prepareSettle);
  methods.set('omnia/prepareSettle', prepareSettle);

  const submitSettle: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const preparedOperationId = requiredString(params, 'preparedOperationId');
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedSettle) throw new Error('Prepared-settle store is not configured');
    return withOperation(context, params, async () => {
      const entry = context.preparedSettle!.get(preparedOperationId);
      if (!entry) throw new Error(`Prepared settlement ${preparedOperationId} not found`);
      if (entry.expiresAt <= Date.now()) {
        context.preparedSettle!.delete(preparedOperationId);
        throw new Error(`Prepared settlement ${preparedOperationId} has expired`);
      }
      const intentSignature = hexBytes(params.intentSignature, 'intentSignature');
      const settlementSignature = hexBytes(params.settlementSignature, 'settlementSignature');
      const digest = Buffer.from(entry.request.digestHex.replace(/^0x/i, ''), 'hex');
      if (!verifyChannelSignature(intentSignature, signRequestPayload(entry.intent), localPkd)) {
        throw new Error('intent signature does not verify');
      }
      if (!verifyChannelSignature(settlementSignature, digest, localPkd)) {
        throw new Error('settlement signature does not verify');
      }
      if (!context.chainProvider) throw new Error('Settlement requires a chain provider');
      const rawProofs = params.broadcastProofs;
      const broadcastProofs = rawProofs && typeof rawProofs === 'object'
        && Array.isArray((rawProofs as Record<string, unknown>).coinProofs)
        && Array.isArray((rawProofs as Record<string, unknown>).scriptProofs)
        ? {
            coinProofs: ((rawProofs as Record<string, unknown>).coinProofs as unknown[]).map((hex) => Buffer.from(String(hex).replace(/^0x/i, ''), 'hex')),
            scriptProofs: ((rawProofs as Record<string, unknown>).scriptProofs as unknown[]).map((hex) => Buffer.from(String(hex).replace(/^0x/i, ''), 'hex')),
          }
        : undefined;
      const settlementIndices = params.settlementIndices
        ? signingIndicesParam(params.settlementIndices)
        : undefined;
      const settlement = await proposeSettlement(entry.closing, context.leaseProvider, {
        chainProvider: context.chainProvider,
        broadcastProofs,
        partyAddresses: entry.request.partyAddresses,
        settlementTxHex: entry.request.settlementTxHex,
        counterpartySignatures: [entry.counterpartySignature],
        localSignature: settlementSignature,
        localIndices: settlementIndices,
        localPartyId: context.localParticipant!.partyId,
      });
      context.channels.set(entry.channelId, markChannelClosed(entry.closing));
      context.preparedSettle!.delete(preparedOperationId);
      return {
        success: true,
        channelId: entry.channelId,
        settlementTxId: settlement.settlementPayload.txpowId,
        finalBalances: Object.fromEntries(
          Object.entries(settlement.settlementPayload.balances).map(([key, value]) => [key, value.toString()]),
        ),
      };
    });
  };
  methods.set('totem_omniaSubmitSettle', submitSettle);
  methods.set('omnia/submitSettle', submitSettle);

  const prepareOpenChannel: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const localParticipant = context.localParticipant;
    const localPkd = localParticipant?.publicKeyDigest;
    if (!localParticipant || !localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedOpen) throw new Error('Prepared-open store is not configured');
    if (!context.chainProvider) throw new Error('prepareOpenChannel requires a chain provider');
    const remote: ChannelParticipant = {
      partyId: requiredString(params, 'remotePartyId'),
      publicKeyDigest: requiredString(params, 'remotePublicKeyDigest'),
      addressIndex: typeof params.remoteAddressIndex === 'number' ? params.remoteAddressIndex : 0,
      settlementAddress: typeof params.remoteSettlementAddress === 'string' ? params.remoteSettlementAddress : undefined,
      transportPubkey: typeof params.remoteTransportPubkey === 'string' ? params.remoteTransportPubkey : undefined,
    };
    const createParams: CreateChannelParams = {
      localParty: {
        ...localParticipant,
        transportPubkey: localParticipant.transportPubkey ?? context.transportPubkey,
      },
      remoteParty: remote,
      localAmount: requiredAmount(params, 'localAmount'),
      remoteAmount: requiredAmount(params, 'remoteAmount'),
      tokenId: typeof params.tokenId === 'string' ? params.tokenId : undefined,
      fundingCoinId: requiredString(params, 'fundingCoinId'),
      contestDelayBlocks: typeof params.contestDelayBlocks === 'number' ? params.contestDelayBlocks : undefined,
      fundingScript: typeof params.fundingScript === 'string' ? params.fundingScript : undefined,
    };

    return withOperation(context, params, async () => {
      const plan = await buildChannelOpening(createParams, context.chainProvider!);
      const preparedOperationId = operationId(params);
      const expiresAt = Date.now() + 300_000;
      const base = {
        domain: 'channel' as const,
        signers: [localPkd],
        custody: makeSelfCustody(),
        expiresAt,
      };
      const summary = `Open channel ${plan.channel.channelId} (${atomsToAmount(plan.channel.totalValue)} units)`;
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest: plan.fundingDigest,
        context: {
          summary: `Authorize ${summary}`,
          amount: atomsToAmount(plan.channel.totalValue),
          asset: plan.channel.tokenId,
          terms: `Counterparty ${remote.partyId}; channel ${plan.channel.channelId}`,
        },
      };
      const funding: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:funding`,
        kind: 'chain',
        digest: plan.fundingDigest,
        context: { summary: 'Sign the channel funding transaction' },
      };
      for (const [key, entry] of context.preparedOpen!) {
        if (entry.expiresAt <= Date.now()) context.preparedOpen!.delete(key);
      }
      context.preparedOpen!.set(preparedOperationId, {
        plan,
        fundingScript: createParams.fundingScript,
        intent,
        funding,
        expiresAt,
      });
      return {
        success: true,
        status: 'signature-required',
        operationId: preparedOperationId,
        channelId: plan.channel.channelId,
        fundingAddress: plan.fundingAddress,
        fundingCoinId: plan.outputCoinId,
        inputCoinId: plan.inputCoinId,
        totalValue: atomsToAmount(plan.channel.totalValue),
        requests: { intent, funding },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPrepareOpenChannel', prepareOpenChannel);
  methods.set('omnia/prepareOpenChannel', prepareOpenChannel);

  /** Rebuild the channel proposal a peer must ACK (CAN-006 recovery path). */
  function proposalForChannel(channel: OmniaChannel, localPartyId: string): import('@totemsdk/omnia').ChannelProposal {
    const localParty = channel.parties.find((party) => party.partyId === localPartyId);
    const remoteParty = channel.parties.find((party) => party.partyId !== localPartyId);
    if (!localParty || !remoteParty) throw new Error('Channel is missing a party');
    return {
      channelId: channel.channelId,
      localParty,
      remoteParty,
      localAmount: channel.balances[localParty.partyId] ?? 0n,
      remoteAmount: channel.balances[remoteParty.partyId] ?? 0n,
      tokenId: channel.tokenId,
      tokenScale: channel.tokenScale ?? 0,
      fundingScript: channel.fundingScript,
      programId: channel.programId,
      programVersion: channel.programVersion,
      fundingAddress: channel.fundingAddress,
      fundingTxId: channel.fundingTxId,
      fundingCoinId: channel.fundingCoinId,
      contestDelayBlocks: channel.contestDelayBlocks,
    };
  }

  const submitOpenChannel: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const preparedOperationId = requiredString(params, 'preparedOperationId');
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedOpen) throw new Error('Prepared-open store is not configured');
    if (!context.chainProvider) throw new Error('submitOpenChannel requires a chain provider');
    return withOperation(context, params, async () => {
      const entry = context.preparedOpen!.get(preparedOperationId);
      if (!entry) throw new Error(`Prepared channel opening ${preparedOperationId} not found`);
      if (entry.expiresAt <= Date.now()) {
        context.preparedOpen!.delete(preparedOperationId);
        throw new Error(`Prepared channel opening ${preparedOperationId} has expired`);
      }

      const intentSignature = hexBytes(params.intentSignature, 'intentSignature');
      const fundingSignature = hexBytes(params.fundingSignature, 'fundingSignature');
      if (!verifyChannelSignature(intentSignature, signRequestPayload(entry.intent), localPkd)) {
        throw new Error('intent signature does not verify');
      }
      if (!verifyChannelSignature(fundingSignature, entry.plan.fundingDigest, localPkd)) {
        throw new Error('funding signature does not verify');
      }

      const toBytes = (value: unknown): Uint8Array[] =>
        Array.isArray(value) ? value.map((item) => Buffer.from(String(item).replace(/^0x/i, ''), 'hex')) : [];
      const fundingWitnessHex = typeof params.fundingWitnessHex === 'string' ? params.fundingWitnessHex : undefined;
      let finalizeOpts: Parameters<typeof finalizeChannelOpening>[1];
      if (fundingWitnessHex) {
        finalizeOpts = { fundingWitnessBytes: Buffer.from(fundingWitnessHex.replace(/^0x/i, ''), 'hex') };
      } else {
        finalizeOpts = {
          fundingSignature,
          fundingProofs: {
            coinProofs: toBytes(params.fundingCoinProofsHex),
            scriptProofs: toBytes(params.fundingScriptProofsHex),
          },
          fundingScript: typeof params.fundingScript === 'string'
            ? params.fundingScript
            : entry.fundingScript,
        };
      }

      const { channel, proposal, fundingTxId } = await finalizeChannelOpening(
        entry.plan,
        finalizeOpts,
        context.chainProvider!,
      );
      context.channels.set(channel.channelId, { ...channel, localSigner: context.signer });
      let acknowledged = true;
      let ackError: string | undefined;
      if (context.swarm) {
        const remote = channel.parties.find((party) => party.partyId !== context.localParticipant!.partyId);
        if (remote) {
          const peer = await context.swarm.connectToPeer(
            remote.publicKeyDigest,
            channel.channelId,
            remote.transportPubkey,
          );
          const reply = await requestPeerReply(
            peer,
            { type: 'CHANNEL_PROPOSAL', channelId: channel.channelId, nonce: Date.now(), payload: proposal },
            channel.channelId,
            20_000,
          );
          acknowledged = reply?.type === 'ACK';
          if (!acknowledged) {
            const payload = (reply?.payload ?? {}) as { error?: unknown };
            ackError = typeof payload.error === 'string'
              ? payload.error
              : reply?.type === 'ERROR' ? 'counterparty rejected the channel proposal' : 'counterparty did not acknowledge the channel proposal';
          }
        }
      }
      context.preparedOpen!.delete(preparedOperationId);
      if (!acknowledged) {
        // CAN-006: the funding transaction is real, but the channel is not
        // usable until the counterparty accepts it. Persist a recoverable
        // pending-ack channel and report failure instead of "active".
        const pending = { ...channel, status: 'funding_pending' as const };
        context.channels.set(channel.channelId, { ...pending, localSigner: context.signer });
        return {
          success: false,
          channelId: channel.channelId,
          fundingTxId,
          acknowledged: false,
          status: 'funding_pending',
          errorCode: 'NOT_ACKNOWLEDGED',
          error: ackError,
        };
      }
      return { success: true, channelId: channel.channelId, fundingTxId, acknowledged };
    });
  };
  methods.set('totem_omniaSubmitOpenChannel', submitOpenChannel);
  methods.set('omnia/submitOpenChannel', submitOpenChannel);

  /**
   * CAN-006 recovery: re-send the proposal for a channel whose funding tx is
   * on chain but whose counterparty never ACKed. Becomes active only on ACK.
   */
  const resubmitChannelProposal: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    const localPartyId = context.localParticipant?.partyId;
    if (!localPartyId) throw new Error('Local participant is not configured');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if (channel.status === 'active') return { success: true, channelId, acknowledged: true, status: 'active' };
    if (channel.status !== 'funding_pending') {
      throw new Error(`Channel ${channelId} is ${channel.status}; only funding_pending can be re-proposed`);
    }
    if (!context.swarm) throw new Error('Resubmitting a channel proposal requires swarm connectivity');
    const remote = channel.parties.find((party) => party.partyId !== localPartyId);
    if (!remote) throw new Error('Channel counterparty not found');
    const peer = await context.swarm.connectToPeer(remote.publicKeyDigest, channelId, remote.transportPubkey);
    const reply = await requestPeerReply(
      peer,
      { type: 'CHANNEL_PROPOSAL', channelId, nonce: Date.now(), payload: proposalForChannel(channel, localPartyId) },
      channelId,
      20_000,
    );
    if (reply?.type !== 'ACK') {
      const payload = (reply?.payload ?? {}) as { error?: unknown };
      return {
        success: false,
        channelId,
        acknowledged: false,
        status: 'funding_pending',
        errorCode: 'NOT_ACKNOWLEDGED',
        error: typeof payload.error === 'string' ? payload.error : 'counterparty did not acknowledge the channel proposal',
      };
    }
    const active = activateChannel(channel);
    context.channels.set(channelId, { ...active, localSigner: context.signer });
    return { success: true, channelId, acknowledged: true, status: active.status };
  };
  methods.set('totem_omniaResubmitChannelProposal', resubmitChannelProposal);
  methods.set('omnia/resubmitChannelProposal', resubmitChannelProposal);

  const prepareSplice = (type: 'in' | 'out'): JsonRpcHandler => async (raw) => {
    const params = paramsObject(raw);
    if (!context.preparedSplice || !context.spliceAcceptances) {
      throw new Error('Splice manager is not configured');
    }
    if (!context.swarm) throw new Error('Splice preparation requires swarm connectivity');
    const channelId = requiredString(params, 'channelId');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    const localPartyId = context.localParticipant?.partyId;
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPartyId || !localPkd) throw new Error('Local participant is not configured');
    if (channel.status !== 'active') throw new Error(`Channel ${channelId} is not active (${channel.status})`);
    const pending = channel.pendingHTLCs.filter((h) => h.status === 'pending');
    if (pending.length > 0) throw new Error(`Cannot splice with ${pending.length} pending HTLC(s)`);
    const remote = channel.parties.find((party) => party.partyId !== localPartyId);
    if (!remote) throw new Error('Channel counterparty not found');

    const nextSequence = channel.currentSequence + 1;
    const quiesceUnsigned = buildStateUpdate(
      channel,
      { newSequence: nextSequence, newBalances: { ...channel.balances } },
      { publicKeyDigest: localPkd },
    );
    const quiescedChannel: QuiescedChannel = {
      ...channel,
      currentSequence: nextSequence,
      balances: { ...channel.balances },
      pendingHTLCs: [],
      latestState: null,
      status: 'quiesced',
      quiesceSignedState: quiesceUnsigned.unsignedClosePackage,
      updatedAt: Date.now(),
    };
    const parsedBalances = amountRecord(params, 'newBalances');
    let additionalCoinAddress: string | undefined;
    if (type === 'in') {
      // OMN-052: the added coin's address is part of the transaction, so it
      // must be supplied and match the coin on chain.
      additionalCoinAddress = requiredString(params, 'additionalCoinAddress');
      const chain = context.chainProvider;
      const coinId = requiredString(params, 'additionalCoinId');
      if (chain?.getCoin) {
        const coin = await chain.getCoin(coinId);
        if (!coin) throw new Error(`splice-in coin ${coinId} not found on chain`);
        if (coin.spent) throw new Error(`splice-in coin ${coinId} is already spent`);
        if (coin.address !== additionalCoinAddress && coin.miniaddress !== additionalCoinAddress) {
          throw new Error(`splice-in coin ${coinId} is not owned by ${additionalCoinAddress}`);
        }
        if (requiredAmount(params, 'additionalAmount') !== coinAmountAtoms(coin)) {
          throw new Error(`splice-in amount does not match coin ${coinId}`);
        }
      }
    }
    const unsigned = type === 'in'
      ? buildSpliceInProposal(
          quiescedChannel,
          requiredString(params, 'additionalCoinId'),
          requiredAmount(params, 'additionalAmount'),
          localPkd,
          parsedBalances,
          additionalCoinAddress,
        )
      : buildSpliceOutProposal(
          quiescedChannel,
          requiredAmount(params, 'withdrawAmount'),
          requiredString(params, 'withdrawAddress'),
          localPkd,
          parsedBalances,
        );

    return withOperation(context, params, async () => {
      const placeholder: SpliceProposal = {
        spliceId: unsigned.spliceId,
        channelId: unsigned.channelId,
        params: unsigned.params,
        spliceTxHex: unsigned.spliceTxHex,
        spliceTxDraft: unsigned.spliceTxDraft,
        proposerPublicKeyDigest: localPkd,
        proposerSignature: new Uint8Array(0),
        proposerReservationId: '',
        proposerSigningIndices: { addressIndex: 0, l1: 0, l2: 0 },
        proposedAt: Date.now(),
      };
      const peer = await context.swarm!.connectToPeer(remote.publicKeyDigest, channelId, remote.transportPubkey);
      const reply = await requestPeerReply(
        peer,
        { type: 'SPLICE_PROPOSAL', channelId, nonce: Date.now(), payload: { proposal: placeholder } },
        channelId,
        30_000,
        ['SPLICE_ACCEPT', 'ERROR'],
      );
      const acceptance = (reply?.payload as { acceptance?: SpliceAcceptance } | undefined)?.acceptance;
      if (reply?.type !== 'SPLICE_ACCEPT' || !acceptance) {
        throw new Error(`Counterparty did not accept the splice (${reply?.type ?? 'timeout'})`);
      }
      context.spliceAcceptances!.set(unsigned.spliceId, acceptance);

      const preparedOperationId = operationId(params);
      const expiresAt = Date.now() + 300_000;
      const base = {
        domain: 'splice' as const,
        signers: [localPkd],
        custody: makeSelfCustody(),
        expiresAt,
      };
      const quiesceIntent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        domain: 'channel',
        requestId: `${preparedOperationId}:quiesce:intent`,
        kind: 'intent',
        digest: quiesceUnsigned.updateDigest,
        context: { summary: `Authorize quiesce before ${type === 'in' ? 'splice-in' : 'splice-out'}` },
      };
      const quiesceUpdate: import('@totemsdk/omnia').SignRequest = {
        ...base,
        domain: 'channel',
        requestId: `${preparedOperationId}:quiesce:update`,
        kind: 'chain',
        digest: quiesceUnsigned.updateDigest,
        context: { summary: 'Sign the quiesce channel update' },
      };
      const quiesceSettlement: import('@totemsdk/omnia').SignRequest = {
        ...base,
        domain: 'channel',
        requestId: `${preparedOperationId}:quiesce:settlement`,
        kind: 'chain',
        digest: quiesceUnsigned.settlementDigest,
        context: { summary: 'Sign the quiesce settlement package' },
      };
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest: unsigned.digest,
        context: {
          summary: `Authorize ${type === 'in' ? 'splice-in' : 'splice-out'} on ${channelId}`,
          amount: unsigned.params.newTotalValue.toString(),
        },
      };
      const splice: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:splice`,
        kind: 'chain',
        digest: unsigned.digest,
        context: { summary: 'Sign the splice transaction' },
      };
      for (const [key, entry] of context.preparedSplice!) {
        if (entry.expiresAt <= Date.now()) context.preparedSplice!.delete(key);
      }
      context.preparedSplice!.set(preparedOperationId, {
        channelId,
        quiescedChannel,
        quiesce: {
          unsigned: quiesceUnsigned,
          intent: quiesceIntent,
          update: quiesceUpdate,
          settlement: quiesceSettlement,
        },
        unsigned,
        acceptance,
        intent,
        splice,
        expiresAt,
      });
      return {
        success: true,
        status: 'signature-required',
        operationId: preparedOperationId,
        channelId,
        spliceId: unsigned.spliceId,
        spliceType: type,
        requests: {
          quiesce: { intent: quiesceIntent, update: quiesceUpdate, settlement: quiesceSettlement },
          splice: { intent, chain: splice },
        },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPrepareSpliceIn', prepareSplice('in'));
  methods.set('omnia/prepareSpliceIn', prepareSplice('in'));
  methods.set('totem_omniaPrepareSpliceOut', prepareSplice('out'));
  methods.set('omnia/prepareSpliceOut', prepareSplice('out'));

  const submitSplice: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const preparedOperationId = requiredString(params, 'preparedOperationId');
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedSplice) throw new Error('Prepared-splice store is not configured');
    return withOperation(context, params, async () => {
      const entry = context.preparedSplice!.get(preparedOperationId);
      if (!entry) throw new Error(`Prepared splice ${preparedOperationId} not found`);
      if (entry.expiresAt <= Date.now()) {
        context.preparedSplice!.delete(preparedOperationId);
        throw new Error(`Prepared splice ${preparedOperationId} has expired`);
      }
      const quiesceIntentSignature = hexBytes(params.quiesceIntentSignature, 'quiesceIntentSignature');
      const quiesceUpdateSignature = hexBytes(params.quiesceUpdateSignature, 'quiesceUpdateSignature');
      const quiesceSettlementSignature = hexBytes(params.quiesceSettlementSignature, 'quiesceSettlementSignature');
      const spliceIntentSignature = hexBytes(params.spliceIntentSignature, 'spliceIntentSignature');
      const spliceSignature = hexBytes(params.spliceSignature, 'spliceSignature');
      const updateIndices = signingIndicesParam(params.quiesceUpdateIndices);
      const settlementIndices = signingIndicesParam(params.quiesceSettlementIndices);
      const spliceIndices = params.spliceIndices
        ? signingIndicesParam(params.spliceIndices)
        : { addressIndex: 0, l1: 0, l2: 0 };

      if (!verifyChannelSignature(quiesceIntentSignature, signRequestPayload(entry.quiesce.intent), localPkd)) {
        throw new Error('quiesce intent signature does not verify');
      }
      if (!verifyChannelSignature(quiesceUpdateSignature, entry.quiesce.unsigned.updateDigest, localPkd)) {
        throw new Error('quiesce update signature does not verify');
      }
      if (!verifyChannelSignature(quiesceSettlementSignature, entry.quiesce.unsigned.settlementDigest, localPkd)) {
        throw new Error('quiesce settlement signature does not verify');
      }
      if (!verifyChannelSignature(spliceIntentSignature, signRequestPayload(entry.intent), localPkd)) {
        throw new Error('splice intent signature does not verify');
      }
      if (!verifyChannelSignature(spliceSignature, entry.unsigned.digest, localPkd)) {
        throw new Error('splice signature does not verify');
      }
      if (!context.chainProvider?.broadcastTxPoW) {
        throw new Error('Splice requires a chain provider with broadcastTxPoW');
      }

      const quiesceState = finalizeStateUpdateWithIndices(
        entry.quiesce.unsigned,
        quiesceUpdateSignature,
        updateIndices,
        quiesceSettlementSignature,
        settlementIndices,
      );
      const quiescedChannel: QuiescedChannel = {
        ...entry.quiescedChannel,
        balances: quiesceState.balances!,
        currentSequence: quiesceState.sequence!,
        pendingHTLCs: [],
        latestState: quiesceState as SignedChannelState,
        quiesceSignedState: quiesceState as SignedChannelState,
        status: 'quiesced',
        updatedAt: Date.now(),
      };
      const { digest: _digest, ...unsignedBase } = entry.unsigned;
      const proposal: SpliceProposal = {
        ...unsignedBase,
        proposerSignature: spliceSignature,
        proposerReservationId: '',
        proposerSigningIndices: spliceIndices,
        proposedAt: Date.now(),
      };
      // OMN-053: broadcasting needs the spending proofs for every input.
      const proofList = (value: unknown, name: string): Uint8Array[] => {
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error(`submitSplice requires ${name} for every spending input`);
        }
        return value.map((entry, index) => hexBytes(entry, `${name}[${index}]`));
      };
      const spliced = await finalizeSplice(quiescedChannel, proposal, entry.acceptance, {
        broadcast: (txHex) => context.chainProvider!.broadcastTxPoW!(txHex),
        // CAN-011: without on-chain observation a splice cannot be active.
        chainProvider: context.chainProvider,
        coinProofs: proofList(params.coinProofsHex, 'coinProofsHex'),
        scriptProofs: proofList(params.scriptProofsHex, 'scriptProofsHex'),
      });
      context.channels.set(entry.channelId, spliced as unknown as OmniaChannel);
      if (context.swarm) {
        const remote = spliced.parties.find((party) => party.partyId !== context.localParticipant!.partyId);
        if (remote) {
          const peer = await context.swarm.connectToPeer(
            remote.publicKeyDigest,
            entry.channelId,
            remote.transportPubkey,
          );
          await peer.sendMessage({
            type: 'SPLICE_FINALIZED',
            channelId: entry.channelId,
            nonce: Date.now(),
            payload: {
              channel: spliced,
              txId: spliced.spliceFundingTxId,
              spliceId: entry.unsigned.spliceId,
            },
          });
        }
      }
      context.preparedSplice!.delete(preparedOperationId);
      return {
        success: true,
        channelId: entry.channelId,
        spliceId: entry.unsigned.spliceId,
        spliceType: spliced.spliceType,
        totalValue: atomsToAmount(spliced.totalValue),
        balances: amountRecordJson(spliced.balances),
        fundingCoinId: spliced.spliceFundingCoinId,
      };
    });
  };
  methods.set('totem_omniaSubmitSplice', submitSplice);
  methods.set('omnia/submitSplice', submitSplice);

  const prepareFactory: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedFactory) throw new Error('Prepared-factory store is not configured');
    const participantsRaw = params.participants;
    if (!Array.isArray(participantsRaw) || participantsRaw.length < 2) {
      throw new Error('participants must contain at least two factory participants');
    }
    const participants = participantsRaw.map((value) => {
      if (!value || typeof value !== 'object') throw new Error('Invalid factory participant');
      const item = value as Record<string, unknown>;
      return {
        partyId: requiredString(item, 'partyId'),
        publicKeyDigest: requiredString(item, 'publicKeyDigest'),
        addressIndex: Number(item.addressIndex ?? 0),
        contributionAmount: rpcAmountToAtoms(requiredString(item, 'contributionAmount'), 'contributionAmount'),
        fundingCoinId: typeof item.fundingCoinId === 'string' ? item.fundingCoinId : undefined,
        settlementAddress: typeof item.settlementAddress === 'string' ? item.settlementAddress : undefined,
        transportPubkey: typeof item.transportPubkey === 'string' ? item.transportPubkey : undefined,
      } satisfies FactoryParticipant;
    });
    assertTwoPartyFactory(participants);
    const toBytes = (value: unknown): Uint8Array | undefined =>
      typeof value === 'string' ? Buffer.from(value.replace(/^0x/i, ''), 'hex') : undefined;
    const fundingMaterials: FactoryFundingMaterial[] | undefined = Array.isArray(params.funding)
      ? params.funding.map((value) => {
          if (!value || typeof value !== 'object') throw new Error('Invalid factory funding material');
          const item = value as Record<string, unknown>;
          const coinProof = toBytes(item.coinProof);
          if (!coinProof) throw new Error('factory funding material requires coinProof');
          return {
            partyId: requiredString(item, 'partyId'),
            coinProof,
            ...(typeof item.coinAddress === 'string' ? { coinAddress: item.coinAddress } : {}),
            ...(typeof item.script === 'string' ? { script: item.script } : {}),
            ...(toBytes(item.scriptProof) ? { scriptProof: toBytes(item.scriptProof) } : {}),
          } satisfies FactoryFundingMaterial;
        })
      : undefined;
    const tokenId = typeof params.tokenId === 'string' ? params.tokenId : '0x00';
    const tokenScale = typeof params.tokenScale === 'number' ? params.tokenScale : 0;
    const remote = participants.find((participant) => participant.publicKeyDigest !== localPkd);

    return withOperation(context, params, async () => {
      const plan = await buildFactoryOpening(
        participants,
        tokenId,
        tokenScale,
        context.chainProvider,
        fundingMaterials,
        factoryScriptOptions(params),
      );
      const preparedOperationId = operationId(params);
      const expiresAt = Date.now() + 300_000;
      const commitment = Buffer.from(plan.factory.pendingCommitment!, 'hex');
      const base = {
        domain: 'factory' as const,
        signers: [localPkd],
        custody: makeSelfCustody(),
        expiresAt,
      };
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest: commitment,
        context: {
          summary: `Authorize factory opening (${plan.factory.totalValue} units)`,
          amount: atomsToAmount(plan.factory.totalValue),
          asset: plan.factory.tokenId,
        },
      };
      const commitmentRequest: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:commitment`,
        kind: 'chain',
        digest: commitment,
        context: { summary: 'Sign the factory funding/opening commitment' },
      };
      for (const [key, entry] of context.preparedFactory!) {
        if (entry.expiresAt <= Date.now()) context.preparedFactory!.delete(key);
      }
      context.preparedFactory!.set(preparedOperationId, {
        plan,
        remotePartyId: remote?.partyId,
        intent,
        commitment: commitmentRequest,
        expiresAt,
      });
      return {
        success: true,
        status: 'signature-required',
        operationId: preparedOperationId,
        factoryId: plan.factory.factoryId,
        onChain: plan.onChain,
        fundingCoinId: plan.fundingCoinId,
        totalValue: atomsToAmount(plan.factory.totalValue),
        requests: { intent, commitment: commitmentRequest },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPrepareFactory', prepareFactory);
  methods.set('omnia/prepareFactory', prepareFactory);

  const submitFactory: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const preparedOperationId = requiredString(params, 'preparedOperationId');
    const localPkd = context.localParticipant?.publicKeyDigest;
    const localPartyId = context.localParticipant?.partyId;
    if (!localPkd || !localPartyId) throw new Error('Local participant is not configured');
    if (!context.preparedFactory) throw new Error('Prepared-factory store is not configured');
    return withOperation(context, params, async () => {
      const entry = context.preparedFactory!.get(preparedOperationId);
      if (!entry) throw new Error(`Prepared factory ${preparedOperationId} not found`);
      if (entry.expiresAt <= Date.now()) {
        context.preparedFactory!.delete(preparedOperationId);
        throw new Error(`Prepared factory ${preparedOperationId} has expired`);
      }
      const intentSignature = hexBytes(params.intentSignature, 'intentSignature');
      const commitmentSignature = hexBytes(params.commitmentSignature, 'commitmentSignature');
      const commitment = Buffer.from(entry.plan.factory.pendingCommitment!, 'hex');
      if (!verifyChannelSignature(intentSignature, signRequestPayload(entry.intent), localPkd)) {
        throw new Error('intent signature does not verify');
      }
      if (!verifyChannelSignature(commitmentSignature, commitment, localPkd)) {
        throw new Error('factory commitment signature does not verify');
      }
      if (!context.chainProvider && entry.plan.onChain) throw new Error('Factory funding requires a chain provider');

      let factory: ChannelFactory = {
        ...entry.plan.factory,
        pendingSignatures: { [localPartyId]: commitmentSignature },
      };
      let peer: any;
      if (context.swarm && entry.remotePartyId) {
        const remote = entry.plan.factory.participants.find((participant) => participant.partyId === entry.remotePartyId);
        if (remote) {
          peer = await context.swarm.connectToPeer(remote.publicKeyDigest, factory.factoryId, remote.transportPubkey);
          const reply = await requestPeerReply(
            peer,
            {
              type: 'FACTORY_PROPOSAL',
              channelId: factory.factoryId,
              nonce: Date.now(),
              payload: {
                factory,
                onChain: entry.plan.onChain,
                ...(entry.plan.onChain ? { fundingMaterials: entry.plan.fundingMaterials } : {}),
              },
            },
            factory.factoryId,
            30_000,
            ['FACTORY_ACCEPT', 'ERROR'],
          );
          if (reply?.type !== 'FACTORY_ACCEPT') {
            throw new Error(`Counterparty did not accept the factory (${reply?.type ?? 'timeout'})`);
          }
          const accepted = (reply.payload as { factory?: ChannelFactory } | undefined)?.factory;
          if (!accepted) throw new Error('Factory accept reply missing factory');
          if (accepted.factoryId !== factory.factoryId) {
            throw new Error('Counterparty accepted a different factory');
          }
          if (accepted.status === 'active') {
            if (entry.plan.onChain) throw new Error('Counterparty committed the factory before funding');
            factory = accepted;
          } else {
            factory = { ...factory, pendingSignatures: accepted.pendingSignatures };
          }
        }
      }

      let fundingSignatures: Record<string, Uint8Array> | undefined;
      if (entry.plan.onChain) {
        if (!entry.plan.fundingDigest) throw new Error('On-chain factory plan has no funding digest');
        fundingSignatures = { [localPartyId]: commitmentSignature };
        if (peer && entry.remotePartyId) {
          const reply = await requestPeerReply(
            peer,
            {
              type: 'FACTORY_FUNDING_REQUEST',
              channelId: factory.factoryId,
              nonce: Date.now(),
              payload: { digest: '0x' + Buffer.from(entry.plan.fundingDigest).toString('hex') },
            },
            factory.factoryId,
            30_000,
            ['FACTORY_FUNDING_RESPONSE', 'ERROR'],
          );
          const signature = (reply?.payload as { signature?: string } | undefined)?.signature;
          if (!signature) throw new Error(`Counterparty did not co-sign factory funding (${reply?.type ?? 'timeout'})`);
          fundingSignatures[entry.remotePartyId] = Uint8Array.from(Buffer.from(signature.replace(/^0x/i, ''), 'hex'));
        }
      }

      if (factory.status !== 'active') {
        factory = await finalizeFactoryOpening(
          entry.plan,
          { fundingSignatures, openingSignatures: factory.pendingSignatures },
          context.chainProvider,
        );
      }
      context.factories?.set(factory.factoryId, factory);
      if (peer) {
        await peer.sendMessage({
          type: 'FACTORY_FINALIZED',
          channelId: factory.factoryId,
          nonce: Date.now(),
          payload: { factory },
        });
      }
      context.preparedFactory!.delete(preparedOperationId);
      return { success: true, factoryId: factory.factoryId, status: factory.status, fundingTxId: factory.fundingTxId };
    });
  };
  methods.set('totem_omniaSubmitFactory', submitFactory);
  methods.set('omnia/submitFactory', submitFactory);

  /**
   * OMN-041: pool capacity must be backed by a real, confirmed, unspent coin.
   * The returned backing is what later mints are conserved against.
   */
  const verifyVtxoPoolBacking = async (
    params: Record<string, unknown>,
    totalCapacity: bigint,
    tokenId: string,
    ownerAddress: string | undefined,
  ) => {
    const chain = context.chainProvider;
    if (!chain?.getCoin) {
      throw new Error('createVtxoPool requires a chain provider to verify the backing coin');
    }
    const coinId = requiredString(params, 'backingCoinId');
    const coin = await chain.getCoin(coinId);
    if (!coin) throw new Error(`VTXO pool backing coin ${coinId} not found on chain`);
    if (coin.spent) throw new Error(`VTXO pool backing coin ${coinId} is already spent`);
    if ((coin.tokenid ?? '0x00') !== tokenId) {
      throw new Error(`VTXO pool backing coin token ${String(coin.tokenid)} does not match ${tokenId}`);
    }
    if (coinAmountAtoms(coin) < totalCapacity) {
      throw new Error(
        `VTXO pool backing coin covers ${atomsToAmount(coinAmountAtoms(coin))} but capacity is ${atomsToAmount(totalCapacity)}`,
      );
    }
    if (!coin.mmrentry || coin.mmrentry === '0') {
      throw new Error(`VTXO pool backing coin ${coinId} is not chain-confirmed`);
    }
    let confirmations = 1;
    if (typeof chain.getTip === 'function' && coin.created !== undefined) {
      const tip = await chain.getTip();
      confirmations = Math.max(0, Number(tip.block) - Number(coin.created) + 1);
      if (confirmations < 1) throw new Error(`VTXO pool backing coin ${coinId} is not confirmed`);
    }
    if (ownerAddress) {
      const normalize = (value: string | undefined) => (value ?? '').replace(/^0x/i, '').toLowerCase();
      const owned = normalize(coin.address) === normalize(ownerAddress)
        || normalize(coin.miniaddress) === normalize(ownerAddress);
      if (!owned) {
        throw new Error(`VTXO pool backing coin ${coinId} is not owned by the pool operator`);
      }
    }
    return {
      coinId,
      amount: coinAmountAtoms(coin),
      tokenId,
      confirmations,
      verifiedAt: Date.now(),
      ...(coin.address ? { address: coin.address } : {}),
    };
  };

  const createVtxoPoolMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxoPools) throw new Error('VTXO stores are not configured');
    const localPkd = context.localParticipant?.publicKeyDigest;
    const operator = typeof params.operator === 'string' ? params.operator : localPkd;
    if (!operator) throw new Error('VTXO pool operator is required');
    const totalCapacity = requiredAmount(params, 'totalCapacity');
    const tokenId = typeof params.tokenId === 'string' ? params.tokenId : '0x00';
    const backing = await verifyVtxoPoolBacking(
      params,
      totalCapacity,
      tokenId,
      typeof params.fundingAddress === 'string' ? params.fundingAddress : context.fundingAddress,
    );
    const pool = createVtxoPoolSdk({
      operator,
      tokenId,
      totalCapacity,
      nonce: requiredString(params, 'nonce'),
      ...(params.policy && typeof params.policy === 'object' ? { policy: params.policy as Record<string, unknown> } : {}),
    }, typeof params.now === 'number' ? params.now : Date.now());
    // OMN-045: creation is create-only. Repeating the request must not reset
    // capacity, epoch or the membership set of a pool that already issued
    // claims.
    const existing = context.vtxoPools.get(pool.poolId);
    if (existing) {
      if (existing.totalCapacity !== pool.totalCapacity || existing.tokenId !== pool.tokenId) {
        throw new Error(`VTXO pool ${pool.poolId} already exists with different terms`);
      }
      return { success: true, pool: jsonSafe(existing), existed: true };
    }
    const backedPool = { ...pool, backing };
    context.vtxoPools.set(backedPool.poolId, backedPool);
    return { success: true, pool: jsonSafe(backedPool) };
  };
  methods.set('totem_omniaCreateVtxoPool', createVtxoPoolMethod);
  methods.set('omnia/createVtxoPool', createVtxoPoolMethod);

  const mintVtxoMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxoPools || !context.vtxos || !context.vtxoReceipts) throw new Error('VTXO stores are not configured');
    const pool = context.vtxoPools.get(requiredString(params, 'poolId'));
    if (!pool) throw new Error(`VTXO pool ${String(params.poolId)} not found`);
    // OMN-041: no unbacked issuance. The pool must carry verified backing and
    // the backing coin must still be unspent and cover the mint.
    const backing = pool.backing;
    if (!backing) {
      throw new Error(`VTXO pool ${pool.poolId} has no verified on-chain backing`);
    }
    const amount = requiredAmount(params, 'amount');
    const issued = pool.members.length > 0
      ? pool.totalCapacity - pool.availableCapacity
      : 0n;
    if (issued + amount > backing.amount) {
      throw new Error(
        `VTXO pool ${pool.poolId} would issue ${atomsToAmount(issued + amount)} against ${atomsToAmount(backing.amount)} of verified backing`,
      );
    }
    if (context.chainProvider?.getCoin) {
      const coin = await context.chainProvider.getCoin(backing.coinId);
      if (!coin) throw new Error(`VTXO pool backing coin ${backing.coinId} is no longer on chain`);
      if (coin.spent) throw new Error(`VTXO pool backing coin ${backing.coinId} has been spent`);
      if (coinAmountAtoms(coin) < backing.amount) {
        throw new Error(`VTXO pool backing coin ${backing.coinId} no longer covers the pool capacity`);
      }
    }
    const minted = mintVtxo(pool, {
      owner: requiredString(params, 'owner'),
      amount,
      nonce: requiredString(params, 'nonce'),
      expiresAt: typeof params.expiresAt === 'number' ? params.expiresAt : undefined,
      fundingProof: params.fundingProof,
    }, typeof params.now === 'number' ? params.now : undefined);
    // OMN-041: issuance is provisional until the operator co-signs the receipt.
    const provisional = { ...minted.vtxo, status: 'provisional' as const };
    const storedVtxo = params.claimPolicy && typeof params.claimPolicy === 'object'
      ? { ...provisional, claimPolicy: params.claimPolicy as OmniaVtxo['claimPolicy'] }
      : provisional;
    context.vtxoPools.set(pool.poolId, minted.pool);
    context.vtxos.set(storedVtxo.vtxoId, storedVtxo);
    context.vtxoReceipts.set(minted.receipt.receiptId, minted.receipt);
    return { success: true, pool: jsonSafe(minted.pool), vtxo: jsonSafe(storedVtxo), receipt: jsonSafe(minted.receipt) };
  };
  methods.set('totem_omniaMintVtxo', mintVtxoMethod);
  methods.set('omnia/mintVtxo', mintVtxoMethod);

  const verifyVtxoClaimMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxos) throw new Error('VTXO stores are not configured');
    const vtxo = context.vtxos.get(requiredString(params, 'vtxoId'));
    if (!vtxo) throw new Error(`VTXO ${String(params.vtxoId)} not found`);
    if (!context.vtxoClaimVerifier) {
      throw new Error('verifyVtxoClaim requires a configured claim signature verifier');
    }
    const tip = context.chainProvider ? (await context.chainProvider.getTip()).block : undefined;
    if (tip === undefined) throw new Error('verifyVtxoClaim requires a chain provider for the authoritative block');
    if (typeof params.block === 'number' && params.block > tip) {
      throw new Error(`claim block ${params.block} is ahead of the chain tip ${tip}`);
    }
    const witnessSigners = Array.isArray(params.signers) ? params.signers.map(String) : [];
    const signatures = Array.isArray(params.signatures)
      ? (params.signatures as Array<Record<string, unknown>>).map((entry) => ({
          signer: String(entry.signer ?? ''),
          signature: String(entry.signature ?? ''),
          ...(typeof entry.publicKey === 'string' ? { publicKey: entry.publicKey } : {}),
        }))
      : undefined;
    const htlc = params.htlc && typeof params.htlc === 'object'
      ? params.htlc as { paymentId: string; hashlock: string; status: 'pending' | 'fulfilled' | 'timed_out' }
      : undefined;
    const result = await verifyVtxoClaim(vtxo, {
      signers: witnessSigners,
      ...(signatures ? { signatures } : {}),
      preimage: typeof params.preimage === 'string' ? params.preimage : undefined,
      path: params.path === 'refund' ? 'refund' : params.path === 'claim' ? 'claim' : undefined,
      scope: params.scope === 'transfer' ? 'transfer' : params.scope === 'claim' ? 'claim' : undefined,
      claimAmount: params.claimAmount !== undefined ? amountToAtoms(String(params.claimAmount)) : undefined,
    }, {
      block: tip,
      poolId: typeof params.poolId === 'string' ? params.poolId : vtxo.poolId,
      tokenId: typeof params.tokenId === 'string' ? params.tokenId : vtxo.tokenId,
      htlc,
    }, {
      verifySignature: context.vtxoClaimVerifier,
      chainTip: tip,
    });
    // Never name this `success`: policy satisfaction is not authorization.
    return { success: result.valid, policySatisfied: result.valid, evaluated: true, ...result };
  };
  methods.set('totem_omniaVerifyVtxoClaim', verifyVtxoClaimMethod);
  methods.set('omnia/verifyVtxoClaim', verifyVtxoClaimMethod);

  const verifyVtxoExitEntitlementMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxos) throw new Error('VTXO stores are not configured');
    const vtxo = context.vtxos.get(requiredString(params, 'vtxoId'));
    if (!vtxo) throw new Error(`VTXO ${String(params.vtxoId)} not found`);
    if (!params.entitlement || typeof params.entitlement !== 'object') {
      throw new Error('entitlement is required');
    }
    // OMN-025: fail closed. The host cannot certify a witness it cannot verify.
    if (!context.vtxoExitWitnessVerifier) {
      throw new Error('omnia/verifyVtxoExitEntitlement requires a configured witness verifier');
    }
    const pool = context.vtxoPools?.get(vtxo.poolId);
    const result = verifyVtxoExitEntitlement(
      params.entitlement as Parameters<typeof verifyVtxoExitEntitlement>[0],
      vtxo,
      {
        verifyWitness: context.vtxoExitWitnessVerifier,
        ...(pool ? { pool } : {}),
      },
    );
    return { success: result.valid, ...result };
  };
  methods.set('totem_omniaVerifyVtxoExitEntitlement', verifyVtxoExitEntitlementMethod);
  methods.set('omnia/verifyVtxoExitEntitlement', verifyVtxoExitEntitlementMethod);

  const transferVtxoMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxos || !context.vtxoReceipts) throw new Error('VTXO stores are not configured');
    const vtxo = context.vtxos.get(requiredString(params, 'vtxoId'));
    if (!vtxo) throw new Error(`VTXO ${String(params.vtxoId)} not found`);
    if (!params.exitEntitlement && params.unsafeLedgerTransfer !== true) {
      throw new Error('omnia/transferVtxo requires a verified exitEntitlement (or explicit unsafeLedgerTransfer:true for legacy ledger-only use)');
    }
    const result = transferVtxo(vtxo, {
      recipient: requiredString(params, 'recipient'),
      amount: requiredAmount(params, 'amount'),
      nonce: requiredString(params, 'nonce'),
      changeNonce: typeof params.changeNonce === 'string' ? params.changeNonce : undefined,
      ...(params.exitEntitlement && typeof params.exitEntitlement === 'object'
        ? { exitEntitlement: params.exitEntitlement as OmniaVtxo['exitEntitlement'] }
        : {}),
    }, typeof params.now === 'number' ? params.now : undefined, {
      ...(context.vtxoExitWitnessVerifier ? { verifyExitWitness: context.vtxoExitWitnessVerifier } : {}),
      allowUnverifiedExit: params.unsafeLedgerTransfer === true,
    });
    // OMN-055: transfer outputs are only real claims once the pool consumes the
    // input and republishes its member root.
    const pool = context.vtxoPools?.get(vtxo.poolId);
    let output = result.output;
    let change = result.change;
    let receipt = result.receipt;
    if (pool) {
      const added = [result.output, ...(result.change ? [result.change] : [])];
      const transition = transitionPoolMembers(pool, {
        consume: [result.input.vtxoId],
        add: added,
      });
      output = { ...result.output, epoch: transition.pool.epoch, proof: transition.proofs[result.output.vtxoId] };
      change = result.change
        ? { ...result.change, epoch: transition.pool.epoch, proof: transition.proofs[result.change.vtxoId] }
        : undefined;
      receipt = { ...result.receipt, epoch: transition.pool.epoch };
      context.vtxoPools!.set(transition.pool.poolId, transition.pool);
    }
    context.vtxos.set(result.input.vtxoId, result.input);
    context.vtxos.set(output.vtxoId, output);
    if (change) context.vtxos.set(change.vtxoId, change);
    context.vtxoReceipts.set(receipt.receiptId, receipt);
    return {
      success: true,
      input: jsonSafe(result.input),
      output: jsonSafe(output),
      change: change ? jsonSafe(change) : undefined,
      receipt: jsonSafe(receipt),
      exitReady: (result as { exitReady?: boolean }).exitReady,
    };
  };
  methods.set('totem_omniaTransferVtxo', transferVtxoMethod);
  methods.set('omnia/transferVtxo', transferVtxoMethod);

  const refreshVtxoMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxos || !context.vtxoReceipts) throw new Error('VTXO stores are not configured');
    const vtxo = context.vtxos.get(requiredString(params, 'vtxoId'));
    if (!vtxo) throw new Error(`VTXO ${String(params.vtxoId)} not found`);
    const result = refreshVtxo(vtxo, {
      newEpoch: Number(params.newEpoch),
      nonce: requiredString(params, 'nonce'),
    }, typeof params.now === 'number' ? params.now : undefined);
    let refreshed = result.refreshed;
    if (context.vtxoPools) {
      const pool = context.vtxoPools.get(vtxo.poolId);
      if (pool) {
        // OMN-055: the refresh output must join the pool membership set at the
        // new epoch, and the consumed input leaves it.
        const transition = transitionPoolMembers(pool, {
          consume: [result.old.vtxoId],
          add: [result.refreshed],
          epoch: result.refreshed.epoch,
        });
        refreshed = { ...result.refreshed, proof: transition.proofs[result.refreshed.vtxoId] };
        context.vtxoPools.set(pool.poolId, transition.pool);
      }
    }
    context.vtxos.set(result.old.vtxoId, result.old);
    context.vtxos.set(refreshed.vtxoId, refreshed);
    context.vtxoReceipts.set(result.receipt.receiptId, result.receipt);
    return { success: true, old: jsonSafe(result.old), refreshed: jsonSafe(refreshed), receipt: jsonSafe(result.receipt) };
  };
  methods.set('totem_omniaRefreshVtxo', refreshVtxoMethod);
  methods.set('omnia/refreshVtxo', refreshVtxoMethod);

  const initiateVtxoExitMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxos || !context.vtxoReceipts) throw new Error('VTXO stores are not configured');
    const vtxo = context.vtxos.get(requiredString(params, 'vtxoId'));
    if (!vtxo) throw new Error(`VTXO ${String(params.vtxoId)} not found`);
    const now = typeof params.now === 'number' ? params.now : undefined;
    // OMN-088: the draft reserves the VTXO; a repeat returns the original draft.
    const draft = await createExitDraft(vtxo, vtxoExitDraftStoreFor(context), now);
    const exiting = draft.created ? markExiting(vtxo, now) : vtxo;
    context.vtxos.set(exiting.vtxoId, exiting);
    context.vtxoReceipts.set(draft.receipt.receiptId, draft.receipt);
    return {
      success: true,
      created: draft.created,
      vtxo: jsonSafe(exiting),
      draft: jsonSafe(draft.draft),
      receipt: jsonSafe(draft.receipt),
    };
  };
  methods.set('totem_omniaInitiateVtxoExit', initiateVtxoExitMethod);
  methods.set('omnia/initiateVtxoExit', initiateVtxoExitMethod);

  const completeVtxoExitMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxos) throw new Error('VTXO stores are not configured');
    const vtxo = context.vtxos.get(requiredString(params, 'vtxoId'));
    if (!vtxo) throw new Error(`VTXO ${String(params.vtxoId)} not found`);
    // OMN-042: completion requires verified chain evidence, not a caller string.
    const txpowId = requiredString(params, 'txpowId');
    const verifier = context.vtxoExitVerifier;
    if (!verifier) {
      throw new Error('completeVtxoExit requires a configured exit verifier');
    }
    const requiredDepth = typeof params.confirmations === 'number' ? params.confirmations : 1;
    const evidence = await verifier({ vtxo, txpowId });
    if (!evidence.valid) {
      throw new Error(`VTXO exit ${txpowId} is not verified: ${evidence.reason ?? 'unverified'}`);
    }
    const normalize = (value: string | undefined) => (value ?? '').replace(/^0x/i, '').toLowerCase();
    if (evidence.owner && normalize(evidence.owner) !== normalize(vtxo.owner)) {
      throw new Error(`VTXO exit ${txpowId} pays ${evidence.owner}, not the VTXO owner`);
    }
    if (evidence.amount !== undefined && evidence.amount < vtxo.amount) {
      throw new Error(`VTXO exit ${txpowId} pays ${atomsToAmount(evidence.amount)} but the VTXO is ${atomsToAmount(vtxo.amount)}`);
    }
    if (evidence.tokenId && evidence.tokenId !== vtxo.tokenId) {
      throw new Error(`VTXO exit ${txpowId} pays token ${evidence.tokenId}, not ${vtxo.tokenId}`);
    }
    if ((evidence.confirmations ?? 0) < requiredDepth) {
      throw new Error(`VTXO exit ${txpowId} has ${evidence.confirmations ?? 0} confirmations, need ${requiredDepth}`);
    }
    const exited = markExited(vtxo, {
      txpowId,
      evidence: { confirmed: true },
      now: typeof params.now === 'number' ? params.now : undefined,
    });
    context.vtxos.set(exited.vtxoId, exited);
    return { success: true, vtxo: jsonSafe(exited), evidence: jsonSafe(evidence) };
  };
  methods.set('totem_omniaCompleteVtxoExit', completeVtxoExitMethod);
  methods.set('omnia/completeVtxoExit', completeVtxoExitMethod);

  const prepareVtxoReceipt: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.vtxoReceipts || !context.vtxos || !context.preparedVtxoReceipts) {
      throw new Error('VTXO stores are not configured');
    }
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    const receipt = context.vtxoReceipts.get(requiredString(params, 'receiptId'));
    if (!receipt) throw new Error(`VTXO receipt ${String(params.receiptId)} not found`);
    const outputs = receipt.outputIds.map((id) => {
      const vtxo = context.vtxos!.get(id);
      if (!vtxo) throw new Error(`VTXO ${id} referenced by receipt is not stored`);
      return vtxo;
    });
    // The receipt's own epoch is authoritative; a caller may not relabel it.
    if (typeof params.epoch === 'number' && params.epoch !== receipt.epoch) {
      throw new Error(`receipt epoch ${receipt.epoch} does not match the requested epoch ${params.epoch}`);
    }
    const epoch = receipt.epoch;
    const pool = context.vtxoPools?.get(receipt.poolId) ?? context.vtxoPools?.get(outputs[0]?.poolId ?? '');
    const root = pool?.commitmentRoot
      ?? (typeof params.root === 'string' ? params.root : outputs[0]?.proof.root);
    if (!root) throw new Error('VTXO receipt root is required');
    const payload = buildVtxoReceiptPayload(receipt, {
      outputs,
      // OMN-047: pool roots commit every member, so the receipt is verified
      // against the pool's authoritative member set.
      ...(pool?.members?.length ? { poolMembers: pool.members } : {}),
      root,
      epoch,
      previousEpoch: typeof params.previousEpoch === 'number' ? params.previousEpoch : undefined,
      inputsAmount: params.inputsAmount !== undefined ? amountToAtoms(String(params.inputsAmount)) : undefined,
    });
    const request: SignRequest = {
      requestId: `vtxo-receipt-${receipt.receiptId}`,
      kind: 'chain',
      domain: 'vtxo',
      digest: payload,
      context: { summary: `Co-sign VTXO ${receipt.op} receipt` },
      signers: [localPkd],
      custody: makeSelfCustody(),
      expiresAt: Date.now() + 120_000,
    };
    const expiresAt = Date.now() + 120_000;
    context.preparedVtxoReceipts.set(receipt.receiptId, { receipt, payload, request, expiresAt });
    return { success: true, status: 'signature-required', receiptId: receipt.receiptId, requests: { receipt: request }, expiresAt };
  };
  methods.set('totem_omniaPrepareVtxoReceipt', prepareVtxoReceipt);
  methods.set('omnia/prepareVtxoReceipt', prepareVtxoReceipt);

  const submitVtxoReceipt: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const receiptId = requiredString(params, 'receiptId');
    const localPkd = context.localParticipant?.publicKeyDigest;
    if (!localPkd) throw new Error('Local participant is not configured');
    if (!context.preparedVtxoReceipts || !context.vtxoReceipts) throw new Error('VTXO stores are not configured');
    const entry = context.preparedVtxoReceipts.get(receiptId);
    if (!entry) throw new Error(`Prepared VTXO receipt ${receiptId} not found`);
    if (entry.expiresAt <= Date.now()) {
      context.preparedVtxoReceipts.delete(receiptId);
      throw new Error(`Prepared VTXO receipt ${receiptId} has expired`);
    }
    const signature = hexBytes(params.signature, 'signature');
    if (!verifyChannelSignature(signature, entry.payload, localPkd)) {
      throw new Error('VTXO receipt signature does not verify');
    }
    const signed: VtxoOperatorReceipt = { ...entry.receipt, signature: '0x' + Buffer.from(signature).toString('hex') };
    context.vtxoReceipts.set(receiptId, signed);
    context.preparedVtxoReceipts.delete(receiptId);
    // OMN-041: the operator co-signature is the publication step. Provisional
    // outputs only become transferable once it is stored.
    if (context.vtxos) {
      for (const outputId of entry.receipt.outputIds) {
        const output = context.vtxos.get(outputId);
        if (output && output.status === 'provisional') {
          context.vtxos.set(outputId, {
            ...output,
            status: 'active',
            updatedAt: Date.now(),
            history: [...output.history, { op: 'mint', at: Date.now(), meta: { activatedBy: receiptId } }],
          });
        }
      }
    }
    return { success: true, receipt: jsonSafe(signed) };
  };
  methods.set('totem_omniaSubmitVtxoReceipt', submitVtxoReceipt);
  methods.set('omnia/submitVtxoReceipt', submitVtxoReceipt);

  const createLiquidityPool: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.pools) throw new Error('Pool stores are not configured');
    const poolId = requiredString(params, 'poolId');
    // OMN-050: a fresh registry must never overwrite an existing pool's
    // deposits, allocations, withdrawals or receipts.
    const existingPool = context.pools.get(poolId);
    if (existingPool) {
      const requestedCapacity = String(requiredAmount(params, 'capacity'));
      if (String(existingPool.manifest.totalCapacity ?? '') !== requestedCapacity) {
        throw new Error(`liquidity pool ${poolId} already exists with different capacity`);
      }
      return { success: true, pool: jsonSafe(existingPool.manifest), registry: jsonSafe(existingPool.registry), existed: true };
    }
    const created = createOmniaPool({
      poolId,
      operatorAddress: requiredString(params, 'operatorAddress'),
      tokenId: typeof params.tokenId === 'string' ? params.tokenId : '0x00',
      purpose: requiredString(params, 'purpose') as never,
      poolType: requiredString(params, 'poolType') as never,
      capacity: String(requiredAmount(params, 'capacity')),
      feePolicy: params.feePolicy as never,
      riskPolicy: params.riskPolicy as never,
      lockTerms: params.lockTerms as never,
      operatorBond: params.operatorBond as never,
      metadata: params.metadata as Record<string, unknown> | undefined,
    }, createEmptyLiquidityBondRegistryState());
    context.pools.set(created.manifest.poolId, { manifest: created.manifest, registry: created.registry });
    return { success: true, pool: jsonSafe(created.manifest), registry: jsonSafe(created.registry) };
  };
  methods.set('totem_omniaCreateLiquidityPool', createLiquidityPool);
  methods.set('omnia/createLiquidityPool', createLiquidityPool);

  // OMN-032: one authoritative registry per pool. Positions keep a view for
  // compatibility, but every mutation reads and writes the pool registry.
  const poolRegistryFor = (
    poolId: string,
    fallback: import('@totemsdk/liquidity-bond').LiquidityBondRegistryState,
  ): import('@totemsdk/liquidity-bond').LiquidityBondRegistryState => {
    const pool = context.pools?.get(poolId);
    return pool?.registry ?? fallback;
  };
  const commitPoolRegistry = (poolId: string, registry: any): void => {
    const pool = context.pools?.get(poolId);
    if (pool) context.pools!.set(poolId, { ...pool, registry });
  };

  const depositToLiquidityPool: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.pools || !context.poolPositions) throw new Error('Pool stores are not configured');
    const poolId = requiredString(params, 'poolId');
    const stored = context.pools.get(poolId);
    if (!stored) throw new Error(`Pool ${poolId} not found`);
    const lpAddress = requiredString(params, 'lpAddress');
    const normalizeAddress = (value: string | undefined): string => (value ?? '').replace(/^0x/i, '').toLowerCase();
    const sameAddress = (a: string | undefined, b: string | undefined): boolean => {
      if (!a || !b) return false;
      if (a === b || normalizeAddress(a) === normalizeAddress(b)) return true;
      try {
        return Buffer.from(decodeMx(a)).equals(Buffer.from(decodeMx(b)));
      } catch {
        return false;
      }
    };
    const verifier = {
      verifyDeposit: async (request: { coinId: string; tokenId?: string; claimedAmount?: string }) => {
        const chain = context.chainProvider;
        if (!chain) return { valid: false, reason: 'no chain provider' };
        // OMN-030: use the real deposit contract when the provider implements
        // it; it checks owner, token, amount and confirmation evidence.
        const depositVerifier = chain as unknown as {
          verifyDeposit?: (params: {
            coinId: string; ownerAddress: string; tokenId?: string; claimedAmount?: string;
            requireConfirmed?: boolean; minConfirmations?: number; chainTip?: number;
          }) => Promise<{ valid: boolean; reason?: string; confirmed?: boolean }>;
        };
        const chainTip = typeof chain.getTip === 'function'
          ? (await chain.getTip()).block
          : undefined;
        if (typeof depositVerifier.verifyDeposit === 'function') {
          // OMN-054: a liquidity deposit must be chain-confirmed at depth.
          const result = await depositVerifier.verifyDeposit({
            coinId: request.coinId,
            ownerAddress: lpAddress,
            tokenId: request.tokenId,
            claimedAmount: request.claimedAmount,
            requireConfirmed: true,
            minConfirmations: 1,
            ...(chainTip !== undefined ? { chainTip } : {}),
          });
          if (result.valid && result.confirmed === false) {
            return { valid: false, reason: 'coin is not chain-confirmed' };
          }
          return result;
        }
        const coin = await chain.getCoin(request.coinId);
        if (!coin) return { valid: false, reason: 'coin not found' };
        if (coin.spent) return { valid: false, reason: 'coin is spent' };
        if (!sameAddress(coin.address, lpAddress) && !sameAddress(coin.miniaddress, lpAddress)) {
          return { valid: false, reason: 'coin is not owned by the claimed LP address' };
        }
        if (!coin.mmrentry || coin.mmrentry === '0') return { valid: false, reason: 'coin is not chain-confirmed' };
        // OMN-054: require a real confirmation depth, not just a positive MMR entry.
        const created = Number(coin.created ?? 0);
        const tip = typeof chain.getTip === 'function' ? (await chain.getTip()).block : undefined;
        if (tip === undefined || created <= 0 || tip - created + 1 < 1) {
          return { valid: false, reason: 'coin confirmation depth cannot be established' };
        }
        if (request.tokenId && coin.tokenid !== request.tokenId) return { valid: false, reason: 'token mismatch' };
        if (request.claimedAmount && coinAmountAtoms(coin) < amountToAtoms(request.claimedAmount)) {
          return { valid: false, reason: 'insufficient amount' };
        }
        return { valid: true };
      },
    };
    const deposited = await depositToPool({
      pool: stored.manifest,
      lpAddress,
      amount: String(requiredAmount(params, 'amount')),
      purpose: requiredString(params, 'purpose') as never,
      underlyingUtxoRef: typeof params.underlyingUtxoRef === 'string' ? params.underlyingUtxoRef : undefined,
      underlyingRefs: params.underlyingRefs as never,
      metadata: params.metadata as Record<string, unknown> | undefined,
      chainProvider: verifier as never,
    }, stored.registry);
    context.pools.set(poolId, { manifest: deposited.pool, registry: deposited.state });
    context.poolPositions.set(deposited.position.positionId, { position: deposited.position, registry: deposited.state });
    return {
      success: true,
      poolId,
      position: jsonSafe(deposited.position),
      receipt: jsonSafe(deposited.receipt),
      registry: jsonSafe(deposited.state),
    };
  };
  methods.set('totem_omniaDepositToPool', depositToLiquidityPool);
  methods.set('omnia/depositToPool', depositToLiquidityPool);

  /**
   * OMN-043: the execution ports this host can actually service. Anything else
   * is rejected before any accounting is touched.
   */
  const allocationExecutionContext = (): import('@totemsdk/omnia-pool').OmniaPoolAllocationContext => {
    const injected = context.allocationContext ?? {};
    const routing = context.routing ? {
      router: {
        createChannelGraph,
        addChannel: (graph: ChannelGraph, edge: ChannelGraphEdge) => addRouterChannel(graph, edge),
        findRoute: (
          graph: ChannelGraph,
          from: string,
          to: string,
          amount: bigint,
          tokenId: string,
          opts?: RouteOptions,
        ): Route | undefined => findRouterRoute(graph, from, to, amount, tokenId, opts) ?? undefined,
        executeMultiHopPayment: (
          ops: ChannelOps,
          channels: Map<string, RouterChannel>,
          route: Route,
          request: PaymentRequest,
          leases: Map<string, LeaseProvider>,
        ): Promise<PaymentResult> => executeMultiHopPayment(ops, channels, route, request, leases),
      },
    } : {};
    const vtxo = context.vtxoPools ? {
      vtxo: {
        createPool: async () => {
          throw new Error('allocatePoolCapital cannot create VTXO pools; provision the pool first');
        },
        mintVtxo: async (pool: import('@totemsdk/vtxo').OmniaVtxoPool, mintParams: import('@totemsdk/vtxo').MintVtxoParams) => {
          const stored = context.vtxoPools!.get(pool.poolId);
          if (!stored?.backing) throw new Error(`VTXO pool ${pool.poolId} has no verified on-chain backing`);
          const minted = mintVtxo(stored, mintParams);
          context.vtxoPools!.set(stored.poolId, minted.pool);
          context.vtxos?.set(minted.vtxo.vtxoId, { ...minted.vtxo, status: 'provisional' });
          context.vtxoReceipts?.set(minted.receipt.receiptId, minted.receipt);
          return { pool: minted.pool, vtxo: { ...minted.vtxo, status: 'provisional' } };
        },
        createExitDraft: async (vtxo: import('@totemsdk/vtxo').OmniaVtxo) => (await createExitDraft(vtxo, vtxoExitDraftStoreFor(context))).draft,
        markExiting: async (vtxo: import('@totemsdk/vtxo').OmniaVtxo, now?: number) => markExiting(vtxo, now),
        markExited: async (vtxo: import('@totemsdk/vtxo').OmniaVtxo, txpowId: string, now?: number) => markExited(vtxo, { txpowId, trusted: true, now }),
      },
    } : {};
    return { ...injected, ...routing, ...vtxo } as import('@totemsdk/omnia-pool').OmniaPoolAllocationContext;
  };

  const allocatePoolCapital: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.poolPositions) throw new Error('Pool stores are not configured');
    const positionId = requiredString(params, 'positionId');
    const stored = context.poolPositions.get(positionId);
    if (!stored) throw new Error(`Pool position ${positionId} not found`);
    const target = params.target && typeof params.target === 'object'
      ? params.target as { type?: string }
      : undefined;
    if (!target?.type) throw new Error('allocatePoolCapital requires target.type');
    const execution = allocationExecutionContext();
    const supported = new Set<string>(['reserve']);
    if (execution.omnia) supported.add('channel');
    if (execution.factory) supported.add('factory');
    if (execution.router) supported.add('router');
    if (execution.vtxo) supported.add('vtxo');
    if (!supported.has(target.type)) {
      throw new Error(`allocation target '${target.type}' is not configured on this host`);
    }
    const poolRegistry = poolRegistryFor(stored.position.poolId, stored.registry);
    const allocated = await allocatePositionCapital({
      position: stored.position,
      amount: String(requiredAmount(params, 'amount')),
      allocationType: requiredString(params, 'allocationType') as never,
      purpose: requiredString(params, 'purpose') as never,
      target: params.target as never,
      metadata: params.metadata as Record<string, unknown> | undefined,
      ctx: execution,
    }, poolRegistry);
    commitPoolRegistry(stored.position.poolId, allocated.registry);
    context.poolPositions.set(positionId, { ...stored, position: allocated.position, registry: allocated.registry, allocation: allocated.allocation });
    return {
      success: true,
      position: jsonSafe(allocated.position),
      allocation: jsonSafe(allocated.allocation),
      registry: jsonSafe(allocated.registry),
    };
  };
  methods.set('totem_omniaAllocatePoolCapital', allocatePoolCapital);
  methods.set('omnia/allocatePoolCapital', allocatePoolCapital);

  const releasePoolAllocation: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.poolPositions) throw new Error('Pool stores are not configured');
    const positionId = requiredString(params, 'positionId');
    const stored = context.poolPositions.get(positionId);
    if (!stored) throw new Error(`Pool position ${positionId} not found`);
    if (!stored.allocation) throw new Error(`Pool position ${positionId} has no allocation`);
    const poolRegistry = poolRegistryFor(stored.position.poolId, stored.registry);
    const released = releaseAllocation({ allocation: stored.allocation, position: stored.position }, poolRegistry);
    commitPoolRegistry(stored.position.poolId, released.registry);
    context.poolPositions.set(positionId, { ...stored, position: released.position, registry: released.registry, allocation: undefined });
    return { success: true, position: jsonSafe(released.position), registry: jsonSafe(released.registry) };
  };
  methods.set('totem_omniaReleasePoolAllocation', releasePoolAllocation);
  methods.set('omnia/releasePoolAllocation', releasePoolAllocation);

  const withdrawPoolLiquidity: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.pools || !context.poolPositions) throw new Error('Pool stores are not configured');
    const positionId = requiredString(params, 'positionId');
    const stored = context.poolPositions.get(positionId);
    if (!stored) throw new Error(`Pool position ${positionId} not found`);
    const pool = context.pools.get(stored.position.poolId);
    if (!pool) throw new Error(`Pool ${stored.position.poolId} not found`);
    const withdrawn = withdrawLiquidity(pool.manifest, stored.position, {
      positionId,
      amount: String(requiredAmount(params, 'amount')),
      recipientAddress: requiredString(params, 'recipientAddress'),
      reason: typeof params.reason === 'string' ? params.reason : undefined,
    }, pool.registry);
    commitPoolRegistry(stored.position.poolId, withdrawn.state);
    context.poolPositions.set(positionId, { ...stored, position: withdrawn.position, registry: withdrawn.state, intent: withdrawn.intent });
    return { success: true, intent: jsonSafe(withdrawn.intent), position: jsonSafe(withdrawn.position), registry: jsonSafe(withdrawn.state) };
  };
  methods.set('totem_omniaWithdrawPool', withdrawPoolLiquidity);
  methods.set('omnia/withdrawPool', withdrawPoolLiquidity);

  const approvePoolWithdrawal: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.poolPositions) throw new Error('Pool stores are not configured');
    const positionId = requiredString(params, 'positionId');
    const stored = context.poolPositions.get(positionId);
    if (!stored) throw new Error(`Pool position ${positionId} not found`);
    if (!stored.intent) throw new Error(`Pool position ${positionId} has no withdrawal intent`);
    const poolRegistry = poolRegistryFor(stored.position.poolId, stored.registry);
    const approved = approveWithdrawal(stored.intent, stored.position, poolRegistry);
    commitPoolRegistry(stored.position.poolId, approved.registry);
    context.poolPositions.set(positionId, { ...stored, registry: approved.registry, intent: approved.intent });
    return { success: true, intent: jsonSafe(approved.intent), registry: jsonSafe(approved.registry) };
  };
  methods.set('totem_omniaApprovePoolWithdrawal', approvePoolWithdrawal);
  methods.set('omnia/approvePoolWithdrawal', approvePoolWithdrawal);

  const executePoolPayoutMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.pools || !context.poolPositions) throw new Error('Pool stores are not configured');
    const positionId = requiredString(params, 'positionId');
    const stored = context.poolPositions.get(positionId);
    if (!stored) throw new Error(`Pool position ${positionId} not found`);
    if (!stored.intent) throw new Error(`Pool position ${positionId} has no withdrawal intent`);
    const pool = context.pools.get(stored.position.poolId);
    if (!pool) throw new Error(`Pool ${stored.position.poolId} not found`);
    const signIndices = params.signIndices ? signingIndicesParam(params.signIndices) : undefined;
    if (signIndices && !context.signer) throw new Error('Pool payout signing requires a signer');
    const recipientAddress = requiredString(params, 'recipientAddress');
    const rawSettlement = params.settlement as {
      status?: unknown; evidenceRef?: unknown; txpowId?: unknown; depth?: unknown;
    } | undefined;
    if (rawSettlement && !context.settlementVerifier) {
      throw new Error('executePoolPayout requires a configured settlement verifier');
    }
    // OMN-004/R4: the RPC evidence schema is status/evidenceRef/txpowId/depth
    // only. The binding (pool/position/withdrawal/recipient/amount) is derived
    // from stored state and expressed in atoms for the pool verifier, so a
    // caller cannot redirect the payout or assert its own amount.
    const settlement = rawSettlement
      ? {
          status: rawSettlement.status as PayoutSettlementStatus,
          evidenceRef: String(rawSettlement.evidenceRef ?? ''),
          ...(typeof rawSettlement.txpowId === 'string' ? { txpowId: rawSettlement.txpowId } : {}),
          ...(typeof rawSettlement.depth === 'number' ? { depth: rawSettlement.depth } : {}),
          withdrawalId: stored.intent.withdrawalId,
          poolId: stored.position.poolId,
          positionId: stored.position.positionId,
          recipientAddress,
          amount: stored.intent.amount.toString(),
        }
      : undefined;
    const paid = await executePoolPayout({
      pool: pool.manifest,
      position: stored.position,
      intent: stored.intent,
      recipientAddress,
      ...(settlement ? { settlement } : {}),
      ...(context.settlementVerifier ? { settlementVerifier: context.settlementVerifier } : {}),
      ...(signIndices && context.signer
        ? { rooting: { signer: context.signer, signIndices } }
        : {}),
    }, pool.registry);
    commitPoolRegistry(stored.position.poolId, paid.registry);
    context.poolPositions.set(positionId, {
      ...stored,
      position: paid.position,
      registry: paid.registry,
      intent: paid.intent,
    });
    return {
      success: true,
      intent: jsonSafe(paid.intent),
      position: jsonSafe(paid.position),
      registry: jsonSafe(paid.registry),
      signedTransition: paid.signedTransition ? jsonSafe(paid.signedTransition) : undefined,
    };
  };
  methods.set('totem_omniaExecutePoolPayout', executePoolPayoutMethod);
  methods.set('omnia/executePoolPayout', executePoolPayoutMethod);
}

export function createHostMethods(context: HostApiContext): Map<string, JsonRpcHandler> {
  const methods = new Map<string, JsonRpcHandler>();
  const register = (name: string, handler: JsonRpcHandler, alias: string): void => {
    methods.set(name, handler);
    methods.set(alias, handler);
  };

  const observeMethods = (map: Map<string, JsonRpcHandler>): Map<string, JsonRpcHandler> => {
    const emitter = context.observe;
    if (!emitter) return map;
    const observed = new Map<string, JsonRpcHandler>();
    const isQuiet = (name: string): boolean =>
      name.startsWith('totem_omniaGet') || name === 'totem_omniaWhoami' ||
      name === 'totem_omniaGetManifest';
    for (const [name, handler] of map) {
      observed.set(name, async (params?: unknown) => {
        if (isQuiet(name)) return handler(params);
        const startedAt = Date.now();
        const raw = paramsObject(params);
        const opId = typeof raw.operationId === 'string' ? raw.operationId : undefined;
        void emitter.emit({
          domain: 'command', kind: 'command.invoked', phase: 'observed',
          entity: { type: 'command', id: name },
          ...(opId ? { operationId: opId } : {}),
          data: { method: name, params },
        });
        try {
          const result = await handler(params);
          void emitter.emit({
            domain: 'command', kind: 'command.completed', phase: 'committed',
            entity: { type: 'command', id: name },
            ...(opId ? { operationId: opId } : {}),
            data: { method: name, durationMs: Date.now() - startedAt, result },
          });
          return result;
        } catch (error) {
          void emitter.emit({
            domain: 'command', kind: 'command.failed', phase: 'failed',
            entity: { type: 'command', id: name },
            ...(opId ? { operationId: opId } : {}),
            data: { method: name, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) },
          });
          throw error;
        }
      });
    }
    return observed;
  };

  const getChannels: JsonRpcHandler = (raw) => {
    const params = paramsObject(raw);
    const tokenId = typeof params.tokenId === 'string' ? params.tokenId : undefined;
    const status = typeof params.status === 'string' ? params.status : undefined;
    const channels = Array.from(context.channels.values())
      .filter((channel) => !tokenId || channel.tokenId === tokenId)
      .filter((channel) => !status || channel.status === status)
      .map(channelSummary);
    return { channels };
  };
  register('totem_omniaGetChannels', getChannels, 'omnia/getChannels');

  const getFundingCoins: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const address = requiredString(params, 'address');
    if (!context.chainProvider) throw new Error('Funding discovery requires a chain provider');
    const tokenId = typeof params.tokenId === 'string' ? params.tokenId : undefined;
    const coins = await context.chainProvider.getCoins({
      address,
      ...(tokenId ? { tokenId } : {}),
      sendable: true,
    });
    const proofs = await Promise.all(coins.map(async (coin) => {
      if (!context.chainProvider?.getProof) return null;
      try { return await context.chainProvider.getProof(coin.coinid); } catch { return null; }
    }));
    return {
      address,
      coins: coins.map((coin, index) => ({ ...coin, ...(proofs[index] ? { proof: proofs[index] } : {}) })),
      source: 'chain-provider',
      limitations: [
        'A node may only report wallet-relevant coins; foreign WOTS addresses can return an empty set.',
        'A missing proof is reported as absent, not as a funding failure.',
      ],
    };
  };
  register('totem_omniaGetFundingCoins', getFundingCoins, 'omnia/getFundingCoins');

  const getChannelState: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    let channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    // Neither side sees a funding-confirmation event (the acceptor starts in
    // `funding_pending`, the initiator in `opening` while the funding tx is
    // still shallow). Re-check on read so both sides become active once the
    // funding coin is buried enough.
    if ((channel.status === 'funding_pending' || channel.status === 'opening') && context.chainProvider) {
      try {
        const coin = await context.chainProvider.getCoin(channel.fundingCoinId);
        const tip = await context.chainProvider.getTip();
        const depth = confirmationsAt(coin, tip.block);
        if (coin && !coin.spent && depth !== null && depth >= 1) {
          channel = activateChannel(channel);
          context.channels.set(channelId, channel);
        }
      } catch {
        // Leave the channel pending; a later read retries.
      }
    }
    return channelStateView(channel);
  };
  register('totem_omniaGetChannelState', getChannelState, 'omnia/getChannelState');

  const normalizeRouteNode = (value: string): string => {
    const lower = value.toLowerCase();
    for (const channel of context.channels.values()) {
      for (const party of channel.parties) {
        if (party.partyId === value || party.publicKeyDigest.toLowerCase() === lower) {
          return party.publicKeyDigest;
        }
      }
    }
    return value;
  };

  const getRoute: JsonRpcHandler = async (raw) => {
    context.refreshRouting?.();
    const params = paramsObject(raw);
    const route = await context.routing.getRoute({
      from: normalizeRouteNode(requiredString(params, 'fromPartyId')),
      to: normalizeRouteNode(requiredString(params, 'toPartyId')),
      amount: requiredAmount(params, 'amount'),
      tokenId: requiredString(params, 'tokenId'),
      targetTokenId: typeof params.targetTokenId === 'string' ? params.targetTokenId : undefined,
      maxHops: typeof params.maxHops === 'number' ? params.maxHops : undefined,
    });
    if (!route) return { success: false, error: 'No route found', errorCode: 'ROUTE_NOT_FOUND' };
    return { success: true, route: serializeWireRoute(route) };
  };
  register('totem_omniaGetRoute', getRoute, 'omnia/getRoute');

  const getSwapRate: JsonRpcHandler = () => ({ success: true, announcements: [] });
  register('totem_omniaGetSwapRate', getSwapRate, 'omnia/getSwapRate');

  const whoami: JsonRpcHandler = () => {
    if (!context.identity) {
      return { address: null, publicKeyDigest: null };
    }
    return {
      address: context.identity.address,
      publicKeyDigest: context.identity.publicKeyDigest,
      identityId: context.identity.identityId,
      settlementAddress: context.localParticipant?.settlementAddress,
      delegation: context.identity.delegation,
      custodyMode: context.custodyMode ?? 'self',
      p2pHubUrl: context.p2pHubUrl ?? null,
    };
  };
  register('totem_omniaWhoami', whoami, 'omnia/whoami');

  const getManifest: JsonRpcHandler = () => {
    if (!context.manifest) {
      return { manifest: null };
    }
    return { manifest: context.manifest };
  };
  register('totem_omniaGetManifest', getManifest, 'omnia/getManifest');

  // Fail-fast rule: without signing material only the read-only surface is
  // registered. Mutation methods must never exist without a signer.
  // Coordinator mode: no host signing material. Expose the read surface plus
  // the non-signing prepare/submit flow; wallets supply signatures and indices.
  if (context.coordinator && !context.readOnly) {
    registerPreparedPayMethods(methods, context);
    return observeMethods(methods);
  }
  if (context.readOnly || !context.signer || !context.leaseProvider) {
    return observeMethods(methods);
  }

  /**
   * Choose a funding coin from the host's own chain view when the caller does
   * not supply one. Selection policy lives in @totemsdk/tx-builder; this only
   * sources candidates and the ownership material.
   */
  async function selectFundingCoin(
    ctx: HostApiContext,
    req: { targetAmount: bigint; tokenId?: string; fundingAddress?: string },
  ): Promise<{ coinId: string; publickey: string; script: string; proof: string }> {
    const chain = ctx.chainProvider;
    if (!chain?.getAddressInfo || !chain.exportCoin) {
      throw new Error(
        'openChannel requires fundingCoinId, or a chain provider supporting getAddressInfo + exportCoin for automatic selection',
      );
    }
    const address = req.fundingAddress ?? ctx.fundingAddress ?? ctx.localParticipant?.settlementAddress;
    if (!address) {
      throw new Error('openChannel cannot select a funding coin: no fundingAddress or local settlement address');
    }
    const fetcher: CoinFetcher = {
      fetchCoins: async (addresses: string[]): Promise<SpendableCoin[]> => {
        const out: SpendableCoin[] = [];
        for (const addr of addresses) {
          const coins = await chain.getCoins({ address: addr, sendable: true });
          for (const c of coins) {
            if (c.spent) continue;
            out.push({ coinId: c.coinid, address: c.address, amount: c.amount, tokenid: c.tokenid, created: 0 });
          }
        }
        return out;
      },
    };
    const service = new CoinSelectionService(fetcher);
    const spendable = await service.fetchSpendableCoins([address], req.tokenId ?? '0x00');
    const selection = service.selectCoins(spendable, {
      mode: 'focused',
      focusedAddress: address,
      // OMN-036: selectCoins takes decimal MINIMA text, not atom integers.
      targetAmount: atomsToAmount(req.targetAmount),
      tokenId: req.tokenId ?? '0x00',
    });
    // The channel opening currently accepts one funding input. Pick a single
    // coin that covers the target instead of silently dropping the rest.
    const chosen = selection.selectedCoins.find(
      (coin) => amountToAtoms(coin.amount) >= req.targetAmount,
    );
    if (selection.insufficientFunds || !chosen) {
      throw new Error(
        `openChannel funding selection failed: need ${atomsToAmount(req.targetAmount)}, selected ${selection.totalSelected}`
        + (selection.selectedCoins.length > 1 ? ' (multi-input funding is not supported yet)' : ''),
      );
    }
    const info = await chain.getAddressInfo(chosen.address);
    if (!info) throw new Error(`openChannel: no address info for ${chosen.address}`);
    const exported = await chain.exportCoin(chosen.coinId);
    if (!exported) throw new Error(`openChannel: no coin export for ${chosen.coinId}`);
    return { coinId: chosen.coinId, publickey: info.publickey, script: info.script, proof: exported.data };
  }

  const openChannel: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const remotePartyId = requiredString(params, 'remotePartyId');
    const remotePublicKeyDigest = requiredString(params, 'remotePublicKeyDigest');
    const remote: ChannelParticipant = {
      partyId: remotePartyId,
      publicKeyDigest: remotePublicKeyDigest,
      addressIndex: typeof params.remoteAddressIndex === 'number' ? params.remoteAddressIndex : 0,
      settlementAddress: typeof params.remoteSettlementAddress === 'string' ? params.remoteSettlementAddress : undefined,
      transportPubkey: typeof params.remoteTransportPubkey === 'string' ? params.remoteTransportPubkey : undefined,
    };
    const result = await withOperation(context, params, async () => {
      const localAmount = requiredAmount(params, 'localAmount');
      const remoteAmount = requiredAmount(params, 'remoteAmount');
      const tokenId = typeof params.tokenId === 'string' ? params.tokenId : undefined;

      let fundingCoinId = typeof params.fundingCoinId === 'string' ? params.fundingCoinId : undefined;
      let fundingPubkey = typeof params.fundingPubkey === 'string' ? params.fundingPubkey : undefined;
      let fundingScript = typeof params.fundingScript === 'string' ? params.fundingScript : undefined;
      let fundingCoinProofsHex = params.fundingCoinProofsHex;

      if (!fundingCoinId) {
        const picked = await selectFundingCoin(context, {
          targetAmount: localAmount + remoteAmount,
          tokenId,
          fundingAddress: typeof params.fundingAddress === 'string' ? params.fundingAddress : undefined,
        });
        fundingCoinId = picked.coinId;
        fundingPubkey = picked.publickey;
        fundingScript = picked.script;
        fundingCoinProofsHex = [picked.proof];
      }

      const createParams: CreateChannelParams = {
        localParty: {
          ...context.localParticipant,
          transportPubkey: context.localParticipant.transportPubkey ?? context.transportPubkey,
        },
        remoteParty: remote,
        localAmount,
        remoteAmount,
        tokenId,
        fundingCoinId,
        contestDelayBlocks: typeof params.contestDelayBlocks === 'number' ? params.contestDelayBlocks : undefined,
      };
      const fundingWitnessHex = typeof params.fundingWitnessHex === 'string' ? params.fundingWitnessHex : undefined;
      if (fundingWitnessHex) {
        createParams.fundingWitnessBytes = Buffer.from(fundingWitnessHex.replace(/^0x/i, ''), 'hex');
      } else {
        // Assemble the funding witness: createChannel builds the funding draft,
        // a funding signer signs its digest, and the caller supplies the input
        // proofs (serialized CoinProof + ScriptProof). The signer comes from the
        // configured funding signer, or from the node's `sign` command using the
        // `fundingPubkey` the caller passes.
        const nodeAdapter = context.chainProvider as { signData?: (pk: string, data: string) => Promise<string> };
        const signer = context.fundingSigner ?? (
          fundingPubkey && typeof nodeAdapter?.signData === 'function'
            ? async (digest: Uint8Array) => {
                const sig = await nodeAdapter.signData!(
                  fundingPubkey,
                  '0x' + Buffer.from(digest).toString('hex'),
                );
                return Uint8Array.from(Buffer.from(sig.replace(/^0x/i, ''), 'hex'));
              }
            : undefined
        );
        if (!signer) {
          throw new Error('openChannel requires fundingWitnessHex, or a fundingPubkey + funding proofs');
        }
        if (typeof fundingScript !== 'string' && !Array.isArray(params.fundingScriptProofsHex)) {
          throw new Error('openChannel requires fundingScript (or serialized fundingScriptProofsHex) for the funding input address');
        }
        const toBytes = (v: unknown): Uint8Array[] =>
          Array.isArray(v) ? v.map((h) => Buffer.from(String(h).replace(/^0x/i, ''), 'hex')) : [];
        createParams.fundingProofs = {
          coinProofs: toBytes(fundingCoinProofsHex),
          scriptProofs: toBytes(params.fundingScriptProofsHex),
        };
        // The funding coin's address script: createChannel derives the required
        // single-leaf ScriptProof from it, so callers need not hand-roll it.
        if (typeof fundingScript === 'string') {
          createParams.fundingScript = fundingScript;
        }
        // If the caller supplied the funding coin's public key, the node's
        // `sign` command is authoritative for that input. The host channel key
        // must not sign someone else's funding coin.
        createParams.fundingSigner = !fundingPubkey && context.signerPort && (context.custodyMode ?? 'self') !== 'hosted'
          ? async (digest: Uint8Array) => context.signerPort!.sign({
              requestId: `channel-funding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              kind: 'chain',
              domain: 'channel',
              digest,
              context: { summary: 'Channel funding input' },
              signers: [context.signerPort!.publicKeyDigest],
              custody: makeSelfCustody(),
              expiresAt: Date.now() + 60_000,
            })
          : signer;
      }
      // RFC-035: establish the peer transport before broadcasting funding.
      // Otherwise a DHT timeout leaves the funding coin spent with no channel.
      if (context.swarm) {
        await context.swarm.connectToPeer(
          remote.publicKeyDigest,
          `omnia-open-preflight-${remotePartyId}`,
          remote.transportPubkey,
        );
      }
      const created = await createChannel(createParams, context.chainProvider);
      context.channels.set(created.channel.channelId, {
        ...created.channel,
        localSigner: context.signer,
      });
      let acknowledged = true;
      if (context.swarm && !context.allowLocalOnlyPay) {
        const peer = await context.swarm.connectToPeer(remote.publicKeyDigest, created.channel.channelId, remote.transportPubkey);
        // Give the peer time to accept so a follow-up pay() is not lost.
        const reply = await requestPeerReply(
          peer,
          { type: 'CHANNEL_PROPOSAL', channelId: created.channel.channelId, nonce: Date.now(), payload: created.proposal },
          created.channel.channelId,
          20_000,
        );
        acknowledged = reply?.type === 'ACK';
      }
      await context.observe?.emit({
        domain: 'channel', kind: 'channel.opened', phase: 'accepted',
        entity: { type: 'channel', id: created.channel.channelId },
        parties: { local: context.localParticipant?.partyId, remote: remotePartyId },
        token: { tokenId: created.channel.tokenId, scale: created.channel.tokenScale ?? 0 },
        amounts: { capacity: atomsToAmount(created.channel.totalValue), balances: balancesJson(created.channel) },
        chain: { fundingCoinId: created.channel.fundingCoinId, txpowId: created.channel.fundingTxId },
        transitionHash: channelTransitionHash(created.channel),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { acknowledged },
      });
      return { success: true, channelId: created.channel.channelId, fundingTxId: created.channel.fundingTxId, acknowledged };
    });
    return result;
  };
  register('totem_omniaOpenChannel', openChannel, 'omnia/openChannel');

  const pay: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    const amount = requiredAmount(params, 'amount');
    return withChannelLock(channelId, () => withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const localPartyId = context.localParticipant.partyId;
      const remotePartyId = channel.parties.find((party) => party.partyId !== localPartyId)?.partyId;
      if (!remotePartyId) throw new Error('Channel counterparty not found');
      if (amount <= 0n || (channel.balances[localPartyId] ?? 0n) < amount) throw new Error('Insufficient channel balance');
      const beforeBalances = balancesJson(channel);
      const result = await updateState(channel, {
        newBalances: {
          ...channel.balances,
          [localPartyId]: (channel.balances[localPartyId] ?? 0n) - amount,
          [remotePartyId]: (channel.balances[remotePartyId] ?? 0n) + amount,
        },
      }, context.leaseProvider, context.signer, context.signerPort);
      if (result.error) throw new Error(result.error);

      const remoteParty = channel.parties.find((party) => party.partyId === remotePartyId)!;
      let committed = result.channel;
      let acknowledged = false;
      if (context.swarm && !context.allowLocalOnlyPay) {
        const peer = await context.swarm.connectToPeer(
          remoteParty.publicKeyDigest,
          channelId,
          remoteParty.transportPubkey,
        );
        // OMN-024: do not report a payment on a one-party state. Wait for the
        // counterparty co-signature, merge it, and only then commit.
        const reply = await requestPeerReply(
          peer,
          { type: 'STATE_UPDATE', channelId, nonce: Date.now(), payload: result.signedState },
          channelId,
          20_000,
          ['ACK', 'ERROR'],
        );
        if (!reply || reply.type !== 'ACK') {
          const payload = (reply?.payload ?? {}) as { error?: unknown };
          context.channels.set(channelId, channel);
          return {
            success: false,
            channelId,
            acknowledged: false,
            committed: false,
            errorCode: 'PEER_NOT_COSIGNED',
            error: typeof payload.error === 'string' ? payload.error : 'counterparty did not co-sign the state update',
          };
        }
        const payload = (reply.payload ?? {}) as {
          counterpartyPartialState?: Partial<import('@totemsdk/omnia').SignedChannelState>;
          counterpartyClosePackage?: import('@totemsdk/omnia').SignedClosePackage;
        };
        const partial = payload.counterpartyPartialState;
        const signature = partial?.signatures?.[remotePartyId];
        const indices = partial?.signingIndices?.[remotePartyId];
        if (!partial || !signature || !indices) {
          context.channels.set(channelId, channel);
          return {
            success: false,
            channelId,
            acknowledged: true,
            committed: false,
            errorCode: 'PEER_COSIGNATURE_MISSING',
            error: 'counterparty ACK did not include a cosigned partial state',
          };
        }
        try {
          const merged = attachCounterpartySignature(
            result.channel,
            partial,
            remotePartyId,
            signature,
            indices,
            partial.closePackage ?? payload.counterpartyClosePackage,
          );
          committed = merged.channel;
          acknowledged = true;
        } catch (err) {
          context.channels.set(channelId, channel);
          return {
            success: false,
            channelId,
            acknowledged: true,
            committed: false,
            errorCode: 'PEER_COSIGNATURE_INVALID',
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      context.channels.set(channelId, committed);
      await context.observe?.emit({
        domain: 'channel', kind: 'channel.updated', phase: 'committed',
        entity: { type: 'channel', id: channelId },
        parties: { local: localPartyId, remote: remotePartyId },
        token: { tokenId: channel.tokenId, scale: channel.tokenScale ?? 0 },
        before: { balances: beforeBalances, sequence: channel.currentSequence },
        after: { balances: balancesJson(committed), sequence: committed.currentSequence },
        amounts: { amount: atomsToAmount(amount), balances: balancesJson(committed) },
        transitionHash: channelTransitionHash(committed),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
      });
      return {
        success: true,
        channelId,
        acknowledged,
        committed: acknowledged,
        sequence: committed.currentSequence,
        localBalance: committed.balances[localPartyId]!.toString(),
        remoteBalance: committed.balances[remotePartyId]!.toString(),
      };
    }));
  };
  register('totem_omniaPay', pay, 'omnia/pay');

  const sendHtlcState = async (channel: OmniaChannel, state: Partial<import('@totemsdk/omnia').SignedChannelState>): Promise<void> => {
    const localPartyId = context.localParticipant!.partyId;
    const remote = channel.parties.find((party) => party.partyId !== localPartyId);
    if (!context.swarm || !remote) return;
    const peer = context.channelPeers?.get(channel.channelId)
      ?? await context.swarm.connectToPeer(remote.publicKeyDigest, channel.channelId, remote.transportPubkey);
    await peer.sendMessage({ type: 'STATE_UPDATE', channelId: channel.channelId, nonce: Date.now(), payload: { ...state, pendingHTLCs: channel.pendingHTLCs } });
  };

  const addHtlcMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    requireMutationContext(context);
    const result = await withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const added = await addHTLC(channel, {
        amount: requiredAmount(params, 'amount'),
        hashlock: requiredString(params, 'hashlock'),
        timeoutBlock: requiredBigInt(params, 'timeoutBlock'),
        direction: (typeof params.direction === 'string' ? params.direction : 'offered') as 'offered' | 'received',
        counterpartPublicKeyDigest: requiredString(params, 'counterpartPublicKeyDigest'),
      }, context.leaseProvider!, context.signer);
      if (added.error) throw new Error(added.error);
      context.channels.set(channelId, added.channel);
      await context.observe?.emit({
        domain: 'payment', kind: 'htlc.added', phase: 'committed',
        entity: { type: 'channel', id: channelId },
        amounts: { amount: atomsToAmount(requiredAmount(params, 'amount')), balances: balancesJson(added.channel) },
        transitionHash: channelTransitionHash(added.channel),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { htlcId: added.htlcId, hashlock: params.hashlock, timeoutBlock: String(params.timeoutBlock), direction: params.direction },
      });
      await sendHtlcState(added.channel, added.partialState);
      return { success: true, channelId, htlcId: added.htlcId, sequence: added.channel.currentSequence };
    });
    return result;
  };
  register('totem_omniaAddHTLC', addHtlcMethod, 'omnia/addHTLC');

  const fulfillHtlcMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    requireMutationContext(context);
    return withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const fulfilled = await fulfillHTLC(channel, requiredString(params, 'htlcId'), requiredString(params, 'preimage'), context.leaseProvider!, context.chainProvider, context.signer);
      if (fulfilled.error) throw new Error(fulfilled.error);
      context.channels.set(channelId, fulfilled.channel);
      await context.observe?.emit({
        domain: 'payment', kind: 'htlc.fulfilled', phase: 'committed',
        entity: { type: 'channel', id: channelId },
        amounts: { balances: balancesJson(fulfilled.channel) },
        transitionHash: channelTransitionHash(fulfilled.channel),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { htlcId: params.htlcId },
      });
      await sendHtlcState(fulfilled.channel, fulfilled.partialState);
      return { success: true, channelId, sequence: fulfilled.channel.currentSequence };
    });
  };
  register('totem_omniaFulfillHTLC', fulfillHtlcMethod, 'omnia/fulfillHTLC');

  const timeoutHtlcMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    requireMutationContext(context);
    return withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const timedOut = await timeoutHTLC(channel, requiredString(params, 'htlcId'), context.leaseProvider!, context.chainProvider!, context.signer);
      if (timedOut.error) throw new Error(timedOut.error);
      context.channels.set(channelId, timedOut.channel);
      await context.observe?.emit({
        domain: 'payment', kind: 'htlc.timed_out', phase: 'recovered',
        entity: { type: 'channel', id: channelId },
        amounts: { balances: balancesJson(timedOut.channel) },
        transitionHash: channelTransitionHash(timedOut.channel),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { htlcId: params.htlcId },
      });
      await sendHtlcState(timedOut.channel, timedOut.partialState);
      return { success: true, channelId, sequence: timedOut.channel.currentSequence };
    });
  };
  register('totem_omniaTimeoutHTLC', timeoutHtlcMethod, 'omnia/timeoutHTLC');

  registerPreparedPayMethods(methods, context);


  const programTransition: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    const transition: ProgramTransition = {
      action: requiredString(params, 'action'),
      inputs: optionalTransitionInputs(params),
      witness: optionalStringRecord(params, 'witness'),
      metadata: optionalStringRecord(params, 'metadata'),
    };
    const balances = amountRecord(params, 'balances');
    return withOperation(context, params, async () => persistProgramUpdate(
      context,
      channelId,
      (channel) => applyProgramTransition(channel, { transition, balances }, context.leaseProvider, context.signer),
    ));
  };
  register('totem_omniaApplyProgramTransition', programTransition, 'omnia/applyProgramTransition');

  const counterTransition = (action: 'increment' | 'decrement' | 'set'): JsonRpcHandler => async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    return withOperation(context, params, async () => persistProgramUpdate(
      context,
      channelId,
      (channel) => {
        if (action === 'increment') return incrementCounter(channel, requiredBigInt(params, 'by'), context.leaseProvider, context.signer);
        if (action === 'decrement') return decrementCounter(channel, requiredBigInt(params, 'by'), context.leaseProvider, context.signer);
        return setCounter(channel, requiredBigInt(params, 'value'), context.leaseProvider, context.signer);
      },
    ));
  };
  register('totem_omniaIncrementCounter', counterTransition('increment'), 'omnia/incrementCounter');
  register('totem_omniaDecrementCounter', counterTransition('decrement'), 'omnia/decrementCounter');
  register('totem_omniaSetCounter', counterTransition('set'), 'omnia/setCounter');

  const meterReading: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    return withOperation(context, params, async () => persistProgramUpdate(
      context,
      channelId,
      (channel) => recordMeterReading(
        channel,
        requiredBigInt(params, 'reading'),
        requiredAmount(params, 'unitPrice'),
        context.leaseProvider,
        context.signer,
      ),
    ));
  };
  register('totem_omniaRecordMeterReading', meterReading, 'omnia/recordMeterReading');

  const settle: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    const broadcastProofs = params.broadcastProofs;
    const parsedProofs = broadcastProofs && typeof broadcastProofs === 'object'
      && Array.isArray((broadcastProofs as Record<string, unknown>).coinProofs)
      && Array.isArray((broadcastProofs as Record<string, unknown>).scriptProofs)
      ? {
          coinProofs: ((broadcastProofs as Record<string, unknown>).coinProofs as unknown[]).map((hex) => Buffer.from(String(hex).replace(/^0x/i, ''), 'hex')),
          scriptProofs: ((broadcastProofs as Record<string, unknown>).scriptProofs as unknown[]).map((hex) => Buffer.from(String(hex).replace(/^0x/i, ''), 'hex')),
        }
      : undefined;
    return withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const closing = markChannelClosing(channel, 'mutual');
      const partyAddresses = Object.fromEntries(
        closing.parties.map((party) => [party.partyId, party.settlementAddress ?? party.publicKeyDigest]),
      );

      // Cooperative close needs both eltoo MULTISIG(2 A B) signatures. Build the
      // exact settlement draft, ask the counterparty to co-sign it, then include
      // both signatures in the broadcast witness.
      const localPartyId = context.localParticipant?.partyId;
      const remoteParty = localPartyId
        ? closing.parties.find((party) => party.partyId !== localPartyId)
        : undefined;
      let counterpartySignatures: Array<{ partyId: string; signature: Uint8Array }> | undefined;
      let settlementTxHex: string | undefined;
      if (context.swarm && remoteParty) {
        const request = buildSettlementSigningRequest(closing, { partyAddresses });
        const peer = await context.swarm.connectToPeer(remoteParty.publicKeyDigest, channelId, remoteParty.transportPubkey);
        const reply = await requestPeerReply(
          peer,
          {
            type: 'SETTLEMENT_PROPOSAL',
            channelId,
            nonce: Date.now(),
            payload: { signRequest: true, ...request },
          },
          channelId,
          30_000,
        );
        const replyPayload = reply?.payload as { signature?: string; partyId?: string } | undefined;
        if (reply?.type !== 'ACK' || typeof replyPayload?.signature !== 'string') {
          throw new Error(`Counterparty did not co-sign the settlement (${reply?.type ?? 'timeout'})`);
        }
        counterpartySignatures = [{
          partyId: replyPayload.partyId ?? remoteParty.partyId,
          signature: Buffer.from(replyPayload.signature.replace(/^0x/i, ''), 'hex'),
        }];
        settlementTxHex = request.settlementTxHex;
      }

      const settlement = await proposeSettlement(closing, context.leaseProvider, {
        signer: context.signer,
        chainProvider: context.chainProvider,
        broadcastProofs: parsedProofs,
        partyAddresses,
        settlementTxHex,
        counterpartySignatures,
      });
      context.channels.set(channelId, markChannelClosed(closing));
      await context.observe?.emit({
        domain: 'settlement', kind: 'settlement.committed', phase: 'confirmed',
        entity: { type: 'channel', id: channelId },
        chain: { txpowId: settlement.settlementPayload.txpowId },
        amounts: { balances: amountRecordJson(settlement.settlementPayload.balances) },
        transitionHash: hashTransition(['settlement', channelId, settlement.settlementPayload.txpowId]),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
      });
      return { success: true, channelId, settlementTxId: settlement.settlementPayload.txpowId, finalBalances: amountRecordJson(settlement.settlementPayload.balances) };
    });
  };
  register('totem_omniaSettle', settle, 'omnia/settle');

  const closeChannel: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    return withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      context.channels.set(channelId, markChannelClosed(channel));
      await context.observe?.emit({
        domain: 'channel', kind: 'channel.closed', phase: 'closed',
        entity: { type: 'channel', id: channelId },
        transitionHash: channelTransitionHash(markChannelClosed(channel)),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
      });
      return { success: true, channelId };
    });
  };
  register('totem_omniaCloseChannel', closeChannel, 'omnia/closeChannel');

  const createFactoryMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.factories || !context.factoryBundles) throw new Error('Factory manager is not configured');
    const participants = params.participants;
    if (!Array.isArray(participants) || participants.length < 2) throw new Error('participants must contain at least two factory participants');
    const parsed = participants.map((value) => {
      if (!value || typeof value !== 'object') throw new Error('Invalid factory participant');
      const item = value as Record<string, unknown>;
      return {
        partyId: requiredString(item, 'partyId'),
        publicKeyDigest: requiredString(item, 'publicKeyDigest'),
        addressIndex: Number(item.addressIndex ?? 0),
        contributionAmount: rpcAmountToAtoms(requiredString(item, 'contributionAmount'), 'contributionAmount'),
        fundingCoinId: typeof item.fundingCoinId === 'string' ? item.fundingCoinId : undefined,
        settlementAddress: typeof item.settlementAddress === 'string' ? item.settlementAddress : undefined,
        transportPubkey: typeof item.transportPubkey === 'string' ? item.transportPubkey : undefined,
      } satisfies FactoryParticipant;
    });
    assertTwoPartyFactory(parsed);
    const localPartyId = context.localParticipant?.partyId;
    if (!localPartyId) throw new Error('Local participant is not configured');
    const localBundle = context.factoryBundles[localPartyId];
    if (!localBundle) throw new Error('No local factory lease bundle');
    const remote = parsed.find((participant) => participant.partyId !== localPartyId);

    const localSigner = context.signerPort && (context.custodyMode ?? 'self') !== 'hosted'
      ? async (digest: Uint8Array): Promise<Uint8Array> => {
          const request: SignRequest = {
            requestId: `factory-funding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            kind: 'chain',
            domain: 'factory',
            digest,
            context: { summary: 'Factory funding input' },
            signers: [context.signerPort!.publicKeyDigest],
            custody: makeSelfCustody(),
            expiresAt: Date.now() + 60_000,
          };
          return context.signerPort!.sign(request);
        }
      : context.signer && context.leaseProvider
      ? async (digest: Uint8Array): Promise<Uint8Array> => {
          const reservation = await context.leaseProvider!.reserveKeyUse({
            treeId: 'factory-funding',
            purpose: 'factory-funding',
            payloadHash: '0x' + Buffer.from(digest).toString('hex'),
          });
          try {
            const sig = await context.signer!.sign(digest, reservation.indices);
            await context.leaseProvider!.commitKeyUse(reservation.reservationId, 'factory-funding');
            return sig;
          } catch (err) {
            await context.leaseProvider!.burnReservation(reservation.reservationId, 'factory-funding-failed').catch(() => {});
            throw err;
          }
        }
      : undefined;
    let fundingPeer: { sendMessage(msg: unknown): Promise<void>; onMessage(cb: (msg: any) => void): () => void; onReconnected?(cb: () => void): () => void } | undefined;
    const remoteSigner = context.swarm && remote
      ? async (digest: Uint8Array): Promise<Uint8Array> => {
          fundingPeer ??= await context.swarm!.connectToPeer(remote.publicKeyDigest, 'factory-funding', remote.transportPubkey);
          const channelId = 'factory-funding';
          const reply = await requestPeerReply(
            fundingPeer,
            {
              type: 'FACTORY_FUNDING_REQUEST',
              channelId,
              nonce: Date.now(),
              payload: { digest: '0x' + Buffer.from(digest).toString('hex') },
            },
            channelId,
            30_000,
            ['FACTORY_FUNDING_RESPONSE', 'ERROR'],
          );
          const signature = (reply?.payload as { signature?: string } | undefined)?.signature;
          if (!signature) {
            throw new Error(`Counterparty did not co-sign factory funding (${reply?.type ?? 'timeout'})`);
          }
          return Uint8Array.from(Buffer.from(signature.replace(/^0x/i, ''), 'hex'));
        }
      : undefined;

    const funding: FactoryFundingMaterial[] | undefined = Array.isArray(params.funding)
      ? params.funding.map((value) => {
          if (!value || typeof value !== 'object') throw new Error('Invalid factory funding material');
          const item = value as Record<string, unknown>;
          const hex = (key: string): Uint8Array | undefined => {
            const raw = item[key];
            if (typeof raw !== 'string') return undefined;
            return Buffer.from(raw.replace(/^0x/i, ''), 'hex');
          };
          const coinProof = hex('coinProof');
          if (!coinProof) throw new Error('factory funding material requires coinProof');
          const partyId = requiredString(item, 'partyId');
          const signature = hex('signature');
          const signer = signature
            ? undefined
            : partyId === localPartyId
              ? localSigner
              : remoteSigner;
          return {
            partyId,
            coinProof,
            ...(typeof item.coinAddress === 'string' ? { coinAddress: item.coinAddress } : {}),
            ...(typeof item.script === 'string' ? { script: item.script } : {}),
            ...(hex('scriptProof') ? { scriptProof: hex('scriptProof') } : {}),
            ...(signature ? { signature } : signer ? { signer } : {}),
          } satisfies FactoryFundingMaterial;
        })
      : undefined;
    const tokenId = typeof params.tokenId === 'string' ? params.tokenId : '0x00';
    return withOperation(context, params, async () => {
      // One plan, one ID. Proposal first; funding signatures are only requested
      // after the counterparty has accepted these exact terms (CAN-020).
      const plan = await buildFactoryOpening(
        parsed,
        tokenId,
        0,
        context.chainProvider,
        funding,
        factoryScriptOptions(params),
      );
      const proposal = await proposeFactoryOpening(plan, localBundle);

      let openingSignatures = proposal.pendingSignatures;
      let acceptedFactory: ChannelFactory | undefined;
      let factoryPeer: any;
      if (context.swarm && remote) {
        factoryPeer = await context.swarm.connectToPeer(remote.publicKeyDigest, plan.factory.factoryId, remote.transportPubkey);
        const reply = await requestPeerReply(
          factoryPeer,
          {
            type: 'FACTORY_PROPOSAL',
            channelId: plan.factory.factoryId,
            nonce: Date.now(),
            payload: {
              factory: proposal,
              onChain: plan.onChain,
              ...(plan.onChain ? { fundingMaterials: funding } : {}),
            },
          },
          plan.factory.factoryId,
          30_000,
          ['FACTORY_ACCEPT', 'ERROR'],
        );
        if (reply?.type !== 'FACTORY_ACCEPT') {
          throw new Error(`Counterparty did not accept the factory (${reply?.type ?? 'timeout'})`);
        }
        const accepted = (reply.payload as { factory?: ChannelFactory } | undefined)?.factory;
        if (!accepted) throw new Error('Factory accept reply missing factory');
        if (accepted.factoryId !== plan.factory.factoryId) {
          throw new Error('Counterparty accepted a different factory');
        }
        if (accepted.status === 'active') {
          if (plan.onChain) throw new Error('Counterparty committed the factory before funding');
          acceptedFactory = accepted;
        } else {
          openingSignatures = accepted.pendingSignatures;
        }
      }

      let fundingSignatures: Record<string, Uint8Array> | undefined;
      if (plan.onChain) {
        if (!plan.fundingDigest) throw new Error('On-chain factory plan has no funding digest');
        const materials = new Map((funding ?? []).map(material => [material.partyId, material]));
        fundingSignatures = {};
        for (const participant of plan.factory.participants) {
          const material = materials.get(participant.partyId);
          if (!material) throw new Error(`Missing funding material for factory party '${participant.partyId}'`);
          if (material.signature) {
            fundingSignatures[participant.partyId] = material.signature;
          } else if (material.signer) {
            fundingSignatures[participant.partyId] = Uint8Array.from(await material.signer(plan.fundingDigest));
          } else {
            throw new Error(`Missing signature or signer for factory party '${participant.partyId}'`);
          }
        }
      }

      const factory = acceptedFactory ?? await finalizeFactoryOpening(
        plan,
        { fundingSignatures, openingSignatures },
        context.chainProvider,
      );
      context.factories!.set(factory.factoryId, factory);
      if (factoryPeer) {
        await factoryPeer.sendMessage({
          type: 'FACTORY_FINALIZED',
          channelId: factory.factoryId,
          nonce: Date.now(),
          payload: { factory },
        });
      }
      await context.observe?.emit({
        domain: 'factory', kind: 'factory.opened', phase: 'accepted',
        entity: { type: 'factory', id: factory.factoryId },
        amounts: { balances: amountRecordJson(factory.allocations ?? {}) },
        transitionHash: hashTransition(['factory', factory.factoryId, factory.status]),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { participants: factory.participants },
      });
      return { success: true, factoryId: factory.factoryId, status: factory.status };
    });
  };
  register('totem_omniaCreateFactory', createFactoryMethod, 'omnia/createFactory');

  const openVirtual: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.factories || !context.factoryBundles) throw new Error('Factory manager is not configured');
    const factoryId = requiredString(params, 'factoryId');
    const factory = context.factories.get(factoryId);
    if (!factory) throw new Error(`Factory ${factoryId} not found`);
    const parties = params.partyIds;
    if (!Array.isArray(parties) || parties.length !== 2 || !parties.every((value) => typeof value === 'string')) throw new Error('partyIds must contain two party IDs');
    const amounts = params.amounts;
    if (!amounts || typeof amounts !== 'object') throw new Error('amounts is required');
    const parsedAmounts = Object.fromEntries(Object.entries(amounts as Record<string, unknown>).map(([key, value]) => [key, amountToAtoms(String(value))]));
    const localPartyId = context.localParticipant?.partyId;
    if (!localPartyId) throw new Error('Local participant is not configured');
    const localBundle = context.factoryBundles[localPartyId];
    if (!localBundle) throw new Error('No local factory lease bundle');
    return withOperation(context, params, async () => {
      const plan = buildVirtualChannelOpen(factory, parties as [string, string], parsedAmounts);
      const localSig = await signVirtualChannelOpen(factory, plan, localBundle);
      const signatures: Record<string, any> = { [localSig.partyId]: localSig };
      const remote = factory.participants.find((participant) => participant.partyId !== localPartyId);
      const peer = context.swarm && remote
        ? await context.swarm.connectToPeer(remote.publicKeyDigest, plan.vcId, remote.transportPubkey)
        : undefined;
      if (peer) {
        const reply = await requestPeerReply(
          peer,
          {
            type: 'VC_PROPOSAL',
            channelId: plan.vcId,
            nonce: Date.now(),
            payload: { kind: 'vc-open', factoryId, vcId: plan.vcId, plan },
          },
          plan.vcId,
          30_000,
          ['VC_ACCEPT', 'ERROR'],
        );
        const sig = (reply?.payload as { signature?: any } | undefined)?.signature;
        if (reply?.type !== 'VC_ACCEPT' || !sig) {
          throw new Error(`Counterparty did not sign the virtual-channel open (${reply?.type ?? 'timeout'})`);
        }
        signatures[sig.partyId] = sig;
      }
      const result = assembleVirtualChannelOpen(factory, plan, signatures);
      await localBundle.leaseProvider.commitKeyUse(localSig.reservationId, `factory-vc-open-${factoryId}`);
      if (peer) {
        await peer.sendMessage({
          type: 'VC_FINALIZED',
          channelId: plan.vcId,
          nonce: Date.now(),
          payload: { kind: 'vc-open', factory: result.factory, channel: result.channel },
        });
      }
      context.factories!.set(factoryId, result.factory);
      context.channels.set(result.channel.channelId, result.channel);
      await context.observe?.emit({
        domain: 'factory', kind: 'factory.vc_opened', phase: 'accepted',
        entity: { type: 'channel', id: result.channel.channelId },
        amounts: { capacity: atomsToAmount(result.channel.totalValue), balances: balancesJson(result.channel) },
        transitionHash: channelTransitionHash(result.channel),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { factoryId },
      });
      return { success: true, channelId: result.channel.channelId, factoryId };
    });
  };
  register('totem_omniaOpenVirtualChannel', openVirtual, 'omnia/openVirtualChannel');

  const closeVirtual: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.factories || !context.factoryBundles) throw new Error('Factory manager is not configured');
    const factoryId = requiredString(params, 'factoryId');
    const channelId = requiredString(params, 'channelId');
    const factory = context.factories.get(factoryId);
    if (!factory) throw new Error(`Factory ${factoryId} not found`);
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    const localPartyId = context.localParticipant?.partyId;
    if (!localPartyId) throw new Error('Local participant is not configured');
    const localBundle = context.factoryBundles[localPartyId];
    if (!localBundle) throw new Error('No local factory lease bundle');
    return withOperation(context, params, async () => {
      const plan = buildVirtualChannelClose(factory, channel);
      const localSig = await signVirtualChannelClose(factory, plan, localBundle);
      const signatures: Record<string, any> = { [localSig.partyId]: localSig };
      const remote = factory.participants.find((participant) => participant.partyId !== localPartyId);
      const peer = context.swarm && remote
        ? await context.swarm.connectToPeer(remote.publicKeyDigest, plan.vcId, remote.transportPubkey)
        : undefined;
      if (peer) {
        const reply = await requestPeerReply(
          peer,
          {
            type: 'VC_PROPOSAL',
            channelId: plan.vcId,
            nonce: Date.now(),
            payload: { kind: 'vc-close', factoryId, vcId: plan.vcId, plan },
          },
          plan.vcId,
          30_000,
          ['VC_ACCEPT', 'ERROR'],
        );
        const sig = (reply?.payload as { signature?: any } | undefined)?.signature;
        if (reply?.type !== 'VC_ACCEPT' || !sig) {
          throw new Error(`Counterparty did not sign the virtual-channel close (${reply?.type ?? 'timeout'})`);
        }
        signatures[sig.partyId] = sig;
      }
      const updated = assembleVirtualChannelClose(factory, plan, signatures);
      await localBundle.leaseProvider.commitKeyUse(localSig.reservationId, `factory-vc-close-${factoryId}`);
      if (peer) {
        await peer.sendMessage({
          type: 'VC_FINALIZED',
          channelId: plan.vcId,
          nonce: Date.now(),
          payload: { kind: 'vc-close', factory: updated, channelId },
        });
      }
      context.factories!.set(factoryId, updated);
      context.channels.delete(channelId);
      await context.observe?.emit({
        domain: 'factory', kind: 'factory.vc_closed', phase: 'closed',
        entity: { type: 'channel', id: channelId },
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { factoryId, allocations: Object.fromEntries(Object.entries(updated.allocations ?? {}).map(([k, v]) => [k, v.toString()])) },
      });
      return {
        success: true,
        factoryId,
        channelId,
        allocations: Object.fromEntries(Object.entries(updated.allocations).map(([k, v]) => [k, v.toString()])),
      };
    });
  };
  register('totem_omniaCloseVirtualChannel', closeVirtual, 'omnia/closeVirtualChannel');

  const closeFactoryMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.factories || !context.factoryBundles || !context.chainProvider) throw new Error('Factory manager is not configured');
    const factoryId = requiredString(params, 'factoryId');
    const factory = context.factories.get(factoryId);
    if (!factory) throw new Error(`Factory ${factoryId} not found`);
    const coinProofRaw = params.coinProof
      ?? (params.broadcastProofs as Record<string, unknown> | undefined)?.coinProofs;
    const coinProofHex = Array.isArray(coinProofRaw) ? coinProofRaw[0] : coinProofRaw;
    const coinProof = typeof coinProofHex === 'string'
      ? Buffer.from(coinProofHex.replace(/^0x/i, ''), 'hex')
      : undefined;
    return withOperation(context, params, async () => {
      const localPartyId = context.localParticipant?.partyId;
      const localBundle = localPartyId ? context.factoryBundles![localPartyId] : undefined;
      if (!localPartyId || !localBundle) throw new Error('No local factory lease bundle');
      const remote = factory.participants.find((participant) => participant.partyId !== localPartyId);
      let payload;
      if (context.swarm && remote) {
        // Cooperative close: build/sign locally, collect the counterparty
        // signature over the same draft, then assemble and broadcast once.
        const draft = buildFactorySettlement(factory);
        const localSig = await signFactorySettlement(factory, draft, localBundle);
        const signatures: Record<string, FactorySettlementSignature> = { [localSig.partyId]: localSig };
        const peer = await context.swarm.connectToPeer(remote.publicKeyDigest, factoryId, remote.transportPubkey);
        const message = {
          type: 'FACTORY_CLOSE_PROPOSAL',
          channelId: factoryId,
          nonce: Date.now(),
          payload: { factoryId, draft },
        };
        const reply = await requestPeerReply(peer, message, factoryId, 30_000, ['FACTORY_CLOSE_ACCEPT', 'ERROR']);
        const remoteSig = (reply?.payload as { signature?: FactorySettlementSignature } | undefined)?.signature;
        if (reply?.type !== 'FACTORY_CLOSE_ACCEPT' || !remoteSig) {
          throw new Error(`Counterparty did not co-sign the factory close (${reply?.type ?? 'timeout'})`);
        }
        signatures[remoteSig.partyId] = remoteSig;
        payload = await assembleFactorySettlement(factory, draft, signatures, context.chainProvider, { coinProof });
        await localBundle.leaseProvider.commitKeyUse(localSig.reservationId, `factory-settlement-${factoryId}`);
        await peer.sendMessage({
          type: 'FACTORY_CLOSE_FINALIZED',
          channelId: factoryId,
          nonce: message.nonce,
          payload: { factoryId, txId: payload.txpowId, finalAllocations: payload.finalAllocations },
        });
      } else {
        payload = await closeFactory(factory, context.factoryBundles!, context.chainProvider, { coinProof });
      }
      context.factories!.set(factoryId, { ...factory, status: 'closed' });
      await context.observe?.emit({
        domain: 'factory', kind: 'factory.closed', phase: 'closed',
        entity: { type: 'factory', id: factoryId },
        chain: { txpowId: payload.txpowId },
        amounts: { balances: amountRecordJson(payload.finalAllocations as Record<string, bigint>) },
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
      });
      const finalAllocations = payload.finalAllocations as Record<string, bigint>;
      return { success: true, factoryId, settlementTxId: payload.txpowId, finalAllocations: amountRecordJson(finalAllocations) };
    });
  };
  register('totem_omniaCloseFactory', closeFactoryMethod, 'omnia/closeFactory');

  const splice = (type: 'in' | 'out'): JsonRpcHandler => async (raw) => {
    const params = paramsObject(raw);
    if (!context.spliceLeaseProvider || !context.spliceProposals || !context.spliceAcceptances) {
      throw new Error('Splice manager is not configured');
    }
    const channelId = requiredString(params, 'channelId');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    const localPartyId = context.localParticipant?.partyId;
    if (!localPartyId) throw new Error('Local participant is not configured');
    const remote = channel.parties.find((party) => party.partyId !== localPartyId);
    if (!context.swarm || !remote) throw new Error('Splice requires a counterparty');
    const swarm = context.swarm;
    return withOperation(context, params, async () => {
      const provider = context.spliceLeaseProvider!;
      const quiesced = await quiesceChannel(channel, provider);
      const proposal = type === 'in'
        ? await proposeSpliceIn(quiesced, requiredString(params, 'additionalCoinId'), requiredAmount(params, 'additionalAmount'), provider, params.newBalances as Record<string, bigint> | undefined)
        : await proposeSpliceOut(quiesced, requiredAmount(params, 'withdrawAmount'), requiredString(params, 'withdrawAddress'), provider, params.newBalances as Record<string, bigint> | undefined);
      context.spliceProposals!.set(proposal.spliceId, proposal);

      const peer = await swarm.connectToPeer(remote.publicKeyDigest, channelId, remote.transportPubkey);
      const proposalMessage = {
        type: 'SPLICE_PROPOSAL',
        channelId,
        nonce: Date.now(),
        payload: { proposal },
      };
      const reply = await requestPeerReply(peer, proposalMessage, channelId, 30_000, ['SPLICE_ACCEPT', 'ERROR']);
      const acceptance = (reply?.payload as { acceptance?: SpliceAcceptance } | undefined)?.acceptance;
      if (reply?.type !== 'SPLICE_ACCEPT' || !acceptance) {
        throw new Error(`Counterparty did not accept the splice (${reply?.type ?? 'timeout'})`);
      }
      context.spliceAcceptances!.set(proposal.spliceId, acceptance);

      const spliced = await finalizeSplice(quiesced, proposal, acceptance, {
        ...(provider.broadcast ? { broadcast: provider.broadcast } : {}),
        proposerLeaseProvider: provider.wotsLease,
        // CAN-011: without on-chain observation a splice cannot be active.
        chainProvider: context.chainProvider,
      });
      context.channels.set(channelId, spliced as unknown as OmniaChannel);
      await context.observe?.emit({
        domain: 'splice', kind: 'splice.completed', phase: 'confirmed',
        entity: { type: 'channel', id: channelId },
        amounts: { capacity: atomsToAmount(spliced.totalValue), balances: amountRecordJson(spliced.balances) },
        chain: { fundingCoinId: spliced.spliceFundingCoinId, txpowId: spliced.spliceFundingTxId },
        transitionHash: hashTransition(['splice', channelId, spliced.spliceFundingCoinId, spliced.spliceFundingTxId]),
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        data: { spliceId: proposal.spliceId, spliceType: spliced.spliceType },
      });
      await peer.sendMessage({
        type: 'SPLICE_FINALIZED',
        channelId,
        nonce: proposalMessage.nonce,
        payload: {
          channel: spliced,
          txId: spliced.spliceFundingTxId,
          spliceId: proposal.spliceId,
        },
      });
      return {
        success: true,
        channelId,
        spliceId: proposal.spliceId,
        spliceType: spliced.spliceType,
        totalValue: atomsToAmount(spliced.totalValue),
        balances: amountRecordJson(spliced.balances),
        fundingCoinId: spliced.spliceFundingCoinId,
      };
    });
  };
  register('totem_omniaSpliceIn', splice('in'), 'omnia/spliceIn');
  register('totem_omniaSpliceOut', splice('out'), 'omnia/spliceOut');

  function parseWireRoute(value: unknown): Route | CrossTokenRoute {
    if (!value || typeof value !== 'object') throw new Error('route must be an object');
    const raw = value as Record<string, unknown>;
    if (!Array.isArray(raw.hops) || raw.hops.length === 0) throw new Error('route.hops must be a non-empty array');
    const hops = raw.hops.map((entry, index) => {
      if (!entry || typeof entry !== 'object') throw new Error(`route.hops[${index}] must be an object`);
      const hop = entry as Record<string, unknown>;
      const base = {
        channelId: String(hop.channelId ?? ''),
        from: String(hop.from ?? ''),
        to: String(hop.to ?? ''),
        amount: typeof hop.amount === 'bigint' ? hop.amount : amountToAtoms(String(hop.amount ?? '0')),
        tokenId: String(hop.tokenId ?? ''),
        ...(typeof hop.htlcId === 'string' ? { htlcId: hop.htlcId } : {}),
      };
      if (hop.isSwap === true) {
        return {
          ...base,
          isSwap: true as const,
          tokenIn: String(hop.tokenIn ?? ''),
          tokenOut: String(hop.tokenOut ?? ''),
          amountIn: typeof hop.amountIn === 'bigint' ? hop.amountIn : amountToAtoms(String(hop.amountIn ?? '0')),
          amountOut: typeof hop.amountOut === 'bigint' ? hop.amountOut : amountToAtoms(String(hop.amountOut ?? '0')),
          rate: String(hop.rate ?? ''),
          inboundChannelId: String(hop.inboundChannelId ?? ''),
          outboundChannelId: String(hop.outboundChannelId ?? ''),
        };
      }
      return base;
    });
    const route = {
      hops,
      totalFees: typeof raw.totalFees === 'bigint' ? raw.totalFees : amountToAtoms(String(raw.totalFees ?? '0')),
      tokenIn: String(raw.tokenIn ?? ''),
      tokenOut: String(raw.tokenOut ?? ''),
      estimatedBlocks: Number(raw.estimatedBlocks ?? 0),
    } as Route | CrossTokenRoute;
    if (hops.some((hop) => (hop as { isSwap?: boolean }).isSwap)) {
      (route as CrossTokenRoute).swapHops = hops.filter((hop) => (hop as { isSwap?: boolean }).isSwap) as CrossTokenRoute['swapHops'];
    }
    return route;
  }

  function serializeWireRoute(route: Route | CrossTokenRoute): Record<string, unknown> {
    return {
      tokenIn: route.tokenIn,
      tokenOut: route.tokenOut,
      totalFees: atomsToAmount(route.totalFees),
      estimatedBlocks: route.estimatedBlocks,
      hops: route.hops.map((hop) => {
        const base = {
          channelId: hop.channelId,
          from: hop.from,
          to: hop.to,
          amount: atomsToAmount(hop.amount),
          tokenId: hop.tokenId,
          ...(hop.htlcId ? { htlcId: hop.htlcId } : {}),
        };
        if ('isSwap' in hop && hop.isSwap) {
          return {
            ...base,
            isSwap: true,
            tokenIn: hop.tokenIn,
            tokenOut: hop.tokenOut,
            amountIn: atomsToAmount(hop.amountIn),
            amountOut: atomsToAmount(hop.amountOut),
            rate: hop.rate,
            inboundChannelId: hop.inboundChannelId,
            outboundChannelId: hop.outboundChannelId,
          };
        }
        return base;
      }),
    };
  }

  const payMultiHop: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const from = context.localParticipant?.publicKeyDigest;
    if (!from) throw new Error('Local participant is not configured');

    const amount = requiredAmount(params, 'amount');
    const tokenId = requiredString(params, 'tokenId');
    const targetTokenId = typeof params.targetTokenId === 'string' ? params.targetTokenId : undefined;
    const parsedRoute = params.route
      ? parseWireRoute(params.route)
      : await context.routing.getRoute({
          from,
          to: normalizeRouteNode(requiredString(params, 'toPartyId')),
          amount,
          tokenId,
          ...(targetTokenId ? { targetTokenId } : {}),
          ...(typeof params.maxHops === 'number' ? { maxHops: params.maxHops } : {}),
        });
    if (!parsedRoute) throw new Error('No route found');
    const isCrossToken = parsedRoute.hops.some((hop) => 'isSwap' in hop && hop.isSwap === true);

    const parsedRequest: PaymentRequest = {
      hashlock: requiredString(params, 'hashlock'),
      amount,
      tokenId,
      expiryBlock: requiredBigInt(params, 'expiryBlock'),
      ...(typeof params.preimage === 'string' ? { preimage: params.preimage } : {}),
      ...(typeof params.description === 'string' ? { description: params.description } : {}),
    };
    if (!parsedRequest.preimage) throw new Error('preimage is required');

    const ops: ChannelOps = {
      addHTLC: (channel, htlcParams, leaseProvider) => addHTLC(
        channel as OmniaChannel,
        htlcParams,
        leaseProvider as WotsLeaseProvider,
        context.signer,
      ),
      fulfillHTLC: (channel, htlcId, preimage, leaseProvider) => fulfillHTLC(
        channel as OmniaChannel,
        htlcId,
        preimage,
        leaseProvider as WotsLeaseProvider,
        context.chainProvider,
        context.signer,
      ),
      timeoutHTLC: (channel, htlcId, leaseProvider) => timeoutHTLC(
        channel as OmniaChannel,
        htlcId,
        leaseProvider as WotsLeaseProvider,
        context.chainProvider,
        context.signer,
      ),
    };
    const leaseProviders = new Map<string, LeaseProvider>();
    for (const hop of parsedRoute.hops) {
      const channelId = 'channelId' in hop ? hop.channelId : undefined;
      if (channelId) leaseProviders.set(channelId, context.leaseProvider);
      if ('inboundChannelId' in hop && hop.inboundChannelId) leaseProviders.set(hop.inboundChannelId, context.leaseProvider);
      if ('outboundChannelId' in hop && hop.outboundChannelId) leaseProviders.set(hop.outboundChannelId, context.leaseProvider);
    }

    const allHopsLocal = parsedRoute.hops.every((hop) => {
      const channelId = (hop as { channelId?: string }).channelId;
      return typeof channelId === 'string' && context.channels.has(channelId);
    });
    if (!allHopsLocal) {
      if (isCrossToken) {
        throw new Error('Distributed cross-token payments are not supported; all swap hops must be local');
      }
      // Distributed route: this host only controls the first channel. Lock it,
      // hand the routing envelope to the next hop and report the explicit
      // non-terminal state instead of pretending the recipient settled.
      const firstHop = parsedRoute.hops[0] as {
        channelId: string;
        to: string;
        amount: bigint;
        tokenId: string;
      };
      if (!context.swarm) throw new Error('Multi-hop payment requires a swarm transport for the next hop');
      if (!context.leaseProvider) throw new Error('Multi-hop payment requires a lease provider');
      if (!context.signer) throw new Error('Multi-hop payment requires a channel signer');
      const firstChannel = context.channels.get(firstHop.channelId) as OmniaChannel | undefined;
      if (!firstChannel) throw new Error(`Channel ${firstHop.channelId} not found`);
      const locked = await addHTLC(
        firstChannel,
        {
          amount: firstHop.amount,
          hashlock: parsedRequest.hashlock,
          timeoutBlock: parsedRequest.expiryBlock,
          direction: 'offered',
          counterpartPublicKeyDigest: firstHop.to,
        },
        context.leaseProvider,
        context.signer,
      );
      context.channels.set(locked.channel.channelId, locked.channel);
      const onward = parsedRoute.hops.slice(1);
      const envelope = onward.length > 0
        ? createCleartextRoutingCodec().build(onward as never)
        : undefined;
      const peer = await context.swarm.connectToPeer(firstHop.to, firstHop.channelId);
      await peer.sendMessage({
        type: 'STATE_UPDATE',
        channelId: locked.channel.channelId,
        nonce: Date.now(),
        payload: {
          ...locked.partialState,
          ...(envelope ? { forward: { hashlock: parsedRequest.hashlock, envelope } } : {}),
        },
      });
      return {
        success: false,
        state: 'first-hop-accepted',
        status: 'first-hop-accepted',
        settled: false,
        terminal: false,
        firstHopChannelId: locked.channel.channelId,
        htlcId: locked.htlcId,
        route: serializeWireRoute(parsedRoute),
      };
    }

    return withOperation(context, params, async () => {
      const result = isCrossToken
        ? await executeCrossTokenPayment(
            ops,
            context.channels as unknown as Map<string, RouterChannel>,
            parsedRoute as CrossTokenRoute,
            parsedRequest,
            leaseProviders,
          )
        : await executeMultiHopPayment(
            ops,
            context.channels as unknown as Map<string, RouterChannel>,
            parsedRoute as Route,
            parsedRequest,
            leaseProviders,
          );
      if (!result.success) {
        // OMN-006: a failed multi-hop call must not discard the router's
        // outstanding refund obligations; surface them to the RPC caller.
        const pendingRefunds = (result as { pendingRefunds?: unknown }).pendingRefunds;
        return {
          success: false,
          state: 'failed',
          terminal: false,
          settled: false,
          error: result.error ?? 'multi-hop payment failed',
          errorCode: 'MULTI_HOP_FAILED',
          ...(pendingRefunds !== undefined ? { pendingRefunds } : {}),
          settledHops: result.settledHops,
          route: serializeWireRoute(parsedRoute),
        };
      }
      await context.observe?.emit({
        domain: 'payment', kind: 'payment.completed', phase: 'committed',
        entity: { type: 'payment', id: typeof params.operationId === 'string' ? params.operationId : parsedRequest.hashlock },
        ...(typeof params.operationId === 'string' ? { operationId: params.operationId } : {}),
        amounts: { amount: atomsToAmount(parsedRequest.amount) },
        token: { tokenId: parsedRequest.tokenId, scale: 0 },
        transitionHash: hashTransition(['payment', parsedRequest.hashlock, result.settledHops.join(',')]),
        data: {
          settledHops: result.settledHops,
          hops: parsedRoute.hops.map((h) => ({ channelId: (h as { channelId?: string }).channelId, amount: atomsToAmount((h as { amount: bigint }).amount) })),
        },
      });
      return {
        success: true,
        state: 'recipient-settled',
        terminal: true,
        settled: true,
        preimage: result.preimage,
        settledHops: result.settledHops,
        route: serializeWireRoute(parsedRoute),
      };
    });
  };
  register('totem_omniaPayMultiHop', payMultiHop, 'omnia/payMultiHop');

  // CAN-013: every channel mutation takes the same per-channel lock, not just
  // direct pay. Peer handlers take the same lock (channel-lock.ts), so an RPC
  // call and an incoming message for one channel cannot interleave.
  const locked = new Map<string, JsonRpcHandler>();
  for (const [name, handler] of methods) {
    locked.set(name, (raw) => {
      const params = (raw ?? {}) as Record<string, unknown>;
      const channelId = typeof params.channelId === 'string' ? params.channelId : undefined;
      return channelId ? withChannelLock(channelId, async () => handler(raw)) : handler(raw);
    });
  }

  return observeMethods(locked);
}

import {
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
  proposeSettlement,
  buildSettlementSigningRequest,
  recordMeterReading,
  setCounter,
  timeoutHTLC,
  updateState,
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
  OmniaSwarm,
  ProgramTransition,
  SignRequest,
  SignerPort,
  UnsignedStateUpdate,
  UpdateStateResult,
  ChannelOpeningPlan,
} from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { SigningIndices, WotsLeaseProvider } from '@totemsdk/wots-lease';
import {
  executeCrossTokenPayment,
  executeMultiHopPayment,
  type ChannelOps,
  type CrossTokenRoute,
  type LeaseProvider,
  type PaymentRequest,
  type Route,
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
  createFactory,
  signFactorySettlement,
  signVirtualChannelClose,
  signVirtualChannelOpen,
  type ChannelFactory,
  type FactorySettlementSignature,
  type FactoryFundingMaterial,
  type FactoryParticipant,
  type WotsLeaseBundle,
} from '@totemsdk/omnia-factory';
import {
  finalizeSplice,
  proposeSpliceIn,
  proposeSpliceOut,
  quiesceChannel,
  type SpliceAcceptance,
  type SpliceLeaseProvider,
  type SpliceProposal,
} from '@totemsdk/omnia-splice';
import type { JsonRpcHandler } from './jsonrpc.js';
import type { RoutingProvider } from '../router/routing-provider.js';
import type { OperationStore } from '../stores/operations.js';

export type OperationStoreLike = Pick<OperationStore, 'get' | 'create' | 'transition' | 'listByStatus'>;

export interface HostApiContext {
  channels: Map<string, OmniaChannel>;
  routing: RoutingProvider;
  refreshRouting?: () => void;
  operations?: OperationStoreLike;
  signer?: ChannelSigner;
  leaseProvider?: WotsLeaseProvider;
  chainProvider?: ChainStateProvider;
  swarm?: OmniaSwarm;
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
}

function channelSummary(channel: OmniaChannel): Record<string, unknown> {
  const parties = channel.parties.map((party) => party.partyId);
  return {
    channelId: channel.channelId,
    status: channel.status,
    tokenId: channel.tokenId,
    totalValue: channel.totalValue.toString(),
    localBalance: (channel.balances[parties[0]] ?? 0n).toString(),
    remoteBalance: (channel.balances[parties[1]] ?? 0n).toString(),
    currentSequence: channel.currentSequence,
  };
}

/** Recursively JSON-safe: bigint → decimal string, bytes → 0x-hex. */
function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString('hex')}`;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) out[key] = jsonSafe(val);
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
    totalValue: channel.totalValue,
    currentSequence: channel.currentSequence,
    fundingAddress: channel.fundingAddress,
    fundingScript: channel.fundingScript,
    fundingTxId: channel.fundingTxId,
    fundingCoinId: channel.fundingCoinId,
    contestDelayBlocks: channel.contestDelayBlocks,
    parties: channel.parties,
    balances: channel.balances,
    pendingHTLCs: channel.pendingHTLCs,
    latestState: channel.latestState
      ? {
          sequence: channel.latestState.sequence,
          balances: channel.latestState.balances,
          pendingHTLCs: channel.latestState.pendingHTLCs?.length ?? 0,
          stateVariables: channel.latestState.stateVariables,
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

function operationId(params: Record<string, unknown>): string {
  return requiredString(params, 'operationId');
}

function bigintRecord(params: Record<string, unknown>, key: string): Record<string, bigint> | undefined {
  const value = params[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${key} must be an object`);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([partyId, balance]) => [
    partyId,
    BigInt(String(balance)),
  ]));
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

function optionalTransitionInputs(params: Record<string, unknown>): ProgramTransition['inputs'] {
  const value = params.inputs;
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('inputs must be an object');
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, nested]) => {
    if (typeof nested === 'string' || typeof nested === 'boolean') return [name, nested];
    if (typeof nested === 'number' && Number.isSafeInteger(nested)) return [name, BigInt(nested)];
    throw new Error(`inputs.${name} must be a string, boolean, or safe integer`);
  }));
}

function balancesJson(channel: OmniaChannel): Record<string, string> {
  return Object.fromEntries(Object.entries(channel.balances).map(([partyId, balance]) => [partyId, balance.toString()]));
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
    throw new Error(`Operation ${id} request does not match the original request`);
  }
  if (existing?.status === 'committed') return existing.result as T;
  if (existing && !['pending', 'failed'].includes(existing.status)) {
    throw new Error(`Operation ${id} is already ${existing.status}`);
  }
  if (!existing) context.operations.create(id, params);
  context.operations.transition(id, existing?.status === 'failed' ? 'failed' : 'pending', 'executing');
  try {
    const result = await run();
    context.operations.transition(id, 'executing', 'committed', { result });
    return result;
  } catch (error) {
    context.operations.transition(id, 'executing', 'failed', { error: error instanceof Error ? error.message : String(error) });
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
    const amount = requiredBigInt(params, 'amount');
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
        context: { summary: `Authorize payment of ${amount.toString()} on channel ${channelId}` },
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

    const rawBalances = params.newBalances;
    const newBalances = rawBalances && typeof rawBalances === 'object'
      ? Object.fromEntries(
          Object.entries(rawBalances as Record<string, unknown>).map(([partyId, value]) => [partyId, BigInt(String(value))]),
        )
      : channel.balances;
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
      if (context.swarm) {
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
      localAmount: requiredBigInt(params, 'localAmount'),
      remoteAmount: requiredBigInt(params, 'remoteAmount'),
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
      const summary = `Open channel ${plan.channel.channelId} (${plan.channel.totalValue} units)`;
      const intent: import('@totemsdk/omnia').SignRequest = {
        ...base,
        requestId: `${preparedOperationId}:intent`,
        kind: 'intent',
        digest: plan.fundingDigest,
        context: {
          summary: `Authorize ${summary}`,
          amount: plan.channel.totalValue.toString(),
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
        totalValue: plan.channel.totalValue.toString(),
        requests: { intent, funding },
        expiresAt,
      };
    });
  };
  methods.set('totem_omniaPrepareOpenChannel', prepareOpenChannel);
  methods.set('omnia/prepareOpenChannel', prepareOpenChannel);

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
        }
      }
      context.preparedOpen!.delete(preparedOperationId);
      return { success: true, channelId: channel.channelId, fundingTxId, acknowledged };
    });
  };
  methods.set('totem_omniaSubmitOpenChannel', submitOpenChannel);
  methods.set('omnia/submitOpenChannel', submitOpenChannel);
}

export function createHostMethods(context: HostApiContext): Map<string, JsonRpcHandler> {
  const methods = new Map<string, JsonRpcHandler>();
  const register = (name: string, handler: JsonRpcHandler, alias: string): void => {
    methods.set(name, handler);
    methods.set(alias, handler);
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

  const getChannelState: JsonRpcHandler = (raw) => {
    const params = paramsObject(raw);
    const channelId = requiredString(params, 'channelId');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    return channelStateView(channel);
  };
  register('totem_omniaGetChannelState', getChannelState, 'omnia/getChannelState');

  const getRoute: JsonRpcHandler = async (raw) => {
    context.refreshRouting?.();
    const params = paramsObject(raw);
    const route = await context.routing.getRoute({
      from: requiredString(params, 'fromPartyId'),
      to: requiredString(params, 'toPartyId'),
      amount: requiredBigInt(params, 'amount'),
      tokenId: requiredString(params, 'tokenId'),
      targetTokenId: typeof params.targetTokenId === 'string' ? params.targetTokenId : undefined,
      maxHops: typeof params.maxHops === 'number' ? params.maxHops : undefined,
    });
    if (!route) return { success: false, error: 'No route found', errorCode: 'ROUTE_NOT_FOUND' };
    return {
      success: true,
      route: {
        ...route,
        totalFees: route.totalFees.toString(),
        hops: route.hops.map((hop) => ({
          ...hop,
          amount: hop.amount.toString(),
          ...('isSwap' in hop && hop.isSwap ? {
            amountIn: hop.amountIn.toString(),
            amountOut: hop.amountOut.toString(),
          } : {}),
        })),
      },
    };
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
      delegation: context.identity.delegation,
      custodyMode: context.custodyMode ?? 'self',
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
    return methods;
  }
  if (context.readOnly || !context.signer || !context.leaseProvider) {
    return methods;
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
      const createParams: CreateChannelParams = {
        localParty: {
          ...context.localParticipant,
          transportPubkey: context.localParticipant.transportPubkey ?? context.transportPubkey,
        },
        remoteParty: remote,
        localAmount: requiredBigInt(params, 'localAmount'),
        remoteAmount: requiredBigInt(params, 'remoteAmount'),
        tokenId: typeof params.tokenId === 'string' ? params.tokenId : undefined,
        fundingCoinId: requiredString(params, 'fundingCoinId'),
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
        const fundingPubkey = typeof params.fundingPubkey === 'string' ? params.fundingPubkey : undefined;
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
        if (typeof params.fundingScript !== 'string' && !Array.isArray(params.fundingScriptProofsHex)) {
          throw new Error('openChannel requires fundingScript (or serialized fundingScriptProofsHex) for the funding input address');
        }
        const toBytes = (v: unknown): Uint8Array[] =>
          Array.isArray(v) ? v.map((h) => Buffer.from(String(h).replace(/^0x/i, ''), 'hex')) : [];
        createParams.fundingProofs = {
          coinProofs: toBytes(params.fundingCoinProofsHex),
          scriptProofs: toBytes(params.fundingScriptProofsHex),
        };
        // The funding coin's address script: createChannel derives the required
        // single-leaf ScriptProof from it, so callers need not hand-roll it.
        if (typeof params.fundingScript === 'string') {
          createParams.fundingScript = params.fundingScript;
        }
        createParams.fundingSigner = context.signerPort && (context.custodyMode ?? 'self') !== 'hosted'
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
      const created = await createChannel(createParams, context.chainProvider);
      context.channels.set(created.channel.channelId, {
        ...created.channel,
        localSigner: context.signer,
      });
      let acknowledged = true;
      if (context.swarm) {
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
      return { success: true, channelId: created.channel.channelId, fundingTxId: created.channel.fundingTxId, acknowledged };
    });
    return result;
  };
  register('totem_omniaOpenChannel', openChannel, 'omnia/openChannel');

  const pay: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const channelId = requiredString(params, 'channelId');
    const amount = requiredBigInt(params, 'amount');
    return withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const localPartyId = context.localParticipant.partyId;
      const remotePartyId = channel.parties.find((party) => party.partyId !== localPartyId)?.partyId;
      if (!remotePartyId) throw new Error('Channel counterparty not found');
      if (amount <= 0n || (channel.balances[localPartyId] ?? 0n) < amount) throw new Error('Insufficient channel balance');
      const result = await updateState(channel, {
        newBalances: {
          ...channel.balances,
          [localPartyId]: (channel.balances[localPartyId] ?? 0n) - amount,
          [remotePartyId]: (channel.balances[remotePartyId] ?? 0n) + amount,
        },
      }, context.leaseProvider, context.signer, context.signerPort);
      if (result.error) throw new Error(result.error);
      context.channels.set(channelId, result.channel);
      const remoteParty = channel.parties.find((party) => party.partyId === remotePartyId)!;
      const peer = context.swarm ? await context.swarm.connectToPeer(
        remoteParty.publicKeyDigest,
        channelId,
        remoteParty.transportPubkey,
      ) : undefined;
      if (peer) await peer.sendMessage({ type: 'STATE_UPDATE', channelId, nonce: Date.now(), payload: result.signedState });
      return { success: true, channelId, sequence: result.channel.currentSequence, localBalance: result.channel.balances[localPartyId]!.toString(), remoteBalance: result.channel.balances[remotePartyId]!.toString() };
    });
  };
  register('totem_omniaPay', pay, 'omnia/pay');
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
    const balances = bigintRecord(params, 'balances');
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
        requiredBigInt(params, 'unitPrice'),
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
      return { success: true, channelId, settlementTxId: settlement.settlementPayload.txpowId, finalBalances: Object.fromEntries(Object.entries(settlement.settlementPayload.balances).map(([key, value]) => [key, value.toString()])) };
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
        contributionAmount: BigInt(requiredString(item, 'contributionAmount')),
        fundingCoinId: typeof item.fundingCoinId === 'string' ? item.fundingCoinId : undefined,
        settlementAddress: typeof item.settlementAddress === 'string' ? item.settlementAddress : undefined,
        transportPubkey: typeof item.transportPubkey === 'string' ? item.transportPubkey : undefined,
      } satisfies FactoryParticipant;
    });
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
      // Off-chain when no funding material is supplied; with funding material the
      // SDK builds, signs, and submits the on-chain factory funding TX.
      let factory = await createFactory(
        parsed,
        tokenId,
        localBundle,
        context.chainProvider,
        0,
        funding,
      );
      if (context.swarm && remote) {
        const peer = await context.swarm.connectToPeer(remote.publicKeyDigest, factory.factoryId, remote.transportPubkey);
        const reply = await requestPeerReply(
          peer,
          {
            type: 'FACTORY_PROPOSAL',
            channelId: factory.factoryId,
            nonce: Date.now(),
            payload: { factory },
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
        factory = accepted;
      }
      context.factories!.set(factory.factoryId, factory);
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
    const parsedAmounts = Object.fromEntries(Object.entries(amounts as Record<string, unknown>).map(([key, value]) => [key, BigInt(String(value))]));
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
          payload: { factoryId, txId: payload.txpowId },
        });
      } else {
        payload = await closeFactory(factory, context.factoryBundles!, context.chainProvider, { coinProof });
      }
      context.factories!.set(factoryId, { ...factory, status: 'closed' });
      const finalAllocations = payload.finalAllocations as Record<string, bigint>;
      return { success: true, factoryId, settlementTxId: payload.txpowId, finalAllocations: Object.fromEntries(Object.entries(finalAllocations).map(([key, value]) => [key, value.toString()])) };
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
        ? await proposeSpliceIn(quiesced, requiredString(params, 'additionalCoinId'), requiredBigInt(params, 'additionalAmount'), provider, params.newBalances as Record<string, bigint> | undefined)
        : await proposeSpliceOut(quiesced, requiredBigInt(params, 'withdrawAmount'), requiredString(params, 'withdrawAddress'), provider, params.newBalances as Record<string, bigint> | undefined);
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
      });
      context.channels.set(channelId, spliced as unknown as OmniaChannel);
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
        totalValue: spliced.totalValue.toString(),
        balances: Object.fromEntries(Object.entries(spliced.balances).map(([partyId, amount]) => [partyId, amount.toString()])),
        fundingCoinId: spliced.spliceFundingCoinId,
      };
    });
  };
  register('totem_omniaSpliceIn', splice('in'), 'omnia/spliceIn');
  register('totem_omniaSpliceOut', splice('out'), 'omnia/spliceOut');

  const payMultiHop: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    requireMutationContext(context);
    const route = params.route;
    if (!route || typeof route !== 'object' || !Array.isArray((route as Record<string, unknown>).hops)) {
      throw new Error('route with hops is required');
    }
    const paymentRequest = params.paymentRequest;
    if (!paymentRequest || typeof paymentRequest !== 'object') {
      throw new Error('paymentRequest is required');
    }
    const request = paymentRequest as Record<string, unknown>;
    const parsedRequest: PaymentRequest = {
      hashlock: requiredString(request, 'hashlock'),
      amount: requiredBigInt(request, 'amount'),
      tokenId: requiredString(request, 'tokenId'),
      expiryBlock: requiredBigInt(request, 'expiryBlock'),
      preimage: typeof request.preimage === 'string' ? request.preimage : undefined,
      description: typeof request.description === 'string' ? request.description : undefined,
    };
    const parsedRoute = route as Route | CrossTokenRoute;
    const isCrossToken = 'swapHops' in parsedRoute && Array.isArray(parsedRoute.swapHops) && parsedRoute.swapHops.length > 0;

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
      if (!result.success) throw new Error(result.error ?? 'multi-hop payment failed');
      return {
        success: true,
        preimage: result.preimage,
        settledHops: result.settledHops,
      };
    });
  };
  register('totem_omniaPayMultiHop', payMultiHop, 'omnia/payMultiHop');

  return methods;
}

import {
  createChannel,
  applyProgramTransition,
  decrementCounter,
  incrementCounter,
  markChannelClosed,
  markChannelClosing,
  proposeSettlement,
  recordMeterReading,
  setCounter,
  updateState,
} from '@totemsdk/omnia';
import type { ChannelParticipant, ChannelSigner, CreateChannelParams, OmniaChannel, OmniaSwarm, ProgramTransition, UpdateStateResult } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import {
  acceptFactory,
  closeFactory,
  closeVirtualChannel,
  createFactory,
  openVirtualChannel,
  type ChannelFactory,
  type FactoryParticipant,
  type WotsLeaseBundle,
} from '@totemsdk/omnia-factory';
import {
  acceptSplice,
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
  factories?: Map<string, ChannelFactory>;
  factoryBundles?: Record<string, WotsLeaseBundle>;
  spliceProposals?: Map<string, SpliceProposal>;
  spliceAcceptances?: Map<string, SpliceAcceptance>;
  spliceLeaseProvider?: SpliceLeaseProvider;
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
    const peer = await context.swarm.connectToPeer(remoteParty.publicKeyDigest, channelId);
    await peer.sendMessage({ type: 'STATE_UPDATE', channelId, nonce: Date.now(), payload: result.signedState });
  }
  return {
    success: true,
    channelId,
    sequence: result.channel.currentSequence,
    balances: balancesJson(result.channel),
  };
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
    };
    const result = await withOperation(context, params, async () => {
      const createParams: CreateChannelParams & { fundingWitnessBytes: Uint8Array } = {
        localParty: context.localParticipant,
        remoteParty: remote,
        localAmount: requiredBigInt(params, 'localAmount'),
        remoteAmount: requiredBigInt(params, 'remoteAmount'),
        tokenId: typeof params.tokenId === 'string' ? params.tokenId : undefined,
        fundingCoinId: requiredString(params, 'fundingCoinId'),
        fundingWitnessBytes: Buffer.from(requiredString(params, 'fundingWitnessHex').replace(/^0x/i, ''), 'hex'),
      };
      const created = await createChannel(createParams as CreateChannelParams, context.chainProvider);
      context.channels.set(created.channel.channelId, {
        ...created.channel,
        localSigner: context.signer,
      });
      if (context.swarm) {
        const peer = await context.swarm.connectToPeer(remote.publicKeyDigest, created.channel.channelId);
        await peer.sendMessage({ type: 'CHANNEL_PROPOSAL', channelId: created.channel.channelId, nonce: Date.now(), payload: created.proposal });
      }
      return { success: true, channelId: created.channel.channelId, fundingTxId: created.channel.fundingTxId };
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
      }, context.leaseProvider, context.signer);
      if (result.error) throw new Error(result.error);
      context.channels.set(channelId, result.channel);
      const peer = context.swarm ? await context.swarm.connectToPeer(
        channel.parties.find((party) => party.partyId === remotePartyId)!.publicKeyDigest,
        channelId,
      ) : undefined;
      if (peer) await peer.sendMessage({ type: 'STATE_UPDATE', channelId, nonce: Date.now(), payload: result.signedState });
      return { success: true, channelId, sequence: result.channel.currentSequence, localBalance: result.channel.balances[localPartyId]!.toString(), remoteBalance: result.channel.balances[remotePartyId]!.toString() };
    });
  };
  register('totem_omniaPay', pay, 'omnia/pay');

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
    return withOperation(context, params, async () => {
      const channel = context.channels.get(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);
      const closing = markChannelClosing(channel, 'mutual');
      const settlement = await proposeSettlement(closing, context.leaseProvider, {
        signer: context.signer,
        chainProvider: context.chainProvider,
        partyAddresses: Object.fromEntries(closing.parties.map((party) => [party.partyId, party.settlementAddress ?? party.publicKeyDigest])),
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
    if (!context.factories || !context.factoryBundles || !context.chainProvider) throw new Error('Factory manager is not configured');
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
      } satisfies FactoryParticipant;
    });
    const tokenId = typeof params.tokenId === 'string' ? params.tokenId : '0x00';
    const bundles = context.factoryBundles;
    const proposer = parsed.find((participant) => bundles[participant.partyId]);
    if (!proposer) throw new Error('No local factory lease bundle matches a participant');
    return withOperation(context, params, async () => {
      const factory = await createFactory(parsed, tokenId, bundles[proposer.partyId], context.chainProvider);
      context.factories!.set(factory.factoryId, factory);
      return { success: true, factoryId: factory.factoryId, fundingTxId: factory.fundingTxId };
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
    return withOperation(context, params, async () => {
      const result = await openVirtualChannel(factory, parties as [string, string], parsedAmounts, context.factoryBundles!);
      context.factories!.set(factoryId, result.factory);
      context.channels.set(result.channel.channelId, result.channel);
      return { success: true, channelId: result.channel.channelId, factoryId };
    });
  };
  register('totem_omniaOpenVirtualChannel', openVirtual, 'omnia/openVirtualChannel');

  const closeFactoryMethod: JsonRpcHandler = async (raw) => {
    const params = paramsObject(raw);
    if (!context.factories || !context.factoryBundles || !context.chainProvider) throw new Error('Factory manager is not configured');
    const factoryId = requiredString(params, 'factoryId');
    const factory = context.factories.get(factoryId);
    if (!factory) throw new Error(`Factory ${factoryId} not found`);
    return withOperation(context, params, async () => {
      const payload = await closeFactory(factory, context.factoryBundles!, context.chainProvider);
      context.factories!.set(factoryId, { ...factory, status: 'closed' });
      return { success: true, factoryId, settlementTxId: payload.txpowId, finalAllocations: Object.fromEntries(Object.entries(payload.finalAllocations).map(([key, value]) => [key, value.toString()])) };
    });
  };
  register('totem_omniaCloseFactory', closeFactoryMethod, 'omnia/closeFactory');

  const splice = (type: 'in' | 'out'): JsonRpcHandler => async (raw) => {
    const params = paramsObject(raw);
    if (!context.spliceLeaseProvider || !context.spliceProposals) throw new Error('Splice manager is not configured');
    const channelId = requiredString(params, 'channelId');
    const channel = context.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    return withOperation(context, params, async () => {
      const quiesced = await quiesceChannel(channel, context.spliceLeaseProvider!);
      const proposal = type === 'in'
        ? await proposeSpliceIn(quiesced, requiredString(params, 'additionalCoinId'), requiredBigInt(params, 'additionalAmount'), context.spliceLeaseProvider!, params.newBalances as Record<string, bigint> | undefined)
        : await proposeSpliceOut(quiesced, requiredBigInt(params, 'withdrawAmount'), requiredString(params, 'withdrawAddress'), context.spliceLeaseProvider!, params.newBalances as Record<string, bigint> | undefined);
      context.spliceProposals!.set(proposal.spliceId, proposal);
      context.channels.set(channelId, quiesced as unknown as OmniaChannel);
      return { success: true, channelId, spliceId: proposal.spliceId, updatedChannelState: proposal.spliceTxHex };
    });
  };
  register('totem_omniaSpliceIn', splice('in'), 'omnia/spliceIn');
  register('totem_omniaSpliceOut', splice('out'), 'omnia/spliceOut');

  const unsupported: JsonRpcHandler = () => {
    throw new Error('This operation requires a counterparty proposal/acceptance round');
  };
  register('totem_omniaPayMultiHop', unsupported, 'omnia/payMultiHop');

  return methods;
}

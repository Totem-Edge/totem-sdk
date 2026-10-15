/**
 * Live execution backends for omnia-pool ports (RFC-035 B5 / RFC-038).
 *
 * Binds `omnia-pool`'s execution ports to the live Omnia packages using the
 * wallet's signing material.
 *
 * NOTE: several of `omnia-pool`'s execution-port signatures have diverged from
 * the current Omnia package APIs (they were written against an earlier surface).
 * Methods that still map cleanly are wired; methods that no longer map fail closed
 * with an explicit reason. Reconciling the port interfaces is a follow-up (see
 * RFC-038 §"pool wiring").
 */

import {
  createChannel,
  updateState,
  addHTLC,
  fulfillHTLC,
  proposeSettlement,
  verifyStateForCoSign,
  markChannelClosed,
} from '@totemsdk/omnia';
import type { ChannelSigner, OmniaChannel } from '@totemsdk/omnia';
import {
  createFactory,
  openVirtualChannel,
  closeFactory as closeFactoryLocal,
} from '@totemsdk/omnia-factory';
import type { WotsLeaseBundle } from '@totemsdk/omnia-factory';
import { quiesceChannel } from '@totemsdk/omnia-splice';
import type { SpliceLeaseProvider } from '@totemsdk/omnia-splice';
import { createPool, mintVtxo, createExitDraft } from '@totemsdk/omnia-vtxo';
import type { OmniaVtxoPool } from '@totemsdk/omnia-vtxo';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type {
  OmniaExecutionPort,
  FactoryExecutionPort,
  RouterExecutionPort,
  SpliceExecutionPort,
  VtxoExecutionPort,
} from './types.js';

export interface OmniaPoolLivePortsDeps {
  signer: ChannelSigner;
  leaseProvider: WotsLeaseProvider;
  chainProvider?: ChainStateProvider;
  /** All N factory lease bundles, keyed by partyId (multi-party factory ops). */
  factoryBundles?: Record<string, WotsLeaseBundle>;
  /** Splice lease provider (signer + wotsLease). */
  spliceLease?: SpliceLeaseProvider;
  now?: () => number;
}

export interface OmniaPoolLivePorts {
  omnia: OmniaExecutionPort;
  factory: FactoryExecutionPort;
  router: RouterExecutionPort;
  splice: SpliceExecutionPort;
  vtxo: VtxoExecutionPort;
}

const notWired = (what: string, why: string): never => {
  throw new Error(`omnia-pool live ports: ${what} is not wired — ${why}`);
};

export function createOmniaPoolLivePorts(deps: OmniaPoolLivePortsDeps): OmniaPoolLivePorts {
  const { signer, leaseProvider, chainProvider } = deps;
  const now = deps.now ?? (() => Date.now());
  const settleOpts = () => (chainProvider ? { signer, chainProvider } : { signer });

  const omnia: OmniaExecutionPort = {
    async createChannel(params) {
      const created = await createChannel(params, chainProvider as never);
      return created.channel;
    },
    async updateState(channel, delta) {
      const result = await updateState(channel, delta, leaseProvider, signer);
      return result.signedState as never;
    },
    async addHTLC(channel, params) {
      return (await addHTLC(channel, params, leaseProvider, signer)).channel;
    },
    async fulfillHTLC(channel, htlcId, preimage) {
      const hex = '0x' + Buffer.from(preimage).toString('hex');
      const result = await fulfillHTLC(channel, htlcId, hex, leaseProvider, signer);
      return result.channel;
    },
    async proposeSettlement(channel) {
      return (await proposeSettlement(channel, leaseProvider, settleOpts())).settlementPayload;
    },
    verifyStateForCoSign(channel, state) {
      return verifyStateForCoSign(channel, state);
    },
    async closeChannel(channel) {
      const { settlementPayload } = await proposeSettlement(channel, leaseProvider, settleOpts());
      return { channel: markChannelClosed(channel), settlementPayload };
    },
  };

  const factory: FactoryExecutionPort = {
    createFactory(params) {
      return createFactory(params.participants, params.tokenId, params.bundle, params.chainProvider, params.tokenScale ?? 0);
    },
    reallocate() {
      return notWired(
        'factory.reallocate',
        'the port gives only a full allocation map; the live API needs {fromPartyId, toPartyId, amount} + all N bundles',
      );
    },
    openVirtualChannel(factoryState, params) {
      const amounts = Object.fromEntries(Object.entries(params.amounts).map(([k, v]) => [k, BigInt(v)]));
      return openVirtualChannel(factoryState, params.parties, amounts, params.leaseProviders, params.channelId);
    },
    closeVirtualChannel() {
      return notWired(
        'factory.closeVirtualChannel',
        'the port gives only a channelId; the live API needs the channel object + all N bundles',
      );
    },
    closeFactory(factoryState) {
      if (!deps.factoryBundles) return notWired('factory.closeFactory', 'no factoryBundles were provided for all N participants');
      return closeFactoryLocal(factoryState, deps.factoryBundles, chainProvider);
    },
  };

  const router: RouterExecutionPort = {
    createChannelGraph() {
      return notWired(
        'router.createChannelGraph',
        'the pool port ChannelGraph type has diverged from @totemsdk/omnia-router (Map); reconcile the interface',
      );
    },
    addChannel() {
      return notWired(
        'router.addChannel',
        'the pool port takes a RouterChannel; @totemsdk/omnia-router addChannel takes a ChannelGraphEdge',
      );
    },
    findRoute() {
      return notWired(
        'router.findRoute',
        'the port takes a PaymentRequest; the live API is findRoute(graph, from, to, amount, tokenId)',
      );
    },
    executeMultiHopPayment() {
      return notWired(
        'router.executeMultiHopPayment',
        'the port takes (graph, route, channelOps); the live API needs the channels map + paymentRequest + per-hop lease providers',
      );
    },
  };

  const splice: SpliceExecutionPort = {
    async quiesceChannel(channel) {
      if (!deps.spliceLease) return notWired('splice.quiesceChannel', 'no spliceLease provided');
      return quiesceChannel(channel, deps.spliceLease);
    },
    proposeSpliceOut() {
      return notWired('splice.proposeSpliceOut', 'the port gives only SpliceParams; the live API needs the quiesced channel');
    },
    acceptSplice() {
      return notWired('splice.acceptSplice', 'the live API needs the channel in addition to the proposal');
    },
    finalizeSplice() {
      return notWired('splice.finalizeSplice', 'the live API needs the channel + proposal + acceptance');
    },
  };

  const vtxo: VtxoExecutionPort = {
    async createPool(params) {
      return createPool(
        {
          operator: params.operator,
          tokenId: params.tokenId,
          totalCapacity: BigInt(params.totalCapacity),
          nonce: params.nonce,
          ...(params.policy !== undefined ? { policy: params.policy as never } : {}),
        },
        now(),
      );
    },
    async mintVtxo(pool: OmniaVtxoPool, params) {
      const result = mintVtxo(pool, params, now());
      return { pool: result.pool, vtxo: result.vtxo };
    },
    async createExitDraft(vtxoState) {
      return (await createExitDraft(vtxoState, now())).draft;
    },
    markExiting() {
      return notWired('vtxo.markExiting', 'the port is pool-shaped but omnia-vtxo marks a VTXO; needs a pool/vtxo store contract');
    },
    markExited() {
      return notWired('vtxo.markExited', 'the port is pool-shaped but omnia-vtxo marks a VTXO; needs a pool/vtxo store contract');
    },
  };

  return { omnia, factory, router, splice, vtxo };
}

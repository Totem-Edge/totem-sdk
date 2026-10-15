/**
 * Live execution backends for omnia-pool ports (RFC-035 B5 / RFC-038).
 *
 * Binds `omnia-pool`'s execution ports to the live Omnia packages. The ports take
 * their own lease bundles / lease providers / channel ops as arguments (reconciled
 * with the live APIs), so this adapter is a thin delegation; only the channel
 * operations (`omnia`) are closed over the wallet's signer + lease + chain.
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
import type { ChannelSigner } from '@totemsdk/omnia';
import {
  createFactory,
  reallocate,
  openVirtualChannel,
  closeVirtualChannel,
  closeFactory,
} from '@totemsdk/omnia-factory';
import {
  createChannelGraph,
  addChannel,
  findRoute,
  executeMultiHopPayment,
} from '@totemsdk/omnia-router';
import {
  quiesceChannel,
  proposeSpliceOut,
  acceptSplice,
  finalizeSplice,
} from '@totemsdk/omnia-splice';
import { createPool, mintVtxo, createExitDraft, markExiting, markExited } from '@totemsdk/omnia-vtxo';
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
  now?: () => number;
}

export interface OmniaPoolLivePorts {
  omnia: OmniaExecutionPort;
  factory: FactoryExecutionPort;
  router: RouterExecutionPort;
  splice: SpliceExecutionPort;
  vtxo: VtxoExecutionPort;
}

export function createOmniaPoolLivePorts(deps: OmniaPoolLivePortsDeps): OmniaPoolLivePorts {
  const { signer, leaseProvider, chainProvider } = deps;
  const now = deps.now ?? (() => Date.now());
  const settleOpts = () => (chainProvider ? { signer, chainProvider } : { signer });

  const omnia: OmniaExecutionPort = {
    async createChannel(params) {
      return (await createChannel(params, chainProvider as never)).channel;
    },
    async updateState(channel, delta) {
      return (await updateState(channel, delta, leaseProvider, signer)).signedState as never;
    },
    async addHTLC(channel, params) {
      return (await addHTLC(channel, params, leaseProvider, signer)).channel;
    },
    async fulfillHTLC(channel, htlcId, preimage) {
      const hex = '0x' + Buffer.from(preimage).toString('hex');
      return (await fulfillHTLC(channel, htlcId, hex, leaseProvider, signer)).channel;
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
    reallocate(factoryState, fromPartyId, toPartyId, amount, leaseProviders) {
      return reallocate(factoryState, fromPartyId, toPartyId, amount, leaseProviders);
    },
    openVirtualChannel(factoryState, params) {
      const amounts = Object.fromEntries(Object.entries(params.amounts).map(([k, v]) => [k, BigInt(v)]));
      return openVirtualChannel(factoryState, params.parties, amounts, params.leaseProviders, params.channelId);
    },
    closeVirtualChannel(factoryState, channel, leaseProviders) {
      return closeVirtualChannel(factoryState, channel, leaseProviders);
    },
    closeFactory(factoryState, leaseProviders, cp) {
      return closeFactory(factoryState, leaseProviders, cp ?? chainProvider);
    },
  };

  const router: RouterExecutionPort = {
    createChannelGraph: () => createChannelGraph(),
    addChannel: (graph, edge) => {
      addChannel(graph, edge);
    },
    findRoute: (graph, from, to, amount, tokenId, opts) =>
      findRoute(graph, from, to, amount, tokenId, opts) ?? undefined,
    executeMultiHopPayment: (ops, channels, route, request, leaseProviders) =>
      executeMultiHopPayment(ops, channels, route, request, leaseProviders),
  };

  const splice: SpliceExecutionPort = {
    quiesceChannel: (channel, l) => quiesceChannel(channel, l),
    proposeSpliceOut: (channel, amount, address, l) => proposeSpliceOut(channel, amount, address, l),
    acceptSplice: (channel, proposal, l) => acceptSplice(channel, proposal, l),
    finalizeSplice: (channel, proposal, acceptance, options) => finalizeSplice(channel, proposal, acceptance, options),
  };

  const vtxo: VtxoExecutionPort = {
    createPool: async (params) =>
      createPool(
        {
          operator: params.operator,
          tokenId: params.tokenId,
          totalCapacity: BigInt(params.totalCapacity),
          nonce: params.nonce,
          ...(params.policy !== undefined ? { policy: params.policy as never } : {}),
        },
        now(),
      ),
    mintVtxo: async (pool, params) => {
      const result = mintVtxo(pool, params, now());
      return { pool: result.pool, vtxo: result.vtxo };
    },
    createExitDraft: async (v) => (await createExitDraft(v, now())).draft,
    markExiting: async (v, n) => markExiting(v, n ?? now()),
    markExited: async (v, txpowId, n) => markExited(v, { txpowId, now: n }),
  };

  return { omnia, factory, router, splice, vtxo };
}

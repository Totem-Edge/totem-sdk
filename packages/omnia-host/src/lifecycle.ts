import type { OmniaHostConfig } from './config.js';
import type { OmniaSwarm, ChannelSigner, WotsLeaseProviderLike, MinimalChainProvider } from '@totemsdk/omnia';
import { createOmniaIntegration, createOmniaSwarm } from '@totemsdk/omnia';
import { SqliteChannelStore } from './stores/sqlite-store.js';
import { OperationStore } from './stores/operations.js';
import type { OmniaChannel } from '@totemsdk/omnia';
import { createControlServer, type ControlServer } from './api/jsonrpc.js';
import { createTotemNodeAdapter, type TotemNodeAdapter } from './chain/totem-node-adapter.js';
import { channelGraphEdges, InProcessRoutingProvider, type RoutingProvider } from './router/routing-provider.js';
import type { JsonRpcHandler } from './api/jsonrpc.js';
import { createHostMethods, type OperationStoreLike } from './api/methods.js';
import type { ChannelFactory, FactoryParticipant, WotsLeaseBundle } from '@totemsdk/omnia-factory';
import type { SpliceAcceptance, SpliceLeaseProvider, SpliceProposal } from '@totemsdk/omnia-splice';

export interface OmniaHostDependencies {
  createSwarm?: (config: Parameters<typeof createOmniaSwarm>[0]) => Promise<OmniaSwarm>;
  swarm?: OmniaSwarm;
  channelStore?: Map<string, OmniaChannel>;
  operationStore?: OperationStore | Pick<OperationStore, 'close'>;
  signer?: ChannelSigner;
  leaseProvider?: WotsLeaseProviderLike;
  chainProvider?: MinimalChainProvider;
  controlServer?: ControlServer;
  chainAdapter?: TotemNodeAdapter;
  routingProvider?: RoutingProvider;
  methods?: Map<string, JsonRpcHandler>;
  operationStoreForApi?: OperationStoreLike;
  localParticipant?: import('@totemsdk/omnia').ChannelParticipant;
  factories?: Map<string, ChannelFactory>;
  factoryBundles?: Record<string, WotsLeaseBundle>;
  spliceProposals?: Map<string, SpliceProposal>;
  spliceAcceptances?: Map<string, SpliceAcceptance>;
  spliceLeaseProvider?: SpliceLeaseProvider;
}

export interface OmniaHost {
  readonly config: OmniaHostConfig;
  start(): Promise<void>;
  close(): Promise<void>;
  isStarted(): boolean;
  readonly swarm?: OmniaSwarm;
  readonly channels?: Map<string, OmniaChannel>;
}

/**
 * Phase-1 lifecycle shell. Subsystems will be attached in later phases while
 * preserving idempotent startup and shutdown for the CLI and embedding users.
 */
export function createOmniaHost(
  config: OmniaHostConfig,
  dependencies: OmniaHostDependencies = {},
): OmniaHost {
  let started = false;
  let swarm = dependencies.swarm;
  let unsubscribe: (() => void) | undefined;
  let channelStore: Map<string, OmniaChannel> | undefined = dependencies.channelStore;
  let ownedStore: SqliteChannelStore | undefined;
  let operationStore: OperationStoreLike | undefined = dependencies.operationStore && 'get' in dependencies.operationStore
    ? dependencies.operationStore
    : undefined;
  const injectedOperationStore = dependencies.operationStore;
  let ownedOperationStore: OperationStore | undefined;
  let controlServer: ControlServer | undefined = dependencies.controlServer;
  let chainAdapter: TotemNodeAdapter | undefined = dependencies.chainAdapter;
  let routingProvider = dependencies.routingProvider ?? new InProcessRoutingProvider();

  return {
    config,

    get swarm(): OmniaSwarm | undefined {
      return swarm;
    },
    get channels(): Map<string, OmniaChannel> | undefined {
      return channelStore;
    },

    async start(): Promise<void> {
      if (started) return;
      if (!channelStore) {
        ownedStore = new SqliteChannelStore(config.dbPath);
        channelStore = ownedStore;
      }
      if (!operationStore && !injectedOperationStore) {
        ownedOperationStore = new OperationStore(config.dbPath);
        operationStore = ownedOperationStore;
      }
      if (!swarm) {
        const relay = config.relay
          ? { mode: 'self-hosted' as const, relayUrl: config.relay }
          : { mode: 'native' as const };
        swarm = await (dependencies.createSwarm ?? createOmniaSwarm)({
          localPubkey: config.localPubkey,
          relay,
        });
      }
      if (!chainAdapter) {
        const rpc = new URL(config.chainRpcUrl);
        chainAdapter = createTotemNodeAdapter({
          host: rpc.hostname,
          port: Number(rpc.port || (rpc.protocol === 'https:' ? 443 : 80)),
          password: config.chainRpcPassword,
          ssl: rpc.protocol === 'https:',
        });
      }
      const localParticipant = dependencies.localParticipant ?? (
        config.localPartyId && config.localPubkey && config.localAddressIndex !== undefined
          ? {
              partyId: config.localPartyId,
              publicKeyDigest: config.localPubkey,
              addressIndex: config.localAddressIndex,
              settlementAddress: config.localSettlementAddress,
            }
          : undefined
      );
      unsubscribe = createOmniaIntegration(swarm, channelStore, {
        signer: dependencies.signer,
        leaseProvider: dependencies.leaseProvider,
        chainProvider: dependencies.chainProvider ?? chainAdapter,
      });
      if (!controlServer) {
        controlServer = createControlServer({
          host: config.host,
          port: config.port,
          wsPath: config.wsPath,
          isReady: () => started,
          methods: dependencies.methods ?? createHostMethods({
            channels: channelStore,
            routing: routingProvider,
            operations: dependencies.operationStoreForApi ?? operationStore,
            signer: dependencies.signer,
            leaseProvider: dependencies.leaseProvider,
            chainProvider: dependencies.chainProvider ?? chainAdapter,
            swarm,
            localParticipant,
            factories: dependencies.factories,
            factoryBundles: dependencies.factoryBundles,
            spliceProposals: dependencies.spliceProposals,
            spliceAcceptances: dependencies.spliceAcceptances,
            spliceLeaseProvider: dependencies.spliceLeaseProvider,
            refreshRouting: () => routingProvider.rebuild(channelGraphEdges(channelStore!.values())),
          }),
        });
      }
      try {
        await controlServer.listen();
        started = true;
      } catch (error) {
        unsubscribe?.();
        unsubscribe = undefined;
        chainAdapter?.close();
        await swarm?.close();
        if (ownedOperationStore) await ownedOperationStore.close();
        ownedOperationStore = undefined;
        ownedStore?.close();
        ownedStore = undefined;
        throw error;
      }
    },

    async close(): Promise<void> {
      if (!started) return;
      unsubscribe?.();
      unsubscribe = undefined;
      await controlServer?.close();
      chainAdapter?.close();
      await swarm?.close();
      if (ownedOperationStore) await ownedOperationStore.close();
      else if (injectedOperationStore) await injectedOperationStore.close();
      ownedOperationStore = undefined;
      ownedStore?.close();
      ownedStore = undefined;
      started = false;
    },

    isStarted(): boolean {
      return started;
    },
  };
}

import path from 'node:path';
import type { OmniaHostConfig } from './config.js';
import { ObservationBus } from './observe/bus.js';
import { ObservationEmitter, channelTransitionHash } from './observe/emitter.js';
import { createSqliteObservationStore } from './observe/store.js';
import { createObservationSnapshot } from './observe/snapshot.js';
import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';
import { PersistentMap } from './stores/persistent-map.js';
import type { ObservationStore } from './observe/types.js';
import type { OmniaSwarm, ChannelSigner, WotsLeaseProviderLike, MinimalChainProvider } from '@totemsdk/omnia';
import { createOmniaIntegration, createOmniaSwarm } from '@totemsdk/omnia';
import { SqliteChannelStore } from './stores/sqlite-store.js';
import { OperationStore } from './stores/operations.js';
import type { OmniaChannel } from '@totemsdk/omnia';
import { createControlServer, type ControlServer } from './api/jsonrpc.js';
import { createTotemNodeAdapter, type TotemNodeAdapter } from './chain/totem-node-adapter.js';
import { channelGraphEdges, InProcessRoutingProvider, type RoutingProvider } from './router/routing-provider.js';
import type { ChannelGraphEdge } from '@totemsdk/omnia-router';
import type { JsonRpcHandler } from './api/jsonrpc.js';
import {
  createHyperswarmHubNetwork,
  createWebSocketHubServer,
  type HubNetwork,
  type WebSocketHubServer,
} from '@totemsdk/p2p-hub';
import { createHostMethods, type OperationStoreLike } from './api/methods.js';
import { ReplyCache } from './reply-cache.js';
import {
  acceptFactory,
  signFactorySettlement,
  signVirtualChannelOpen,
  signVirtualChannelClose,
} from '@totemsdk/omnia-factory';
import { acceptSplice, quiesceChannel } from '@totemsdk/omnia-splice';
import type { ChannelFactory, FactoryParticipant, WotsLeaseBundle } from '@totemsdk/omnia-factory';
import type { SpliceAcceptance, SpliceLeaseProvider, SpliceProposal } from '@totemsdk/omnia-splice';

export interface OmniaHostDependencies {
  createSwarm?: (config: Parameters<typeof createOmniaSwarm>[0]) => Promise<OmniaSwarm>;
  swarm?: OmniaSwarm;
  channelStore?: Map<string, OmniaChannel>;
  operationStore?: OperationStore | Pick<OperationStore, 'close'>;
  signer?: ChannelSigner;
  leaseProvider?: WotsLeaseProviderLike;
  /** RFC-058 signer port; defaults to a local signer in CLI deployments. */
  signerPort?: import('@totemsdk/omnia').SignerPort;
  chainProvider?: MinimalChainProvider;
  controlServer?: ControlServer;
  chainAdapter?: TotemNodeAdapter;
  routingProvider?: RoutingProvider;
  methods?: Map<string, JsonRpcHandler>;
  operationStoreForApi?: OperationStoreLike;
  localParticipant?: import('@totemsdk/omnia').ChannelParticipant;
  /** Stable ed25519 native transport keypair (derived from the host seed). */
  transportKeyPair?: { publicKey: Uint8Array; secretKey: Uint8Array };
  /** `0x`-prefixed transport public key published in the signed manifest. */
  transportPubkey?: string;
  factories?: Map<string, ChannelFactory>;
  factoryBundles?: Record<string, WotsLeaseBundle>;
  spliceProposals?: Map<string, SpliceProposal>;
  spliceAcceptances?: Map<string, SpliceAcceptance>;
  spliceLeaseProvider?: SpliceLeaseProvider;
  /** Opt-in host identity surface (whoami). */
  identity?: {
    address: string;
    publicKeyDigest: string;
    identityId?: string;
    delegation?: unknown;
  };
  /** Boot-time signed EdgeServiceManifest (getManifest). */
  manifest?: unknown;
  /** Optional P2P hub network (tests/embedding). */
  p2pHubNetwork?: HubNetwork;
  /** Observation feed: inject a store/bus (tests/embedding) or disable it. */
  observationStore?: ObservationStore;
  observationBus?: ObservationBus;
  /** Synchronous storage adapter for durable factories/splices/VTXOs/pools. */
  hostStateStore?: SyncSqliteStore;
  observe?: boolean;
  networkId?: string;
  sourceNodeId?: string;
}

export interface OmniaHost {
  readonly config: OmniaHostConfig;
  start(): Promise<void>;
  close(): Promise<void>;
  isStarted(): boolean;
  readonly swarm?: OmniaSwarm;
  readonly channels?: Map<string, OmniaChannel>;
  /** Loopback WebSocket endpoint for local dapps, when enabled (RFC-062). */
  readonly p2pHubUrl?: string;
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
  let observationStore: ObservationStore | undefined = dependencies.observationStore;
  let ownedObservationStore: ObservationStore | undefined;
  let hostStateStore: SyncSqliteStore | undefined = dependencies.hostStateStore;
  let ownedHostStateStore: SyncSqliteStore | undefined;
  const observationBus = dependencies.observationBus ?? new ObservationBus();
  let observation: ObservationEmitter | undefined;
  let controlServer: ControlServer | undefined = dependencies.controlServer;
  let chainAdapter: TotemNodeAdapter | undefined = dependencies.chainAdapter;
  let routingProvider = dependencies.routingProvider ?? new InProcessRoutingProvider();
  let p2pHubServer: WebSocketHubServer | undefined;
  let p2pHubUrl: string | undefined;

  return {
    config,

    get swarm(): OmniaSwarm | undefined {
      return swarm;
    },
    get channels(): Map<string, OmniaChannel> | undefined {
      return channelStore;
    },
    get p2pHubUrl(): string | undefined {
      return p2pHubUrl;
    },

    async start(): Promise<void> {
      if (started) return;
      if (!channelStore) {
        ownedStore = new SqliteChannelStore(config.dbPath);
        channelStore = ownedStore;
      }
      // CAN-002: recovered channels must carry the local signer so the router can
      // identify the counterparty (otherwise multi-hop payments loop back).
      if (channelStore instanceof SqliteChannelStore) {
        channelStore.setLocalSigner(dependencies.signer);
      }
      if (!operationStore && !injectedOperationStore) {
        ownedOperationStore = new OperationStore(config.dbPath);
        operationStore = ownedOperationStore;
      }
      const observeEnabled = dependencies.observe === true || (dependencies.observe !== false && config.observeDisabled !== true && config.observeDbPath !== undefined);
      if (observeEnabled && !observationStore) {
        const observePath = config.observeDbPath ?? path.join(path.dirname(config.dbPath), 'observe.sqlite');
        try {
          ownedObservationStore = await createSqliteObservationStore(observePath);
          observationStore = ownedObservationStore;
        } catch (err) {
          console.error('[omnia-host] observation store disabled:', err instanceof Error ? err.message : String(err));
        }
      }
      if (observationStore) {
        observation = new ObservationEmitter({
          store: observationStore,
          bus: observationBus,
          networkId: config.networkId ?? dependencies.networkId ?? 'omnia',
          sourceNodeId: config.sourceNodeId ?? dependencies.sourceNodeId ?? config.localPartyId ?? 'omnia-host',
        });
      }
      if (!hostStateStore) {
        try {
          ownedHostStateStore = new SyncSqliteStore(config.dbPath);
          hostStateStore = ownedHostStateStore;
        } catch (err) {
          console.error('[omnia-host] host-state store disabled:', err instanceof Error ? err.message : String(err));
        }
      }
      const hostMap = <V>(namespace: string, injected?: Map<string, V>): Map<string, V> =>
        injected ?? (hostStateStore ? new PersistentMap<V>(hostStateStore, namespace) : new Map<string, V>());
      if (!swarm) {
        const relay = config.relay
          ? { mode: 'self-hosted' as const, relayUrl: config.relay }
          : { mode: 'native' as const };
        const dhtBootstrap = (process.env.OMNIA_DHT_BOOTSTRAP ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        // Serverless native mode: bind/announce an explicit local interface so
        // peers can reach us directly (multi-homed hosts, netns, VPN, etc.).
        const dhtHost = process.env.OMNIA_DHT_HOST?.trim() || undefined;
        const dhtPort = process.env.OMNIA_DHT_PORT
          ? Number(process.env.OMNIA_DHT_PORT)
          : undefined;
        swarm = await (dependencies.createSwarm ?? createOmniaSwarm)({
          localPubkey: config.localPubkey,
          relay,
          ...(dhtBootstrap.length ? { bootstrap: dhtBootstrap } : {}),
          ...(dependencies.transportKeyPair ? { keyPair: dependencies.transportKeyPair } : {}),
          ...(dhtHost ? { host: dhtHost } : {}),
          ...(dhtPort ? { port: dhtPort } : {}),
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
      if (config.genesisHash) {
        const adapter = chainAdapter as { getGenesisHash?: () => Promise<string | undefined> };
        const observed = await adapter.getGenesisHash?.();
        if (!observed) {
          throw new Error(
            `OMNIA_GENESIS_HASH is set but the chain provider does not expose a genesis hash; refusing to start`,
          );
        }
        if (observed.toLowerCase() !== config.genesisHash.toLowerCase()) {
          throw new Error(
            `Chain genesis mismatch: expected ${config.genesisHash}, node reports ${observed}`,
          );
        }
      }
      if (config.p2pHubUrl) {
        // Shared-hub client mode: another process owns the hub. The host only
        // advertises the URL; it must not start a competing local hub.
        p2pHubUrl = config.p2pHubUrl;
      } else if (config.p2pHubPort !== undefined || dependencies.p2pHubNetwork) {
        const native = (swarm as { nativeSwarm?: () => unknown }).nativeSwarm?.();
        const network = dependencies.p2pHubNetwork ?? await createHyperswarmHubNetwork(
          native ? { swarm: native } : {},
        );
        p2pHubServer = await createWebSocketHubServer({
          network,
          host: config.p2pHubHost ?? '127.0.0.1',
          port: config.p2pHubPort ?? 0,
          ...(config.p2pHubToken ? { token: config.p2pHubToken } : {}),
          ...(config.p2pHubOrigins ? { allowedOrigins: config.p2pHubOrigins } : {}),
          ...(config.p2pHubTopics ? { allowedTopicPrefixes: config.p2pHubTopics } : {}),
        });
        const address = await p2pHubServer.listen();
        const host = address.host.includes(':') ? `[${address.host}]` : address.host;
        p2pHubUrl = `ws://${host}:${address.port}`;
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
      // Factory managers default to this node's own lease bundle so the local
      // side can propose/sign without extra wiring. A two-host factory still
      // needs peer coordination (FACTORY_PROPOSAL/ACCEPT).
      const factoryBundles = dependencies.factoryBundles ?? (
        localParticipant && dependencies.signer && dependencies.leaseProvider
          ? {
              [localParticipant.partyId]: {
                signer: dependencies.signer,
                leaseProvider: dependencies.leaseProvider,
              } as WotsLeaseBundle,
            }
          : undefined
      );
      const factories = dependencies.factories ?? (
        factoryBundles ? hostMap<ChannelFactory>('omnia:factory:') : undefined
      );

      const localBundle = localParticipant
        ? factoryBundles?.[localParticipant.partyId]
        : undefined;

      const spliceLeaseProvider = dependencies.spliceLeaseProvider ?? (
        dependencies.signer && dependencies.leaseProvider
          ? {
              signer: dependencies.signer,
              wotsLease: dependencies.leaseProvider,
              ...(chainAdapter
                ? { broadcast: (txHex: string) => chainAdapter!.broadcastTxPoW(txHex) }
                : {}),
            }
          : undefined
      );
      const spliceProposals = hostMap<SpliceProposal>('omnia:splice:proposal:', dependencies.spliceProposals);
      const spliceAcceptances = hostMap<SpliceAcceptance>('omnia:splice:acceptance:', dependencies.spliceAcceptances);

      const onSpliceMessage = async (peer: any, msg: any): Promise<void> => {
        if (!spliceLeaseProvider || !channelStore) return;
        if (msg?.type !== 'SPLICE_PROPOSAL' && msg?.type !== 'SPLICE_FINALIZED') return;
        const payload = (msg.payload ?? {}) as Record<string, any>;
        try {
          if (msg.type === 'SPLICE_PROPOSAL' && payload.proposal) {
            const proposal = payload.proposal as SpliceProposal;
            let channel = channelStore.get(proposal.channelId) as
              | import('@totemsdk/omnia-splice').QuiescedChannel
              | import('@totemsdk/omnia').OmniaChannel
              | undefined;
            if (!channel) throw new Error(`Splice channel ${proposal.channelId} not found`);
            const prior = spliceAcceptances.get(proposal.spliceId);
            if (prior) {
              await peer.sendMessage({
                type: 'SPLICE_ACCEPT',
                channelId: msg.channelId,
                nonce: msg.nonce,
                payload: { acceptance: prior },
              });
              return;
            }
            if (channel.status === 'active') {
              channel = await quiesceChannel(channel, spliceLeaseProvider);
              channelStore.set(channel.channelId, channel as unknown as OmniaChannel);
            }
            const acceptance = await acceptSplice(channel, proposal, spliceLeaseProvider);
            spliceAcceptances.set(proposal.spliceId, acceptance);
            await peer.sendMessage({
              type: 'SPLICE_ACCEPT',
              channelId: msg.channelId,
              nonce: msg.nonce,
              payload: { acceptance },
            });
            return;
          }
          if (msg.type === 'SPLICE_FINALIZED' && payload.channel) {
            const channel = payload.channel as OmniaChannel;
            channelStore.set(channel.channelId, channel);
            void observation?.emit({
              domain: 'splice', kind: 'splice.finalized', phase: 'confirmed',
              entity: { type: 'channel', id: channel.channelId },
              amounts: { capacity: channel.totalValue?.toString(), balances: Object.fromEntries(Object.entries(channel.balances ?? {}).map(([k, v]) => [k, v.toString()])) },
              data: { spliceId: (payload as any).spliceId, txId: (payload as any).txId },
            });
            const acceptance = spliceAcceptances.get(payload.spliceId);
            if (acceptance && typeof payload.txId === 'string') {
              await spliceLeaseProvider.wotsLease
                .commitKeyUse(acceptance.acceptorReservationId, payload.txId)
                .catch(() => {});
            }
          }
        } catch (err) {
          await peer.sendMessage({
            type: 'ERROR',
            channelId: msg.channelId,
            nonce: msg.nonce,
            payload: { error: err instanceof Error ? err.message : String(err) },
          }).catch(() => {});
        }
      };

      const factoryReplies = new ReplyCache();
      const vcReplies = new ReplyCache();

      const onFactoryMessage = async (peer: any, msg: any): Promise<void> => {
        if (!factories || !localBundle) return;
        if (
          msg?.type !== 'FACTORY_PROPOSAL' &&
          msg?.type !== 'FACTORY_FUNDING_REQUEST' &&
          msg?.type !== 'FACTORY_CLOSE_PROPOSAL' &&
          msg?.type !== 'FACTORY_CLOSE_FINALIZED'
        ) return;
        const payload = (msg?.payload ?? {}) as Record<string, any>;
        if (process.env.OMNIA_DEBUG) {
          console.error('[factory] recv', msg.type, 'hasFactory', !!payload.factory, 'bundles', !!localBundle);
        }
        const key = factoryReplies.key(msg.type, msg.channelId, msg.nonce);
        const reply = await factoryReplies.run(key, async () => {
          try {
            if (msg.type === 'FACTORY_FUNDING_REQUEST' && typeof payload.digest === 'string') {
              const digest = Uint8Array.from(Buffer.from(payload.digest.replace(/^0x/i, ''), 'hex'));
              const reservation = await localBundle.leaseProvider.reserveKeyUse({
                treeId: 'factory-funding',
                purpose: 'factory-funding',
                payloadHash: payload.digest,
              });
              try {
                const signature = await localBundle.signer.sign(digest, reservation.indices);
                await localBundle.leaseProvider.commitKeyUse(reservation.reservationId, 'factory-funding');
                return {
                  type: 'FACTORY_FUNDING_RESPONSE',
                  channelId: msg.channelId,
                  nonce: msg.nonce,
                  payload: { signature: '0x' + Buffer.from(signature).toString('hex') },
                };
              } catch (err) {
                await localBundle.leaseProvider.burnReservation(reservation.reservationId, 'factory-funding-failed').catch(() => {});
                throw err;
              }
            }
            if (msg.type === 'FACTORY_PROPOSAL' && payload.factory) {
              const accepted = await acceptFactory(payload.factory, localBundle);
              factories.set(accepted.factoryId, accepted);
              void observation?.emit({
                domain: 'factory', kind: 'factory.accepted', phase: 'accepted',
                entity: { type: 'factory', id: accepted.factoryId },
                data: { participants: accepted.participants },
              });
              return {
                type: 'FACTORY_ACCEPT',
                channelId: accepted.factoryId,
                nonce: msg.nonce,
                payload: { factory: accepted },
              };
            }
            if (msg.type === 'FACTORY_CLOSE_PROPOSAL' && payload.factoryId) {
              const factory = factories.get(payload.factoryId);
              if (!factory) throw new Error(`Factory ${payload.factoryId} not found`);
              const signature = await signFactorySettlement(factory, payload.draft, localBundle);
              await localBundle.leaseProvider
                .commitKeyUse(signature.reservationId, `factory-settlement-${payload.factoryId}`)
                .catch(() => {});
              return {
                type: 'FACTORY_CLOSE_ACCEPT',
                channelId: payload.factoryId,
                nonce: msg.nonce,
                payload: { signature },
              };
            }
            if (msg.type === 'FACTORY_CLOSE_FINALIZED' && payload.factoryId) {
              const factory = factories.get(payload.factoryId);
              if (factory) factories.set(payload.factoryId, { ...factory, status: 'closed' });
              return null;
            }
            return null;
          } catch (e) {
            if (process.env.OMNIA_DEBUG) console.error('[factory] err', String(e));
            return {
              type: 'ERROR',
              channelId: msg.channelId,
              nonce: msg.nonce,
              payload: { error: String(e) },
            };
          }
        });
        if (reply) await peer.sendMessage(reply);
      };

      const channelPeers = new Map<string, any>();
      const importedRouteEdges = new Map<string, ChannelGraphEdge[]>();
      const routeEdgeWire = (edge: ChannelGraphEdge) => ({
        channelId: edge.channelId,
        from: edge.from,
        to: edge.to,
        tokenId: edge.tokenId,
        availableBalance: edge.availableBalance.toString(),
        htlcCapacity: edge.htlcCapacity.toString(),
        feeRate: edge.feeRate.toString(),
      });
      const localRouteEdges = (): ChannelGraphEdge[] => channelGraphEdges(channelStore?.values() ?? []);
      const rebuildRoutes = (): void => {
        const local = localRouteEdges();
        const localIds = new Set(local.map((edge) => edge.channelId));
        const remote = [...importedRouteEdges.values()]
          .flat()
          .filter((edge) => !localIds.has(edge.channelId));
        routingProvider.rebuild([...local, ...remote]);
      };
      const announceRoutesTo = (peer: any): void => {
        if (!peer?.sendMessage) return;
        const edges = localRouteEdges().map(routeEdgeWire);
        if (edges.length === 0) return;
        void peer.sendMessage({
          type: 'ROUTE_GRAPH_ANNOUNCE',
          channelId: 'route-graph',
          nonce: Date.now(),
          payload: { source: config.localPartyId ?? config.sourceNodeId ?? 'omnia-host', hop: 0, edges },
        }).catch(() => undefined);
      };
      const onPeerMessage = (peer: any, msg: any): void => {
        if (msg?.channelId) channelPeers.set(msg.channelId, peer);
        if (msg?.type === 'ROUTE_GRAPH_REQUEST') {
          announceRoutesTo(peer);
          return;
        }
        if (msg?.type === 'ROUTE_GRAPH_ANNOUNCE') {
          const payload = msg.payload as { edges?: unknown[]; hop?: number } | undefined;
          if (!payload || !Array.isArray(payload.edges) || (payload.hop ?? 0) > 2) return;
          for (const raw of payload.edges) {
            if (!raw || typeof raw !== 'object') continue;
            const edge = raw as Record<string, unknown>;
            if (typeof edge.channelId !== 'string' || typeof edge.from !== 'string' || typeof edge.to !== 'string' || typeof edge.tokenId !== 'string') continue;
            const parsed: ChannelGraphEdge = {
              channelId: edge.channelId, from: edge.from, to: edge.to, tokenId: edge.tokenId,
              availableBalance: BigInt(String(edge.availableBalance ?? '0')),
              htlcCapacity: BigInt(String(edge.htlcCapacity ?? '0')),
              feeRate: BigInt(String(edge.feeRate ?? '0')),
            };
            const current = importedRouteEdges.get(parsed.channelId) ?? [];
            const next = current.filter((item) => item.from !== parsed.from);
            next.push(parsed);
            importedRouteEdges.set(parsed.channelId, next);
          }
          rebuildRoutes();
          // Gossip one hop to other connected peers; edges are advisory only.
          const forwarded = (payload.hop ?? 0) + 1;
          if (forwarded <= 2) {
            for (const other of new Set(channelPeers.values())) {
              if (other === peer) continue;
              void other.sendMessage?.({ type: 'ROUTE_GRAPH_ANNOUNCE', channelId: 'route-graph', nonce: Date.now(), payload: { ...payload, hop: forwarded } }).catch?.(() => undefined);
            }
          }
          return;
        }
        void observation?.emit({
          domain: 'transport', kind: 'transport.message', phase: 'observed',
          entity: { type: 'node', id: config.sourceNodeId ?? config.localPartyId ?? 'omnia-host' },
          evidence: { peerPublicKeyDigest: peer?.publicKeyDigest },
          data: { type: msg?.type, channelId: msg?.channelId, nonce: msg?.nonce },
        });
      };
      const onChannelAccepted = (channel: any, peer: any): void => {
        rebuildRoutes();
        announceRoutesTo(peer);
        void observation?.emit({
          domain: 'channel', kind: 'channel.proposal.accepted', phase: 'accepted',
          entity: { type: 'channel', id: channel.channelId },
          parties: { local: localParticipant?.partyId, remote: channel.parties?.find((p: any) => p.partyId !== localParticipant?.partyId)?.partyId },
          token: { tokenId: channel.tokenId, scale: channel.tokenScale ?? 0 },
          amounts: { capacity: channel.totalValue?.toString(), balances: Object.fromEntries(Object.entries(channel.balances ?? {}).map(([k, v]: [string, any]) => [k, v.toString()])) },
          transitionHash: channelTransitionHash(channel),
          evidence: { peerPublicKeyDigest: peer?.publicKeyDigest },
        });
      };
      const onStateUpdated = (channel: any, peer: any): void => {
        rebuildRoutes();
        announceRoutesTo(peer);
        void observation?.emit({
          domain: 'channel', kind: 'channel.updated', phase: 'committed',
          entity: { type: 'channel', id: channel.channelId },
          parties: { local: localParticipant?.partyId, remote: channel.parties?.find((p: any) => p.partyId !== localParticipant?.partyId)?.partyId },
          token: { tokenId: channel.tokenId, scale: channel.tokenScale ?? 0 },
          after: { sequence: channel.currentSequence, balances: Object.fromEntries(Object.entries(channel.balances ?? {}).map(([k, v]: [string, any]) => [k, v.toString()])) },
          transitionHash: channelTransitionHash(channel),
          evidence: { peerPublicKeyDigest: peer?.publicKeyDigest },
        });
      };
      const onSettlementProposed = (payload: any, peer: any): void => {
        void observation?.emit({
          domain: 'settlement', kind: 'settlement.proposed', phase: 'proposed',
          entity: { type: 'channel', id: payload?.channelId ?? 'unknown' },
          evidence: { peerPublicKeyDigest: peer?.publicKeyDigest },
          data: { payload },
        });
      };
      const onVcMessage = async (peer: any, msg: any): Promise<void> => {
        if (!factories || !localBundle) return;
        const payload = (msg?.payload ?? {}) as Record<string, any>;
        if (msg?.type === 'VC_FINALIZED') {
          if (payload.factory) factories.set(payload.factory.factoryId, payload.factory);
          if (payload.kind === 'vc-open' && payload.channel) {
            channelStore?.set(payload.channel.channelId, payload.channel);
            void observation?.emit({
              domain: 'factory', kind: 'factory.vc_opened', phase: 'accepted',
              entity: { type: 'channel', id: payload.channel.channelId },
              data: { factoryId: payload.factory?.factoryId },
            });
          } else if (payload.kind === 'vc-close' && payload.channelId) {
            channelStore?.delete(payload.channelId);
            void observation?.emit({
              domain: 'factory', kind: 'factory.vc_closed', phase: 'closed',
              entity: { type: 'channel', id: payload.channelId },
              data: { factoryId: payload.factory?.factoryId },
            });
          }
          return;
        }
        if (msg?.type !== 'VC_PROPOSAL') return;
        const key = vcReplies.key(msg.type, msg.channelId, msg.nonce, payload.kind);
        const reply = await vcReplies.run(key, async () => {
          try {
            const factory = factories.get(payload.factoryId);
            if (!factory) throw new Error(`Factory ${payload.factoryId} not found`);
            if (payload.kind === 'vc-open') {
              const signature = await signVirtualChannelOpen(factory, payload.plan, localBundle);
              await localBundle.leaseProvider.commitKeyUse(
                signature.reservationId,
                `factory-vc-open-${payload.factoryId}`,
              );
              return {
                type: 'VC_ACCEPT',
                channelId: payload.vcId,
                nonce: msg.nonce,
                payload: { kind: 'vc-open', signature },
              };
            }
            if (payload.kind === 'vc-close') {
              const signature = await signVirtualChannelClose(factory, payload.plan, localBundle);
              await localBundle.leaseProvider.commitKeyUse(
                signature.reservationId,
                `factory-vc-close-${payload.factoryId}`,
              );
              return {
                type: 'VC_ACCEPT',
                channelId: payload.vcId,
                nonce: msg.nonce,
                payload: { kind: 'vc-close', signature },
              };
            }
            return null;
          } catch (e) {
            return {
              type: 'ERROR',
              channelId: msg.channelId,
              nonce: msg.nonce,
              payload: { error: String(e) },
            };
          }
        });
        if (reply) await peer.sendMessage(reply);
      };

      unsubscribe = createOmniaIntegration(swarm, channelStore, {
        signer: dependencies.signer,
        leaseProvider: dependencies.leaseProvider,
        chainProvider: dependencies.chainProvider ?? chainAdapter,
        onFactoryMessage,
        onVcMessage,
        onSpliceMessage,
        onPeerMessage,
        onChannelAccepted,
        onStateUpdated,
        onSettlementProposed,
      });
      const preparedPay = new Map();
      const preparedSettle = new Map();
      const preparedOpen = new Map();
      const preparedSplice = new Map();
      const preparedFactory = new Map();
      const vtxoPools = hostMap<any>('omnia:vtxo:pool:');
      const vtxos = hostMap<any>('omnia:vtxo:');
      const vtxoReceipts = hostMap<any>('omnia:vtxo:receipt:');
      const preparedVtxoReceipts = new Map();
      const pools = hostMap<any>('omnia:pool:');
      const poolPositions = hostMap<any>('omnia:pool:position:');

      if (!controlServer) {
        const readOnly = !dependencies.signer || !dependencies.leaseProvider;
        if (readOnly) {
          console.log('[omnia-host] no signing material; starting READ-ONLY');
        }
        controlServer = createControlServer({
          host: config.host,
          port: config.port,
          wsPath: config.wsPath,
          isReady: () => started,
          allowedOrigins: config.allowedOrigins,
          authToken: config.controlToken,
          observe: observationStore ? {
            store: observationStore,
            bus: observationBus,
            snapshot: async () => createObservationSnapshot({
              networkId: config.networkId ?? dependencies.networkId ?? 'omnia',
              sourceNodeId: config.sourceNodeId ?? dependencies.sourceNodeId ?? config.localPartyId ?? 'omnia-host',
              streamId: `${config.sourceNodeId ?? dependencies.sourceNodeId ?? config.localPartyId ?? 'omnia-host'}:${config.networkId ?? dependencies.networkId ?? 'omnia'}`,
              cursor: await observationStore!.head(),
              channels: channelStore?.values(),
              factories: factories?.values(),
              vtxoPools: vtxoPools.values(),
              vtxos: vtxos.values(),
              pools: pools.values(),
              operations: (dependencies.operationStoreForApi ?? operationStore) as unknown as { listByStatus?: (status: string) => unknown[] } | undefined,
            }),
          } : undefined,
          methods: dependencies.methods ?? createHostMethods({
            channels: channelStore,
            routing: routingProvider,
            operations: dependencies.operationStoreForApi ?? operationStore,
            observe: observation,
            signer: dependencies.signer,
            leaseProvider: dependencies.leaseProvider,
            chainProvider: dependencies.chainProvider ?? chainAdapter,
            fundingAddress: config.fundingAddress,
            swarm,
            channelPeers,
            localParticipant,
            transportPubkey: dependencies.transportPubkey,
            factories,
            factoryBundles,
            spliceProposals,
            spliceAcceptances,
            spliceLeaseProvider,
            custodyMode: config.custodyMode ?? 'self',
            signerPort: dependencies.signerPort,
            preparedPay,
            preparedSettle,
            preparedOpen,
            preparedSplice,
            preparedFactory,
            vtxoPools,
            vtxos,
            vtxoReceipts,
            preparedVtxoReceipts,
            pools,
            poolPositions,
            coordinator: !dependencies.signer && !config.readOnly,
            fundingSigner: config.fundingPubkey
              ? async (digest: Uint8Array) => {
                  const sig = await chainAdapter!.signData(
                    config.fundingPubkey!,
                    '0x' + Buffer.from(digest).toString('hex'),
                  );
                  return Uint8Array.from(Buffer.from(sig.replace(/^0x/i, ''), 'hex'));
                }
              : undefined,
            readOnly,
            identity: dependencies.identity,
            manifest: dependencies.manifest,
            p2pHubUrl,
            refreshRouting: () => rebuildRoutes(),
          }),
        });
      }
      try {
        await controlServer.listen();
        started = true;
      } catch (error) {
        unsubscribe?.();
        unsubscribe = undefined;
        await p2pHubServer?.close();
        p2pHubServer = undefined;
        p2pHubUrl = undefined;
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
      await p2pHubServer?.close();
      p2pHubServer = undefined;
      p2pHubUrl = undefined;
      await controlServer?.close();
      chainAdapter?.close();
      await swarm?.close();
      if (ownedOperationStore) await ownedOperationStore.close();
      else if (injectedOperationStore) await injectedOperationStore.close();
      ownedOperationStore = undefined;
      if (ownedObservationStore) await ownedObservationStore.close();
      ownedObservationStore = undefined;
      ownedHostStateStore?.close();
      ownedHostStateStore = undefined;
      ownedStore?.close();
      ownedStore = undefined;
      started = false;
    },

    isStarted(): boolean {
      return started;
    },
  };
}

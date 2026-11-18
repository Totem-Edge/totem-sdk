import path from 'node:path';
import type { OmniaHostConfig } from './config.js';
import { ObservationBus } from './observe/bus.js';
import { ObservationEmitter, channelTransitionHash } from './observe/emitter.js';
import { createSqliteObservationStore } from './observe/store.js';
import { createObservationSnapshot } from './observe/snapshot.js';
import { atomsToAmount, coinAmountAtoms } from '@totemsdk/core';
import { createUpdateChecker } from '@totemsdk/manifest';
import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';
import { PersistentMap } from './stores/persistent-map.js';
import type { ObservationStore } from './observe/types.js';
import type { SpliceExpectation } from './peer-guards.js';
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
  assertFactoryFinalized,
  buildFactoryOpening,
  buildFactorySettlement,
  signFactorySettlement,
  signVirtualChannelOpen,
  signVirtualChannelClose,
} from '@totemsdk/omnia-factory';
import { acceptSplice, quiesceChannel } from '@totemsdk/omnia-splice';
import type { ChannelFactory, FactoryFundingMaterial, FactoryParticipant, WotsLeaseBundle } from '@totemsdk/omnia-factory';
import type { SpliceAcceptance, SpliceLeaseProvider, SpliceProposal } from '@totemsdk/omnia-splice';
import { channelLockKey, withChannelLock } from './channel-lock.js';
import { createFactoryAuthorizer, type FactoryAuthorizer } from './factory-approval.js';
import { createChannelWatchService, type ChannelWatchService } from './watch.js';
import {
  assertFactoryCloseSettlement,
  assertFactoryCommitment,
  assertFactorySettlementDraft,
  assertOffChainFactoryCommitment,
  assertSpliceFinalized,
  assertVcFinalized,
  resolveFactoryFundingTarget,
  type PendingVcAcceptance,
} from './peer-guards.js';

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
  /** Authorization gate for peer-initiated factory signing (deny by default). */
  factoryAuthorization?: FactoryAuthorizer;
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
  const authorizeFactory: FactoryAuthorizer =
    dependencies.factoryAuthorization ?? createFactoryAuthorizer(config.factoryApproval ?? {});
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
  let watchService: ChannelWatchService | undefined;
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
      let updateChecker: ReturnType<typeof createUpdateChecker> | undefined;
      if (config.updateCheckUrl) {
        updateChecker = createUpdateChecker({
          url: config.updateCheckUrl,
          installed: config.updateCheckPackages,
          intervalMs: config.updateCheckIntervalMs,
          onResult: (result) => {
            const updates = result.updates
              .map((u) => `${u.name} ${u.installed}->${u.recommended ?? u.newest}`)
              .join(', ');
            const advisories = result.advisories.map((a) => `${a.id}(${a.severity})`).join(', ');
            console.log(
              `[omnia-host] updates available: ${updates || 'none'}` +
                (advisories ? `; advisories: ${advisories}` : ''),
            );
            void observation?.emit({
              domain: 'node',
              kind: 'update.available',
              phase: 'observed',
              entity: { type: 'node', id: config.localPartyId ?? 'omnia-host' },
              data: {
                updates: result.updates,
                advisories: result.advisories,
                unknownInstalled: result.unknownInstalled,
              },
            });
          },
          onError: (err) => {
            console.warn('[omnia-host] update check failed:', err instanceof Error ? err.message : String(err));
          },
        });
        updateChecker.start();
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
      /** VC proposals this host co-signed, awaiting VC_FINALIZED (CAN-007). */
      const vcAcceptances = new Map<string, PendingVcAcceptance>();
      /** CAN-019: totals/split this host signed for an outstanding splice. */
      const spliceExpectations = new Map<string, SpliceExpectation>();
      /** Funding digests this host already signed, so a retry cannot burn leaves (CAN-010). */
      const factoryFundingSignatures = new Map<string, string>();

      const onSpliceMessage = (peer: any, msg: any): Promise<void> => withChannelLock(channelLockKey(msg), async () => {
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
            spliceExpectations.set(proposal.spliceId, {
              channelId: proposal.channelId,
              totalValue: proposal.params.newTotalValue,
              balances: proposal.params.newBalances,
            });
            await peer.sendMessage({
              type: 'SPLICE_ACCEPT',
              channelId: msg.channelId,
              nonce: msg.nonce,
              payload: { acceptance },
            });
            return;
          }
          if (msg.type === 'SPLICE_FINALIZED') {
            // CAN-007: a finalized splice is a claim, not a fact. It must match
            // the acceptance this host produced for that spliceId before any of
            // it reaches the channel store.
            const spliceId = String((payload as any).spliceId ?? '');
            if (!spliceExpectations.has(spliceId)) {
              const proposal = spliceProposals.get(spliceId);
              if (proposal) {
                spliceExpectations.set(spliceId, {
                  channelId: proposal.channelId,
                  totalValue: proposal.params.newTotalValue,
                  balances: proposal.params.newBalances,
                });
              }
            }
            const { acceptance, channel } = assertSpliceFinalized(
              spliceAcceptances,
              payload,
              spliceExpectations,
            );
            channelStore.set(channel.channelId, channel);
            void observation?.emit({
              domain: 'splice', kind: 'splice.finalized', phase: 'confirmed',
              entity: { type: 'channel', id: channel.channelId },
              amounts: { capacity: channel.totalValue !== undefined ? atomsToAmount(channel.totalValue) : undefined, balances: Object.fromEntries(Object.entries(channel.balances ?? {}).map(([k, v]) => [k, atomsToAmount(v)])) },
              data: { spliceId: (payload as any).spliceId, txId: (payload as any).txId },
            });
            if (typeof payload.txId === 'string') {
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
      });

      const factoryReplies = new ReplyCache();
      const vcReplies = new ReplyCache();

      const onFactoryMessage = (peer: any, msg: any): Promise<void> => withChannelLock(channelLockKey(msg), async () => {
        if (!factories || !localBundle) return;
        if (
          msg?.type !== 'FACTORY_PROPOSAL' &&
          msg?.type !== 'FACTORY_FUNDING_REQUEST' &&
          msg?.type !== 'FACTORY_CLOSE_PROPOSAL' &&
          msg?.type !== 'FACTORY_CLOSE_FINALIZED' &&
          msg?.type !== 'FACTORY_FINALIZED'
        ) return;
        const payload = (msg?.payload ?? {}) as Record<string, any>;
        if (process.env.OMNIA_DEBUG) {
          console.error('[factory] recv', msg.type, 'hasFactory', !!payload.factory, 'bundles', !!localBundle);
        }
        const key = factoryReplies.key(msg.type, msg.channelId, msg.nonce);
        const reply = await factoryReplies.run(key, async () => {
          try {
            if (msg.type === 'FACTORY_FUNDING_REQUEST' && typeof payload.digest === 'string') {
              // CAN-010: sign only the digest this host derived for a factory it
              // already accepted, and only when the peer is a participant of it.
              resolveFactoryFundingTarget(factories, payload.digest, peer?.pubkey);
              const requested = payload.digest.replace(/^0x/i, '').toLowerCase();
              const alreadySigned = factoryFundingSignatures.get(requested);
              if (alreadySigned) {
                // A retry gets the same signature; it must not burn a second leaf.
                return {
                  type: 'FACTORY_FUNDING_RESPONSE',
                  channelId: msg.channelId,
                  nonce: msg.nonce,
                  payload: { signature: alreadySigned },
                };
              }
              const digest = Uint8Array.from(Buffer.from(requested, 'hex'));
              const reservation = await localBundle.leaseProvider.reserveKeyUse({
                treeId: 'factory-funding',
                purpose: 'factory-funding',
                payloadHash: requested,
              });
              try {
                const signature = await localBundle.signer.sign(digest, reservation.indices);
                await localBundle.leaseProvider.commitKeyUse(reservation.reservationId, 'factory-funding');
                const signed = '0x' + Buffer.from(signature).toString('hex');
                factoryFundingSignatures.set(requested, signed);
                return {
                  type: 'FACTORY_FUNDING_RESPONSE',
                  channelId: msg.channelId,
                  nonce: msg.nonce,
                  payload: { signature: signed },
                };
              } catch (err) {
                await localBundle.leaseProvider.burnReservation(reservation.reservationId, 'factory-funding-failed').catch(() => {});
                throw err;
              }
            }
            if (msg.type === 'FACTORY_PROPOSAL' && payload.factory) {
              const proposal = payload.factory as ChannelFactory;
              // CAN-018: never sign a commitment the peer chose. On-chain
              // proposals are rebuilt from their funding materials; off-chain
              // proposals are bound by their state commitment and have no
              // funding materials to present.
              const onChain = payload.onChain === true || Array.isArray(payload.fundingMaterials);
              if (onChain) {
                const materials = Array.isArray(payload.fundingMaterials)
                  ? payload.fundingMaterials as FactoryFundingMaterial[]
                  : undefined;
                if (!materials) {
                  throw new Error('on-chain factory proposal carries no funding materials to verify it');
                }
                const rebuilt = await buildFactoryOpening(
                  proposal.participants,
                  proposal.tokenId,
                  proposal.tokenScale ?? 0,
                  chainAdapter,
                  materials,
                );
                assertFactoryCommitment(proposal.pendingCommitment, rebuilt.factory.pendingCommitment);
              } else {
                assertOffChainFactoryCommitment(proposal);
              }
              await authorizeFactory({
                kind: 'open',
                factoryId: proposal.factoryId,
                peerPublicKeyDigest: String(peer?.pubkey ?? ''),
                participants: proposal.participants.length,
                totalValue: proposal.totalValue.toString(),
                tokenId: proposal.tokenId,
                tokenScale: proposal.tokenScale ?? 0,
                digest: proposal.pendingCommitment ?? '',
                summary: `Open factory ${proposal.factoryId} with ${proposal.participants.length} participants`,
              });
              const accepted = await acceptFactory(proposal, localBundle, { deferCommit: true });
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
              // Never sign a peer-supplied draft: rebuild it from the local
              // factory and only sign the canonical digest this host derived.
              const expectedDraft = buildFactorySettlement(factory);
              assertFactorySettlementDraft(expectedDraft, (payload.draft ?? {}) as {
                settlementDraft?: unknown;
                settlementTxHex?: unknown;
                txDigest?: unknown;
              });
              await authorizeFactory({
                kind: 'close',
                factoryId: factory.factoryId,
                peerPublicKeyDigest: String(peer?.pubkey ?? ''),
                participants: factory.participants.length,
                totalValue: factory.totalValue.toString(),
                tokenId: factory.tokenId,
                tokenScale: factory.tokenScale ?? 0,
                digest: '0x' + Buffer.from(expectedDraft.txDigest).toString('hex'),
                summary: `Close factory ${factory.factoryId}`,
              });
              const signature = await signFactorySettlement(factory, expectedDraft, localBundle);
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
            if (msg.type === 'FACTORY_FINALIZED' && payload.factory) {
              // CAN-020: the proposal is sent before funding is signed, so the
              // responder learns the funding txid from this follow-up. Only a
              // factory we already accepted may be updated.
              const finalized = payload.factory as ChannelFactory;
              const known = factories.get(finalized.factoryId);
              if (!known) {
                throw new Error(`FACTORY_FINALIZED for factory ${finalized.factoryId} which this host has not accepted`);
              }
              // A known factory ID is not authority to replace its state: only
              // funding references and additional valid signatures may change.
              const validated = assertFactoryFinalized(known, finalized, peer?.pubkey);
              factories.set(validated.factoryId, validated);
              return null;
            }
            if (msg.type === 'FACTORY_CLOSE_FINALIZED' && payload.factoryId) {
              const factory = factories.get(payload.factoryId);
              if (factory) {
                assertFactoryCloseSettlement(factory, payload);
                factories.set(payload.factoryId, { ...factory, status: 'closed' });
              }
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
      });

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
          amounts: { capacity: channel.totalValue !== undefined ? atomsToAmount(channel.totalValue) : undefined, balances: Object.fromEntries(Object.entries(channel.balances ?? {}).map(([k, v]: [string, any]) => [k, atomsToAmount(v)])) },
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
      const onVcMessage = (peer: any, msg: any): Promise<void> => withChannelLock(channelLockKey(msg), async () => {
        if (!factories || !localBundle) return;
        const payload = (msg?.payload ?? {}) as Record<string, any>;
        if (msg?.type === 'VC_FINALIZED') {
          try {
            // CAN-007: require the VC proposal this host co-signed, the same
            // factory, and a single-sequence successor of the local copy.
            const acceptance = assertVcFinalized({
              acceptances: vcAcceptances,
              factories,
              hasChannel: (id) => Boolean(channelStore?.get(id)),
              payload: payload as {
                kind?: unknown;
                factory?: ChannelFactory;
                channel?: OmniaChannel;
                channelId?: unknown;
              },
            });
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
            vcAcceptances.delete(
              payload.kind === 'vc-open'
                ? String(payload.channel?.channelId ?? '')
                : String(payload.channelId ?? ''),
            );
            void acceptance;
          } catch (err) {
            await peer.sendMessage({
              type: 'ERROR',
              channelId: msg.channelId,
              nonce: msg.nonce,
              payload: { error: err instanceof Error ? err.message : String(err) },
            }).catch(() => {});
          }
          return;
        }
        if (msg?.type !== 'VC_PROPOSAL') return;
        const key = vcReplies.key(msg.type, msg.channelId, msg.nonce, payload.kind);
        const reply = await vcReplies.run(key, async () => {
          try {
            const factory = factories.get(payload.factoryId);
            if (!factory) throw new Error(`Factory ${payload.factoryId} not found`);
            if (typeof payload.vcId !== 'string' || payload.vcId.length === 0) {
              throw new Error('VC_PROPOSAL without a vcId');
            }
            if (payload.kind === 'vc-open') {
              const signature = await signVirtualChannelOpen(factory, payload.plan, localBundle);
              await localBundle.leaseProvider.commitKeyUse(
                signature.reservationId,
                `factory-vc-open-${payload.factoryId}`,
              );
              // CAN-007: remember what we agreed to, so VC_FINALIZED can be
              // checked against it instead of being trusted outright.
              const plan = payload.plan as { amounts?: Record<string, bigint>; newAllocations?: Record<string, bigint> };
              const amounts = plan.amounts ?? {};
              vcAcceptances.set(payload.vcId, {
                kind: 'vc-open',
                factoryId: payload.factoryId,
                localPartyId: signature.partyId,
                expected: {
                  balances: amounts,
                  totalValue: Object.values(amounts).reduce((sum, value) => sum + value, 0n),
                  factoryAllocations: plan.newAllocations,
                },
              });
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
              const plan = payload.plan as { finalAllocations?: Record<string, bigint>; newAllocations?: Record<string, bigint> };
              vcAcceptances.set(payload.vcId, {
                kind: 'vc-close',
                factoryId: payload.factoryId,
                localPartyId: signature.partyId,
                expected: {
                  finalAllocations: plan.finalAllocations,
                  factoryAllocations: plan.newAllocations,
                },
              });
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
      });

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
      // CAN-014: a timelock is not a monitor. Watch the live channel coin so a
      // unilateral close and an expiring HTLC are observed, and treat a spent
      // coin with a successor as an update/splice rather than a close.
      try {
        watchService = createChannelWatchService({
          channels: channelStore as unknown as Map<string, OmniaChannel>,
          chain: {
            getTip: async () => ({ block: Number((await chainAdapter!.getTip()).block) }),
            getCoin: async (coinId) => {
              const coin = await chainAdapter!.getCoin(coinId);
              return coin ? { spent: coin.spent, created: coin.created } : null;
            },
            getSuccessor: async (channel) => {
              const coins = await chainAdapter!.getCoins({
                address: channel.fundingAddress,
                tokenId: channel.tokenId,
              });
              const successor = coins.find(
                (coin) => !coin.spent && coinAmountAtoms(coin) === channel.totalValue,
              );
              return successor ? { coinId: successor.coinid } : null;
            },
          },
          ...(hostStateStore
            ? {
                // Bridge the synchronous host store to the async StorageAdapter
                // the watch service expects.
                storage: {
                  get: async <T>(key: string) => hostStateStore!.get<T>(key),
                  set: async <T>(key: string, value: T) => { hostStateStore!.set(key, value); },
                  remove: async (key: string) => hostStateStore!.remove(key),
                  clear: async () => { hostStateStore!.clear(); },
                  keys: async () => hostStateStore!.keys(),
                  has: async (key: string) => hostStateStore!.has(key),
                },
              }
            : {}),
          onUnilateralClose: async (channel, finding) => {
            void observation?.emit({
              domain: 'channel', kind: 'channel.unilateral_close', phase: 'observed',
              entity: { type: 'channel', id: channel.channelId },
              data: { detail: finding.detail },
            });
          },
          onHtlcExpiring: async (channel, htlc, finding) => {
            void observation?.emit({
              domain: 'channel', kind: 'channel.htlc_expiring', phase: 'observed',
              entity: { type: 'channel', id: channel.channelId },
              data: { htlcId: htlc.htlcId, blocksRemaining: finding.blocksRemaining },
            });
          },
        });
      } catch (err) {
        console.error('[omnia-host] watch service disabled:', err instanceof Error ? err.message : String(err));
        watchService = undefined;
      }

      try {
        await controlServer.listen();
        started = true;
        watchService?.start(30_000);
      } catch (error) {
        unsubscribe?.();
        unsubscribe = undefined;
        updateChecker?.stop();
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
      watchService?.stop();
      watchService = undefined;
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

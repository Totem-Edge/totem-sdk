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
      // CAN-002: recovered channels must carry the local signer so the router can
      // identify the counterparty (otherwise multi-hop payments loop back).
      if (channelStore instanceof SqliteChannelStore) {
        channelStore.setLocalSigner(dependencies.signer);
      }
      if (!operationStore && !injectedOperationStore) {
        ownedOperationStore = new OperationStore(config.dbPath);
        operationStore = ownedOperationStore;
      }
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
        factoryBundles ? new Map<string, ChannelFactory>() : undefined
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
      const spliceProposals = dependencies.spliceProposals ?? new Map<string, SpliceProposal>();
      const spliceAcceptances = dependencies.spliceAcceptances ?? new Map<string, SpliceAcceptance>();

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

      const onVcMessage = async (peer: any, msg: any): Promise<void> => {
        if (!factories || !localBundle) return;
        const payload = (msg?.payload ?? {}) as Record<string, any>;
        if (msg?.type === 'VC_FINALIZED') {
          if (payload.factory) factories.set(payload.factory.factoryId, payload.factory);
          if (payload.kind === 'vc-open' && payload.channel) {
            channelStore?.set(payload.channel.channelId, payload.channel);
          } else if (payload.kind === 'vc-close' && payload.channelId) {
            channelStore?.delete(payload.channelId);
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
      });
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
          methods: dependencies.methods ?? createHostMethods({
            channels: channelStore,
            routing: routingProvider,
            operations: dependencies.operationStoreForApi ?? operationStore,
            signer: dependencies.signer,
            leaseProvider: dependencies.leaseProvider,
            chainProvider: dependencies.chainProvider ?? chainAdapter,
            swarm,
            localParticipant,
            transportPubkey: dependencies.transportPubkey,
            factories,
            factoryBundles,
            spliceProposals,
            spliceAcceptances,
            spliceLeaseProvider,
            custodyMode: config.custodyMode ?? 'self',
            signerPort: dependencies.signerPort,
            preparedPay: new Map(),
            preparedSettle: new Map(),
            preparedOpen: new Map(),
            preparedSplice: new Map(),
            preparedFactory: new Map(),
            vtxoPools: new Map(),
            vtxos: new Map(),
            vtxoReceipts: new Map(),
            preparedVtxoReceipts: new Map(),
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

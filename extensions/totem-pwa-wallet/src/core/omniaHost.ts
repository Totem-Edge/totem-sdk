/**
 * PWA Omnia coordination host (RFC-035 B5).
 *
 * A long-lived host for peer coordination in the PWA wallet app: on unlock it
 * opens the relay swarm, loads durable channel/factory registries, composes
 * `createWalletCoordination`, and binds inbound peers. Torn down on lock.
 *
 * Gated to self-hosted WOTS lease mode (the signing material builder returns
 * `null` in Axia mode), matching the extension.
 *
 * The approval gate is fail-closed until a per-operation approval UI exists:
 * auto-accepting a peer's proposal would make the wallet emit a WOTS signature it
 * never consented to.
 */

import { IdbStore } from '@totemsdk/storage/idb';
import {
  createOmniaRelayClient,
  createWalletCoordination,
  createStorageCoordinationStore,
  type WalletCoordination,
  type ChannelFactory,
  type OmniaChannel,
  type RelayOmniaClient,
} from '@totemsdk/omnia-relay';
import type { QuiescedChannel } from '@totemsdk/omnia-relay';
import { buildPwaOmniaSigningMaterial } from './omnia';
import { WalletManager } from './WalletManager';

interface OmniaHost {
  client: RelayOmniaClient;
  coordination: WalletCoordination;
  unsub: () => void;
}

let host: OmniaHost | undefined;
let starting: Promise<void> | undefined;

const channelRegistry = new Map<string, OmniaChannel | QuiescedChannel>();
const factoryRegistry = new Map<string, ChannelFactory>();

function channelStore(): IdbStore {
  return new IdbStore({ databaseName: 'totem-pwa-omnia', storeName: 'channels' });
}
function factoryStore(): IdbStore {
  return new IdbStore({ databaseName: 'totem-pwa-omnia', storeName: 'factories' });
}

async function loadRegistries(): Promise<void> {
  const channels = channelStore();
  for (const key of await channels.keys()) {
    const channel = await channels.get<OmniaChannel>(key);
    if (channel?.channelId) channelRegistry.set(channel.channelId, channel);
  }
  const factories = factoryStore();
  for (const key of await factories.keys()) {
    const factory = await factories.get<ChannelFactory>(key);
    if (factory?.factoryId) factoryRegistry.set(factory.factoryId, factory);
  }
}

/** The live channel/factory registries, for callers that open channels. */
export function omniaHostChannels(): Map<string, OmniaChannel | QuiescedChannel> {
  return channelRegistry;
}
export function omniaHostFactories(): Map<string, ChannelFactory> {
  return factoryRegistry;
}

/** Upsert a channel into the durable registry. */
export async function persistOmniaHostChannel(channel: OmniaChannel): Promise<void> {
  channelRegistry.set(channel.channelId, channel);
  await channelStore().set(channel.channelId, channel);
}

export async function startPwaOmniaHost(): Promise<void> {
  if (host) return;
  if (starting) return starting;
  starting = (async () => {
    if (!WalletManager.isUnlocked()) return;
    const material = await buildPwaOmniaSigningMaterial();
    if (!material) return; // Axia lease mode or locked — no coordination
    await loadRegistries();

    const client = createOmniaRelayClient({
      autoAccept: false,
      signer: material.signer,
      leaseProvider: material.leaseProvider,
      chainProvider: material.chainProvider,
      localParticipant: material.participant,
    });
    const store = createStorageCoordinationStore(
      new IdbStore({ databaseName: 'totem-pwa-omnia-coord', storeName: 'kv' }),
    );
    const coordination = createWalletCoordination({
      channels: channelRegistry,
      factories: factoryRegistry,
      signer: material.signer,
      leaseProvider: material.leaseProvider,
      store,
      chainProvider: material.chainProvider,
      policy: { autoAccept: false },
      approval: async () => {
        console.warn('[omnia] coordination approval not wired — rejecting');
        return false;
      },
      onFactoryOpened: async (factory) => {
        factoryRegistry.set(factory.factoryId, factory);
        await factoryStore().set(factory.factoryId, factory);
      },
    });
    const unsub = client.swarm.listenForChannels((peer) => coordination.bindPeer(peer));
    host = { client, coordination, unsub };
  })().finally(() => {
    starting = undefined;
  });
  return starting;
}

export function stopPwaOmniaHost(): void {
  if (!host) return;
  try {
    host.unsub();
    void host.client.close().catch(() => {});
  } catch {
    /* ignore teardown errors */
  }
  host = undefined;
}

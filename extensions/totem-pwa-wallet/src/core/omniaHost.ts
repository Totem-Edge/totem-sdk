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
  createApprovalQueue,
  createWalletCoordination,
  createWalletForwarding,
  createDurableHtlcLinkJournal,
  createStorageCoordinationStore,
  type WalletCoordination,
  type WalletApprovalRequest,
  type ChannelFactory,
  type OmniaChannel,
  type RelayOmniaClient,
  type WalletForwarding,
} from '@totemsdk/omnia-relay';
import type { QuiescedChannel } from '@totemsdk/omnia-relay';
import { buildPwaOmniaSigningMaterial } from './omnia';
import { WalletManager } from './WalletManager';
import { setPwaOmniaPort } from './connect/walletRuntime';

// ── Consent UI bridge (RFC-035 B5) ────────────────────────────────────────────
// The host runs outside React; the modal subscribes here.

type ApprovalListener = () => void;
const approvalListeners = new Set<ApprovalListener>();
// Serialised and fail-closed: a second proposal queues behind the first instead
// of overwriting it (which used to leave the first handler waiting forever),
// and an unanswered request expires rather than signing later.
const approvalQueue = createApprovalQueue<WalletApprovalRequest>({
  timeoutMs: 5 * 60_000,
  onChange: () => approvalListeners.forEach((l) => l()),
});

export function subscribeOmniaApproval(listener: ApprovalListener): () => void {
  approvalListeners.add(listener);
  return () => approvalListeners.delete(listener);
}
export function getPendingOmniaApproval(): WalletApprovalRequest | null {
  return approvalQueue.pending();
}
export function resolveOmniaApproval(approved: boolean): void {
  approvalQueue.resolve(approved);
}
function requestOmniaApproval(req: WalletApprovalRequest): Promise<boolean> {
  return approvalQueue.enqueue(req);
}

interface OmniaHost {
  client: RelayOmniaClient;
  coordination: WalletCoordination;
  forwarding: WalletForwarding;
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
      approval: (req) => requestOmniaApproval(req),
      onFactoryOpened: async (factory) => {
        factoryRegistry.set(factory.factoryId, factory);
        await factoryStore().set(factory.factoryId, factory);
      },
    });
    // RFC-035 B4: an intermediary on a multi-hop route receives a STATE_UPDATE
    // carrying `payload.forward`. Bind the forwarder to the same peer stream and
    // reconcile any link journaled before the last shutdown.
    const forwarding = createWalletForwarding({
      channels: channelRegistry as unknown as Map<string, OmniaChannel>,
      signer: material.signer,
      leaseProvider: material.leaseProvider,
      chainProvider: material.chainProvider,
      swarm: client.swarm,
      linkJournal: createDurableHtlcLinkJournal(
        new IdbStore({ databaseName: 'totem-pwa-omnia-forward', storeName: 'links' }),
      ),
      onError: (info) => {
        console.warn('[omnia] forwarding refused:', info.reason, info.channelId, info.hashlock ?? '');
      },
    });
    void forwarding.forwarder.recover().catch((error: unknown) => {
      console.warn('[omnia] forwarding recovery failed:', error);
    });

    const unsub = client.swarm.listenForChannels((peer) => {
      coordination.bindPeer(peer);
      forwarding.bindPeer(peer);
    });
    host = { client, coordination, forwarding, unsub };
    // The live client is the capability truth: the claim flips on only when
    // signing material exists (RFC-035 B5), and back off on lock.
    setPwaOmniaPort(client);
  })().finally(() => {
    starting = undefined;
  });
  return starting;
}

export function stopPwaOmniaHost(): void {
  if (!host) return;
  try {
    host.unsub();
    host.forwarding.close();
    void host.client.close().catch(() => {});
  } catch {
    /* ignore teardown errors */
  }
  host = undefined;
  setPwaOmniaPort(undefined);
  // Lock/teardown denies anything the user had not answered.
  approvalQueue.cancelAll();
}

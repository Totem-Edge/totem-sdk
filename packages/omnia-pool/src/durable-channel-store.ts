/**
 * Durable channel snapshot store (RFC-007 G6).
 *
 * A storage-backed `ChannelSnapshotStore` for Omnia pool orchestration:
 * serialized `OmniaChannel` snapshots are persisted per channel id under a
 * namespaced key prefix, so a pool process can save → close → reopen and
 * `loadChannelFromSnapshotStore`/`createChannelLoader` recover the same state.
 * Last-writer-wins per channel (matching the port contract); durability level
 * is asserted up-front so a volatile adapter is never silently downgraded.
 */

import type {
  StorageAdapterWithCapabilities,
  WriteAckMode,
} from '@totemsdk/storage/types';
import { assertCapabilities } from '@totemsdk/storage/types';
import type { ChannelSnapshotStore } from './load-channel.js';

const DEFAULT_NAMESPACE = 'totem_omnia_pool:v1:';

export interface DurableChannelSnapshotStore extends ChannelSnapshotStore {
  set(channelId: string, snapshot: string): Promise<void>;
  /** Channel ids that currently have a persisted snapshot. */
  keys(): Promise<string[]>;
  has(channelId: string): Promise<boolean>;
  remove(channelId: string): Promise<boolean>;
}

export interface DurableChannelSnapshotStoreOptions {
  /** Key namespace prefix; default `totem_omnia_pool:v1:`. */
  readonly namespace?: string;
  /**
   * Required write acknowledgment; default `durably-acknowledged`. Pass
   * `volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
   */
  readonly requireAckMode?: WriteAckMode;
}

export function createDurableChannelSnapshotStore(
  adapter: StorageAdapterWithCapabilities,
  options: DurableChannelSnapshotStoreOptions = {},
): DurableChannelSnapshotStore {
  assertCapabilities(adapter, {
    acknowledge: options.requireAckMode ?? 'durably-acknowledged',
  });
  const prefix = options.namespace ?? DEFAULT_NAMESPACE;

  const store: DurableChannelSnapshotStore = {
    async get(channelId: string): Promise<string | undefined> {
      const snapshot = await adapter.get<string | null>(`${prefix}${channelId}`);
      return snapshot ?? undefined;
    },

    async set(channelId: string, snapshot: string): Promise<void> {
      await adapter.set(`${prefix}${channelId}`, snapshot);
    },

    async keys(): Promise<string[]> {
      const all = (await adapter.keys()) as string[];
      return all
        .filter((key: string) => key.startsWith(prefix))
        .map((key: string) => key.slice(prefix.length))
        .sort();
    },

    async has(channelId: string): Promise<boolean> {
      return adapter.has(`${prefix}${channelId}`);
    },

    async remove(channelId: string): Promise<boolean> {
      return adapter.remove(`${prefix}${channelId}`);
    },
  };

  return store;
}

export type { ChannelSnapshotStore };
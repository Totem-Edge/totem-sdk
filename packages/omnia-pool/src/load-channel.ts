/**
 * omnia-pool/load-channel.ts — Materialize live Omnia channels from their id.
 *
 * Pool positions carry `omniaChannelId` in their underlying refs (deposit.ts).
 * Instead of requiring callers to inject the live channel object, the SDK
 * materializes it from a stored snapshot via `recoverChannel` /
 * `deserializeChannelSnapshot` from `@totemsdk/omnia`.
 */

import { deserializeChannelSnapshot, recoverChannel, serializeChannelSnapshot } from '@totemsdk/omnia';
import type { OmniaChannel } from '@totemsdk/omnia';

/** Minimal keyed snapshot store for channel persistence. */
export interface ChannelSnapshotStore {
  get(channelId: string): Promise<string | undefined> | string | undefined;
  set?(channelId: string, snapshot: string): Promise<void> | void;
}

/**
 * Build a `loadChannel(channelId)` port that reads a persisted channel snapshot
 * and recovers the live `OmniaChannel` object.
 */
export function createChannelLoader(store: ChannelSnapshotStore): (channelId: string) => Promise<OmniaChannel> {
  return async (channelId) => {
    const snapshot = await store.get(channelId);
    if (!snapshot) {
      throw new Error(`no channel snapshot found for ${channelId}`);
    }
    return recoverChannel(deserializeChannelSnapshot(snapshot));
  };
}

/** Load a channel from a snapshot store by id (see `createChannelLoader`). */
export async function loadChannelFromSnapshotStore(store: ChannelSnapshotStore, channelId: string): Promise<OmniaChannel> {
  const snapshot = await store.get(channelId);
  if (!snapshot) {
    throw new Error(`no channel snapshot found for ${channelId}`);
  }
  return recoverChannel(deserializeChannelSnapshot(snapshot));
}

/** Persist a channel's snapshot so it can be recovered later by id. */
export async function saveChannelSnapshot(store: ChannelSnapshotStore, channel: OmniaChannel): Promise<void> {
  if (typeof store.set !== 'function') return;
  await store.set(channel.channelId, serializeChannelSnapshot(channel));
}
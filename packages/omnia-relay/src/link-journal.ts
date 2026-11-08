/**
 * Durable HTLC link journal (RFC-035 B4 / RFC-078).
 *
 * The forwarder must persist the association between an incoming HTLC and the
 * outgoing HTLC it creates *before* sending the outgoing state update. If the
 * process dies after the outgoing lock is signed, a restart can still find the
 * link, reveal the preimage backwards and release liquidity.
 */

import type { StorageAdapter } from '@totemsdk/core';
import type { HtlcLink, HtlcLinkJournal } from './forwarder.js';

const PREFIX = 'omnia_relay:htlc_link:';
const INDEX_KEY = 'omnia_relay:htlc_link_index';

function keyFor(hashlock: string): string {
  return `${PREFIX}${hashlock.toLowerCase()}`;
}

export interface DurableHtlcLinkJournal extends HtlcLinkJournal {
  /** Every link still awaiting a backwards settlement (for restart recovery). */
  list(): Promise<HtlcLink[]>;
}

/**
 * Storage-backed link journal. `storage` may be any `StorageAdapter`
 * (in-memory, JSON file, SQLite) so the host can share its durable store.
 */
export function createDurableHtlcLinkJournal(storage: StorageAdapter): DurableHtlcLinkJournal {
  const readIndex = async (): Promise<string[]> => {
    const stored = await storage.get<string[]>(INDEX_KEY);
    return Array.isArray(stored) ? stored : [];
  };

  return {
    async get(hashlock: string): Promise<HtlcLink | undefined> {
      const link = await storage.get<HtlcLink>(keyFor(hashlock));
      return link ?? undefined;
    },

    async record(link: HtlcLink): Promise<void> {
      const hashlock = link.hashlock?.toLowerCase();
      if (!hashlock) {
        throw new Error('cannot journal an HTLC link without a hashlock');
      }
      // The link itself is the source of truth; the index is a recovery hint.
      await storage.set(keyFor(hashlock), { ...link, hashlock });
      const index = await readIndex();
      if (!index.includes(hashlock)) {
        index.push(hashlock);
        await storage.set(INDEX_KEY, index);
      }
    },

    async getByIncoming(params: {
      inChannelId: string;
      inHtlcId: string;
    }): Promise<HtlcLink | undefined> {
      const index = await readIndex();
      const links = await Promise.all(index.map((id) => storage.get<HtlcLink>(keyFor(id))));
      return links.find((link): link is HtlcLink =>
        Boolean(link)
        && link!.inChannelId === params.inChannelId
        && link!.inHtlcId === params.inHtlcId,
      ) ?? undefined;
    },

    async remove(hashlock: string): Promise<void> {
      const normalized = hashlock.toLowerCase();
      await storage.remove(keyFor(normalized));
      const index = await readIndex();
      const next = index.filter((id) => id !== normalized);
      if (next.length !== index.length) await storage.set(INDEX_KEY, next);
    },

    async list(): Promise<HtlcLink[]> {
      // Skip dangling index entries (a link removed concurrently).
      const index = await readIndex();
      const links = await Promise.all(index.map((id) => storage.get<HtlcLink>(keyFor(id))));
      return links.filter((link): link is HtlcLink => Boolean(link));
    },
  };
}

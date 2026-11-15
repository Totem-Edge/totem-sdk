/**
 * Durable HTLC link journal (RFC-035 B4 / RFC-078).
 *
 * The forwarder must persist the association between an incoming HTLC and the
 * outgoing HTLC it creates *before* sending the outgoing state update. If the
 * process dies after the outgoing lock is signed, a restart can still find the
 * link, reveal the preimage backwards and release liquidity.
 *
 * CAN-016: the previous layout wrote the link and the index as two independent
 * storage operations. A crash or a concurrent forward could leave the index
 * without its link (invisible to recovery) or lose an index update entirely.
 * The journal is now a single document written in one `set`, with mutations
 * serialized in-process, so the record and its index cannot disagree.
 */

import type { StorageAdapter } from '@totemsdk/core';
import type { HtlcLink, HtlcLinkJournal } from './forwarder.js';

const JOURNAL_KEY = 'omnia_relay:htlc_links_v2';

// Legacy two-write layout, read once for migration.
const LEGACY_PREFIX = 'omnia_relay:htlc_link:';
const LEGACY_INDEX_KEY = 'omnia_relay:htlc_link_index';

function legacyKeyFor(hashlock: string): string {
  return `${LEGACY_PREFIX}${hashlock.toLowerCase()}`;
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
  // Serializes read-modify-write cycles within this process. Cross-process
  // concurrency needs a storage-level transaction; this closes the realistic
  // single-relay case and is matched by the idempotency check below.
  let tail: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };

  const readAll = async (): Promise<HtlcLink[]> => {
    const stored = await storage.get<HtlcLink[]>(JOURNAL_KEY);
    if (Array.isArray(stored)) return stored;

    // Lazy migration: rebuild the document from the old index + records.
    const index = (await storage.get<string[]>(LEGACY_INDEX_KEY)) ?? [];
    const legacy = (await Promise.all(index.map((id) => storage.get<HtlcLink>(legacyKeyFor(id)))))
      .filter((link): link is HtlcLink => Boolean(link));
    if (legacy.length > 0) await storage.set(JOURNAL_KEY, legacy);
    return legacy;
  };

  const writeAll = async (links: HtlcLink[]): Promise<void> => {
    await storage.set(JOURNAL_KEY, links);
  };

  const sameHashlock = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

  return {
    get(hashlock: string): Promise<HtlcLink | undefined> {
      return serialized(async () => {
        const all = await readAll();
        return all.find((link) => sameHashlock(link.hashlock, hashlock));
      });
    },

    record(link: HtlcLink): Promise<void> {
      return serialized(async () => {
        const hashlock = link.hashlock?.toLowerCase();
        if (!hashlock) {
          throw new Error('cannot journal an HTLC link without a hashlock');
        }
        const all = await readAll();
        // Upsert: the hashlock is the idempotency key, so a retried forward
        // replaces its intent instead of creating a second outgoing obligation.
        const next = all.filter((existing) => !sameHashlock(existing.hashlock, hashlock));
        next.push({ ...link, hashlock });
        await writeAll(next);
      });
    },

    getByIncoming(params: {
      inChannelId: string;
      inHtlcId: string;
    }): Promise<HtlcLink | undefined> {
      return serialized(async () => {
        const all = await readAll();
        return all.find((link) =>
          link.inChannelId === params.inChannelId && link.inHtlcId === params.inHtlcId);
      });
    },

    remove(hashlock: string): Promise<void> {
      return serialized(async () => {
        const all = await readAll();
        await writeAll(all.filter((link) => !sameHashlock(link.hashlock, hashlock)));
      });
    },

    list(): Promise<HtlcLink[]> {
      return serialized(readAll);
    },
  };
}

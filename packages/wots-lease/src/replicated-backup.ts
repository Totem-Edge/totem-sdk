/**
 * RFC-057 — replicated WOTS lease-journal backup.
 *
 * The local `LeaseJournal` remains authoritative for allocation. This adapter
 * mirrors the physically append-only journal into a replicated log for audit
 * and disaster recovery, and restores entries into a local journal in order.
 * It never allocates or advances a signing slot.
 */

import type { ReplicatedLog } from '@totemsdk/replication';
import { StorageError } from '@totemsdk/storage/errors';
import type { JournalEntry } from './types.js';

export interface LeaseJournalRestoreTarget {
  append(entry: JournalEntry): Promise<void>;
}

export class ReplicatedLeaseJournalBackup {
  constructor(private readonly log: ReplicatedLog<JournalEntry>) {}

  /** Mirror one local journal entry. */
  async append(entry: JournalEntry): Promise<{ length: number; head: string }> {
    return this.log.append(entry);
  }

  /** Read all mirrored entries, verifying the local hash-chain links in order. */
  async readAll(): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = [];
    for await (const entry of this.log.readSince()) entries.push(entry.record);
    let previous: JournalEntry | undefined;
    for (const [index, entry] of entries.entries()) {
      if (index === 0) {
        if (entry.previousHash !== undefined) {
          throw new StorageError('replicated lease journal first entry has previousHash', 'corrupt');
        }
      } else if (entry.previousHash !== previous?.hash) {
        throw new StorageError(`replicated lease journal chain mismatch at ${index}`, 'corrupt');
      }
      previous = entry;
    }
    return entries;
  }

  /**
   * Restore into a local journal. The local journal's own duplicate-slot and
   * reservation checks remain the final guard; this method only preserves the
   * replicated order and links.
   */
  async restoreInto(target: LeaseJournalRestoreTarget): Promise<number> {
    const entries = await this.readAll();
    for (const entry of entries) await target.append(entry);
    return entries.length;
  }
}

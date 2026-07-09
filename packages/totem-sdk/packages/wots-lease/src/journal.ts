/**
 * LeaseJournal — append-only audit log for WOTS key-use events.
 * Preserves the full history: reserved → committed | burned | reserved-expired.
 */

import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger } from '@totemsdk/core';
import type { JournalEntry } from './types.js';

const STORAGE_KEY = 'totem_wots_journal';

export class LeaseJournal {
  private entries: JournalEntry[] = [];
  private _initialized = false;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly logger: LoggerAdapter = new NoopLogger(),
  ) {}

  async initialize(): Promise<void> {
    if (this._initialized) return;
    const stored = await this.storage.get<JournalEntry[]>(STORAGE_KEY);
    this.entries = stored ?? [];
    this._initialized = true;
  }

  async append(entry: JournalEntry): Promise<void> {
    this.entries.push(entry);
    await this.storage.set(STORAGE_KEY, this.entries);
    this.logger.debug(`[LeaseJournal] ${entry.status} treeId=${entry.treeId} idx=${entry.wotsIndex} txId=${entry.txId ?? '-'}`);
  }

  getAll(): JournalEntry[] {
    return [...this.entries];
  }

  getByTree(treeId: string): JournalEntry[] {
    return this.entries.filter((e) => e.treeId === treeId);
  }

  getByReservation(reservationId: string): JournalEntry | undefined {
    return [...this.entries].reverse().find(
      (e) => (e as JournalEntry & { reservationId?: string }).reservationId === reservationId,
    );
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.storage.remove(STORAGE_KEY);
  }
}

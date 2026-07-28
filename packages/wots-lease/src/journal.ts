/**
 * LeaseJournal — append-only audit log for WOTS key-use events.
 * Preserves the full history: reserved → committed | burned | reserved-expired.
 */

import { createHash } from 'crypto';
import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger } from '@totemsdk/core';
import type { JournalEntry } from './types.js';

const STORAGE_KEY = 'totem_wots_journal';

function hashEntry(entry: JournalEntry): string {
  const encoder = new TextEncoder();
  const data = {
    t: entry.treeId,
    b: entry.branchId,
    i: entry.wotsIndex,
    s: entry.status,
    r: entry.reservationId,
    p: entry.previousHash,
    ts: entry.timestamp,
    d: entry.deviceId,
  };
  const bytes = encoder.encode(JSON.stringify(data));
  return createHash('sha256').update(bytes).digest('hex');
}

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
    if (this.entries.length > 0) {
      const ok = this._verifyChain();
      if (!ok) {
        this.logger.error('[LeaseJournal] hash chain integrity check FAILED — journal may be tampered');
        throw new Error('Journal hash chain integrity check failed');
      }
    }
    this._initialized = true;
  }

  async append(entry: JournalEntry): Promise<void> {
    const prev = this.entries[this.entries.length - 1];
    entry.previousHash = prev?.hash;
    entry.hash = hashEntry(entry);
    this.entries.push(entry);
    await this.storage.set(STORAGE_KEY, this.entries);
    this.logger.debug(`[LeaseJournal] ${entry.status} treeId=${entry.treeId} idx=${entry.wotsIndex} txId=${entry.txId ?? '-'} hash=${entry.hash!.slice(0, 8)}`);
  }

  private _verifyChain(): boolean {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const expectedHash = hashEntry(e);
      if (e.hash !== expectedHash) {
        this.logger.error(`[LeaseJournal] hash mismatch at entry ${i}: expected ${expectedHash}, stored ${e.hash}`);
        return false;
      }
      if (i > 0) {
        const prevHash = this.entries[i - 1].hash;
        if (e.previousHash !== prevHash) {
          this.logger.error(`[LeaseJournal] previousHash mismatch at entry ${i}: expected ${prevHash}, stored ${e.previousHash}`);
          return false;
        }
      }
    }
    return true;
  }

  getAll(): JournalEntry[] {
    return [...this.entries];
  }

  getByTree(treeId: string): JournalEntry[] {
    return this.entries.filter((e) => e.treeId === treeId);
  }

  getByReservation(reservationId: string): JournalEntry | undefined {
    return [...this.entries].reverse().find((e) => e.reservationId === reservationId);
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.storage.remove(STORAGE_KEY);
  }
}

/**
 * @module @totemsdk/storage/memory
 *
 * In-memory `StorageAdapter` — conformance and development surface only. Write
 * acknowledgment is `volatile` by definition.
 */

import { StorageError } from '../errors.js';
import type {
  CasStore,
  ConditionalResult,
  ConditionalUpdater,
  StoreCapabilities,
  StorageAdapterWithCapabilities,
  Transaction,
  TransactionalStore,
} from '../types.js';

interface MemoryEntry {
  value: unknown;
  revision: number;
}

type MemoryOp =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'remove'; key: string };

export class MemoryStore implements StorageAdapterWithCapabilities, CasStore, TransactionalStore {
  readonly capabilities: StoreCapabilities = {
    acknowledge: 'volatile',
    atomic: true,
    conditional: true,
  };

  private readonly entries = new Map<string, MemoryEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    return entry ? (entry.value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const entry = this.entries.get(key);
    this.entries.set(key, { value, revision: entry ? entry.revision + 1 : 1 });
  }

  async remove(key: string): Promise<boolean> {
    return this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async keys(): Promise<string[]> {
    return [...this.entries.keys()];
  }

  async has(key: string): Promise<boolean> {
    return this.entries.has(key);
  }

  async conditionalUpdate<T>(key: string, update: ConditionalUpdater<T>): Promise<ConditionalResult<T>> {
    const entry = this.entries.get(key);
    const current = entry ? (entry.value as T | null) : null;
    const revision = entry ? entry.revision : 0;

    const decision = update(current);
    if ('abort' in decision) {
      return { applied: false, value: current, revision };
    }

    this.entries.set(key, { value: decision.next, revision: revision + 1 });
    return { applied: true, value: decision.next, revision: revision + 1 };
  }

  transaction(): Transaction {
    return new MemoryTransaction(this);
  }
}

class MemoryTransaction implements Transaction {
  private readonly ops: MemoryOp[] = [];

  constructor(private readonly store: MemoryStore) {}

  async get<T>(key: string): Promise<T | null> {
    return this.store.get<T>(key);
  }

  set<T>(key: string, value: T): Transaction {
    this.ops.push({ type: 'set', key, value });
    return this;
  }

  remove(key: string): Transaction {
    this.ops.push({ type: 'remove', key });
    return this;
  }

  async commit(): Promise<void> {
    const prior = new Map<string, { existed: boolean; value: unknown }>();
    for (const op of this.ops) {
      const existing = await this.store.get(op.key);
      prior.set(op.key, { existed: existing !== null, value: existing });
    }
    try {
      for (const op of this.ops) {
        if (op.type === 'set') {
          await this.store.set(op.key, op.value);
        } else {
          await this.store.remove(op.key);
        }
      }
    } catch (err) {
      for (const [key, snapshot] of prior) {
        if (snapshot.existed) {
          await this.store.set(key, snapshot.value);
        } else {
          await this.store.remove(key);
        }
      }
      throw new StorageError(`transaction rolled back: ${(err as Error).message}`, 'write-failed', { key: undefined, cause: err });
    }
  }
}
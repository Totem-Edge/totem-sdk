/**
 * @module @totemsdk/storage/idb
 *
 * IndexedDB `StorageAdapter` for browser contexts (extension service worker and
 * PWA). Values are committed through the versioned {@link codec} so the same
 * corruption/version guarantees hold as the file/sqlite adapters, and CAS uses a
 * single `readwrite` IndexedDB transaction (which IndexedDB serializes per
 * object store) so concurrent `conditionalUpdate` callers cannot lose updates.
 *
 * This module is only exported via the isolated `@totemsdk/storage/idb` subpath;
 * it is intentionally absent from the platform-neutral root export (RFC-007).
 */

import { codec } from '../codec.js';
import { StorageError } from '../errors.js';
import type {
  CasStore,
  ConditionalResult,
  ConditionalUpdater,
  FailurePolicy,
  StoreCapabilities,
  StorageAdapterWithCapabilities,
  Transaction,
  TransactionalStore,
} from '../types.js';

export interface IdbStoreOptions {
  /** IndexedDB factory. Defaults to the ambient `globalThis.indexedDB`. */
  readonly factory?: IDBFactory;
  /** Database name. Defaults to `'totem-storage'`. */
  readonly databaseName?: string;
  /** Object store name. Defaults to `'kv'`. */
  readonly storeName?: string;
  /** Schema version. Defaults to `1`. */
  readonly version?: number;
  /** Corrupt-read policy. Defaults to `'strict'`. */
  readonly failurePolicy?: FailurePolicy;
}

interface IdbEnvelope {
  k: string;
  v: unknown;
  r: number;
}

type IdbOp = { type: 'set'; key: string; value: unknown } | { type: 'remove'; key: string };

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IdbStore implements StorageAdapterWithCapabilities, CasStore, TransactionalStore {
  readonly capabilities: StoreCapabilities = {
    acknowledge: 'durably-acknowledged',
    atomic: true,
    conditional: true,
  };

  private readonly options: IdbStoreOptions;
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;
  private readonly failurePolicy: FailurePolicy;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(options: IdbStoreOptions = {}) {
    this.options = options;
    this.databaseName = options.databaseName ?? 'totem-storage';
    this.storeName = options.storeName ?? 'kv';
    this.version = options.version ?? 1;
    this.failurePolicy = options.failurePolicy ?? 'strict';
  }

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.openDatabase().catch((err) => {
        this.dbPromise = null;
        throw err;
      });
    }
    return this.dbPromise;
  }

  private openDatabase(): Promise<IDBDatabase> {
    const factory =
      this.options.factory ??
      (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
    if (!factory) {
      return Promise.reject(new StorageError('IndexedDB is not available in this environment', 'unavailable'));
    }
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.databaseName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () =>
        reject(new StorageError(`failed to open IndexedDB "${this.databaseName}": ${request.error?.message ?? 'unknown'}`, 'unavailable', { cause: request.error }));
      request.onblocked = () =>
        reject(new StorageError(`IndexedDB "${this.databaseName}" open blocked by another connection`, 'unavailable'));
    });
  }

  private damaged(key: string, cause: unknown): null {
    if (this.failurePolicy === 'lenient') return null;
    throw new StorageError(
      cause instanceof StorageError ? cause.message : 'corrupt record',
      'corrupt',
      { key, cause },
    );
  }

  private decode(key: string, raw: unknown): IdbEnvelope | null {
    if (raw === undefined) return null;
    try {
      const envelope = codec.deserialize(raw as Uint8Array) as Partial<IdbEnvelope>;
      if (
        envelope === null ||
        typeof envelope !== 'object' ||
        envelope.k !== key ||
        typeof envelope.r !== 'number'
      ) {
        return this.damaged(key, new Error('envelope key/revision mismatch'));
      }
      return envelope as IdbEnvelope;
    } catch (err) {
      return this.damaged(key, err);
    }
  }

  private encode(key: string, value: unknown, revision: number): Uint8Array {
    return codec.serialize({ k: key, v: value, r: revision } satisfies IdbEnvelope);
  }

  private async request<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    const tx = db.transaction(this.storeName, mode);
    const result = promisify(fn(tx.objectStore(this.storeName)));
    await this.txDone(tx);
    return result;
  }

  private txDone(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new StorageError('IndexedDB transaction failed', 'write-failed'));
      tx.onabort = () => reject(tx.error ?? new StorageError('IndexedDB transaction aborted', 'write-failed'));
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.request<unknown>('readonly', (store) => store.get(key));
      const envelope = this.decode(key, raw);
      return envelope ? (envelope.v as T) : null;
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(`failed to read key`, 'unavailable', { key, cause: err });
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.db();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.get(key);
        request.onsuccess = () => {
          const existing = this.decode(key, request.result);
          store.put(this.encode(key, value, (existing?.r ?? 0) + 1), key);
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new StorageError('write failed', 'write-failed', { key }));
        tx.onabort = () => reject(tx.error ?? new StorageError('write aborted', 'write-failed', { key }));
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('failed to write key', 'write-failed', { key, cause: err });
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      const db = await this.db();
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        let existed = false;
        const request = store.get(key);
        request.onsuccess = () => {
          existed = request.result !== undefined;
          if (existed) store.delete(key);
        };
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => resolve(existed);
        tx.onerror = () => reject(tx.error ?? new StorageError('remove failed', 'unavailable', { key }));
        tx.onabort = () => reject(tx.error ?? new StorageError('remove aborted', 'unavailable', { key }));
      });
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('failed to remove key', 'unavailable', { key, cause: err });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.request('readwrite', (store) => store.clear());
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('failed to clear store', 'unavailable', { cause: err });
    }
  }

  async keys(): Promise<string[]> {
    try {
      const all = await this.request<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
      return all.map((k) => String(k)).sort();
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('failed to enumerate keys', 'unavailable', { cause: err });
    }
  }

  async has(key: string): Promise<boolean> {
    const raw = await this.request<unknown>('readonly', (store) => store.get(key));
    return raw !== undefined;
  }

  conditionalUpdate<T>(key: string, update: ConditionalUpdater<T>): Promise<ConditionalResult<T>> {
    return this.db().then((db) => new Promise<ConditionalResult<T>>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      let result: ConditionalResult<T> | undefined;

      request.onsuccess = () => {
        try {
          const existing = this.decode(key, request.result);
          const current = existing ? (existing.v as T | null) : null;
          const revision = existing ? existing.r : 0;
          const decision = update(current);
          if ('abort' in decision) {
            result = { applied: false, value: current, revision };
            return;
          }
          store.put(this.encode(key, decision.next, revision + 1), key);
          result = { applied: true, value: decision.next, revision: revision + 1 };
        } catch (err) {
          try { tx.abort(); } catch { /* already aborted */ }
          reject(err);
        }
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(result ?? { applied: false, value: null, revision: 0 });
      tx.onerror = () => reject(tx.error ?? new StorageError('CAS failed', 'write-failed', { key }));
      tx.onabort = () => reject(tx.error ?? new StorageError('CAS aborted', 'write-failed', { key }));
    }));
  }

  transaction(): Transaction {
    return new IdbTransaction(this);
  }

  /** @internal used by {@link IdbTransaction}. */
  async applyOps(ops: readonly IdbOp[]): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      for (const op of ops) {
        if (op.type === 'set') {
          const request = store.get(op.key);
          request.onsuccess = () => {
            const existing = this.decode(op.key, request.result);
            store.put(this.encode(op.key, op.value, (existing?.r ?? 0) + 1), op.key);
          };
        } else {
          store.delete(op.key);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new StorageError('IndexedDB transaction failed', 'write-failed'));
      tx.onabort = () => reject(new StorageError('IndexedDB transaction aborted', 'write-failed'));
    });
  }

  async close(): Promise<void> {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
    this.dbPromise = null;
  }
}

class IdbTransaction implements Transaction {
  private readonly ops: IdbOp[] = [];

  constructor(private readonly store: IdbStore) {}

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
    await this.store.applyOps(this.ops);
  }
}

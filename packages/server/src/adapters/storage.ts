/**
 * Node.js Storage Adapters
 * Provides StorageAdapter implementations for Node.js environments.
 *
 * `FileStorageAdapter` is the hardened shared `FileStore` from
 * `@totemsdk/storage/fs` (RFC-007): one versioned codec record per key, written
 * temp+rename with an fsync, so corrupt records surface as `StorageError`
 * (`corrupt`) in `strict` mode rather than silently degrading to JSON `null`.
 * With a `prefix`, keys/`clear()` are prefix-scoped via `Namespace` — shared
 * directories are never cleared by accident.
 */

import { FileStore } from '@totemsdk/storage/fs';
import { Namespace } from '@totemsdk/storage';
import type { FailurePolicy, StorageAdapter } from '@totemsdk/storage';

export interface FileStorageAdapterOptions {
  directory: string;
  prefix?: string;
  /** `strict` (default) surfaces `corrupt` records; `lenient` returns null. */
  failurePolicy?: FailurePolicy;
}

export class FileStorageAdapter implements StorageAdapter {
  private readonly delegate: StorageAdapter;

  constructor(options: FileStorageAdapterOptions) {
    const store = new FileStore(options.directory, {
      failurePolicy: options.failurePolicy ?? 'strict',
    });
    this.delegate = options.prefix ? new Namespace(store, options.prefix) : store;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.delegate.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.delegate.set(key, value);
  }

  async remove(key: string): Promise<boolean> {
    return this.delegate.remove(key);
  }

  async clear(): Promise<void> {
    return this.delegate.clear();
  }

  async keys(): Promise<string[]> {
    return this.delegate.keys();
  }

  async has(key: string): Promise<boolean> {
    return this.delegate.has(key);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly storage = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
  }

  async remove(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async has(key: string): Promise<boolean> {
    return this.storage.has(key);
  }
}

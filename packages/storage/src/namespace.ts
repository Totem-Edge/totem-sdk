/**
 * @module @totemsdk/storage/namespace
 *
 * Prefix-scoped namespace wrapper. Shared directories are safe by construction:
 * `keys()` and `clear()` only ever touch keys under the owned prefix.
 */

import type { StorageAdapter } from './types.js';

export class Namespace implements StorageAdapter {
  constructor(
    private readonly store: StorageAdapter,
    public readonly prefix: string,
  ) {}

  private scoped(key: string): string {
    return this.prefix + key;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.store.get<T>(this.scoped(key));
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.store.set(this.scoped(key), value);
  }

  async remove(key: string): Promise<boolean> {
    return this.store.remove(this.scoped(key));
  }

  async clear(): Promise<void> {
    for (const key of await this.keys()) {
      await this.store.remove(this.scoped(key));
    }
  }

  async keys(): Promise<string[]> {
    const all = await this.store.keys();
    return all
      .filter((k) => k.startsWith(this.prefix))
      .map((k) => k.slice(this.prefix.length));
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(this.scoped(key));
  }
}
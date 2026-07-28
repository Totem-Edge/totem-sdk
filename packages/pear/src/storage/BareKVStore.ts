/**
 * BareKVStore — Hyperbee-backed KVStore implementation.
 *
 * Uses a Hypercore + Hyperbee (append-only B-tree) as the durable backing store.
 * This is the preferred persistence layer for Pear apps that already use the
 * Holepunch stack (zero extra dependencies, P2P-replicatable by default).
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 * The Hyperbee and Hypercore instances are loaded via dynamic import so the
 * module can be imported in environments where those packages are absent
 * (the error surfaces lazily, only when the store is first used).
 *
 * Dependency injection: pass `_bee` in options to provide a pre-constructed
 * Hyperbee instance — used by tests to avoid a real Hypercore on disk.
 */

import type { KVStore } from './types.js';

export interface HypebeeLike {
  ready(): Promise<void>;
  get(key: string): Promise<{ value: unknown } | null>;
  put(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  createReadStream(options?: { gt?: string; lt?: string }): AsyncIterable<{ key: string }>;
  close(): Promise<void>;
}

export interface BareKVStoreOptions {
  /**
   * Path on disk for the Hypercore that backs this Hyperbee.
   * Ignored when `_bee` is provided.
   */
  storagePath?: string;
  /**
   * Pre-constructed Hyperbee instance — for testing or when the caller
   * manages the Hypercore lifecycle.
   */
  _bee?: HypebeeLike;
}

export class BareKVStore implements KVStore {
  private _bee: HypebeeLike | null = null;
  private _opening: Promise<HypebeeLike> | null = null;

  constructor(private readonly _options: BareKVStoreOptions = {}) {}

  private async _open(): Promise<HypebeeLike> {
    if (this._bee) return this._bee;
    if (this._opening) return this._opening;

    this._opening = (async () => {
      if (this._options._bee) {
        this._bee = this._options._bee;
        await this._bee.ready();
        return this._bee;
      }

      const storagePath = this._options.storagePath ?? './kvstore';
      const [{ default: Hyperbee }, { default: Hypercore }] = await Promise.all([
        import('hyperbee' as string),
        import('hypercore' as string),
      ]) as [{ default: new (core: unknown, opts: object) => HypebeeLike }, { default: new (path: string) => unknown }];

      const core = new Hypercore(storagePath);
      this._bee = new Hyperbee(core, { keyEncoding: 'utf-8', valueEncoding: 'json' });
      await this._bee.ready();
      return this._bee;
    })();

    const result = await this._opening;
    this._opening = null;
    return result;
  }

  async get<T>(key: string): Promise<T | null> {
    const bee = await this._open();
    const entry = await bee.get(key);
    return entry ? (entry.value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const bee = await this._open();
    await bee.put(key, value);
  }

  async remove(key: string): Promise<boolean> {
    const bee = await this._open();
    const entry = await bee.get(key);
    if (!entry) return false;
    await bee.del(key);
    return true;
  }

  async clear(): Promise<void> {
    const bee = await this._open();
    const keysToDelete: string[] = [];
    for await (const { key } of bee.createReadStream()) {
      keysToDelete.push(key);
    }
    for (const key of keysToDelete) {
      await bee.del(key);
    }
  }

  async keys(): Promise<string[]> {
    const bee = await this._open();
    const result: string[] = [];
    for await (const { key } of bee.createReadStream()) {
      result.push(key);
    }
    return result;
  }

  async has(key: string): Promise<boolean> {
    const bee = await this._open();
    return (await bee.get(key)) !== null;
  }

  async close(): Promise<void> {
    if (this._bee) {
      await this._bee.close();
      this._bee = null;
    }
  }
}

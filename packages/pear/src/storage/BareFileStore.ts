/**
 * BareFileStore — flat-JSON-file KVStore implementation.
 *
 * Designed for Bare/Pear environments without SQLite or Hyperbee.
 * Persists all key-value pairs in a single JSON file.
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 * Uses a lazily-loaded fs module (bare-fs falls back to node:fs) so the
 * same class runs in both runtimes without modification.
 *
 * Thread-safety note: Bare is single-threaded, so synchronous reads are safe.
 * Writes are serialised through a flush queue to prevent torn writes when
 * multiple async callers write in the same tick.
 */

import type { KVStore } from './types.js';

export interface FsLike {
  readFileSync(path: string, encoding: 'utf-8'): string;
  writeFileSync(path: string, data: string, encoding: 'utf-8'): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

export interface BareFileStoreOptions {
  /**
   * Absolute path to the JSON file that backs this store.
   * The parent directory is created automatically if it does not exist.
   */
  filePath: string;
  /**
   * Optional fs shim — defaults to `node:fs`.
   * Pass `bare-fs` here when running inside a Bare/Pear app.
   */
  fs?: FsLike;
}

export class BareFileStore implements KVStore {
  private _data: Record<string, unknown> = {};
  private _loaded = false;
  private _dirty = false;
  private _flushScheduled = false;
  private readonly _filePath: string;
  private _fs: FsLike | null;

  constructor(options: BareFileStoreOptions) {
    this._filePath = options.filePath;
    this._fs = options.fs ?? null;
  }

  private async _getFs(): Promise<FsLike> {
    if (this._fs) return this._fs;
    const mod = await import('node:fs').catch(
      () => import('bare-fs' as string) as unknown as Promise<typeof import('node:fs')>,
    );
    this._fs = mod as unknown as FsLike;
    return this._fs;
  }

  private async _ensureLoaded(): Promise<void> {
    if (this._loaded) return;
    const fs = await this._getFs();
    try {
      if (fs.existsSync(this._filePath)) {
        const raw = fs.readFileSync(this._filePath, 'utf-8');
        this._data = JSON.parse(raw) as Record<string, unknown>;
      } else {
        this._data = {};
      }
    } catch {
      this._data = {};
    }
    this._loaded = true;
  }

  private _scheduledFlush(fs: FsLike): void {
    if (this._flushScheduled) return;
    this._flushScheduled = true;
    setImmediate(() => {
      this._flushScheduled = false;
      if (!this._dirty) return;
      try {
        fs.mkdirSync(this._filePath.replace(/[\\/][^\\/]+$/, ''), { recursive: true });
        fs.writeFileSync(this._filePath, JSON.stringify(this._data), 'utf-8');
        this._dirty = false;
      } catch {
        // Flush failure is non-fatal — will retry on next write
      }
    });
  }

  private async _flush(): Promise<void> {
    if (!this._dirty) return;
    const fs = await this._getFs();
    const dir = this._filePath.replace(/[\\/][^\\/]+$/, '');
    if (dir && dir !== this._filePath) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this._filePath, JSON.stringify(this._data), 'utf-8');
    this._dirty = false;
  }

  async get<T>(key: string): Promise<T | null> {
    await this._ensureLoaded();
    return key in this._data ? (this._data[key] as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this._ensureLoaded();
    this._data[key] = value;
    this._dirty = true;
    const fs = await this._getFs();
    this._scheduledFlush(fs);
  }

  async remove(key: string): Promise<boolean> {
    await this._ensureLoaded();
    if (!(key in this._data)) return false;
    delete this._data[key];
    this._dirty = true;
    await this._flush();
    return true;
  }

  async clear(): Promise<void> {
    await this._ensureLoaded();
    this._data = {};
    this._dirty = true;
    await this._flush();
  }

  async keys(): Promise<string[]> {
    await this._ensureLoaded();
    return Object.keys(this._data);
  }

  async has(key: string): Promise<boolean> {
    await this._ensureLoaded();
    return key in this._data;
  }

  /** Force a synchronous flush of pending writes. Useful before process exit. */
  async flush(): Promise<void> {
    if (!this._loaded) return;
    await this._flush();
  }
}

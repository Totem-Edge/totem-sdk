/**
 * BareFileStore — Bare-compatible, single-file KVStore implementation.
 *
 * Retains the Pear/Bare `filePath` and injectable-fs API while adopting the
 * shared FileStore contract from RFC-007 Phase 2:
 *
 * - values round-trip through the versioned storage codec (bigint/Uint8Array)
 * - writes use temp-write + fsync (when available) + atomic rename
 * - `set` acknowledges only after the durable write finishes
 * - corrupt data is distinct from absent data (`strict` by default)
 *
 * Bare-compatible: no `process.env`, `__dirname`, or `require`. The fs module
 * is loaded lazily (`node:fs`, falling back to `bare-fs`) unless injected.
 */

import { codec } from '@totemsdk/storage/codec';
import { StorageError } from '@totemsdk/storage/errors';
import type { FailurePolicy } from '@totemsdk/storage/types';
import type { KVStore } from './types.js';

export interface FsLike {
  readFileSync(path: string): Uint8Array;
  writeFileSync(path: string, data: Uint8Array): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  renameSync(from: string, to: string): void;
  unlinkSync(path: string): void;
  openSync?(path: string, flags: string): number;
  fsyncSync?(fd: number): void;
  closeSync?(fd: number): void;
}

export interface BareFileStoreOptions {
  /** Absolute path to the codec file backing this store. */
  filePath: string;
  /** Optional fs shim. Pass `bare-fs` inside a Bare/Pear app. */
  fs?: FsLike;
  /** `strict` (default) surfaces corrupt data; `lenient` treats it as empty. */
  failurePolicy?: FailurePolicy;
}

export class BareFileStore implements KVStore {
  private data: Record<string, unknown> = {};
  private loaded = false;
  private dirty = false;
  private readonly filePath: string;
  private readonly failurePolicy: FailurePolicy;
  private fs: FsLike | null;

  constructor(options: BareFileStoreOptions) {
    this.filePath = options.filePath;
    this.fs = options.fs ?? null;
    this.failurePolicy = options.failurePolicy ?? 'strict';
  }

  private async getFs(): Promise<FsLike> {
    if (this.fs) return this.fs;
    const mod = await import('node:fs').catch(
      () => import('bare-fs' as string) as unknown as Promise<typeof import('node:fs')>,
    );
    this.fs = mod as unknown as FsLike;
    return this.fs;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const fs = await this.getFs();
    if (!fs.existsSync(this.filePath)) {
      this.data = {};
      this.loaded = true;
      return;
    }

    try {
      const decoded = codec.deserialize(fs.readFileSync(this.filePath));
      if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
        throw new StorageError('BareFileStore root is not an object', 'corrupt');
      }
      this.data = decoded as Record<string, unknown>;
    } catch (error) {
      if (this.failurePolicy === 'lenient') {
        this.data = {};
      } else {
        throw new StorageError('BareFileStore contains corrupt data', 'corrupt', { cause: error });
      }
    }
    this.loaded = true;
  }

  private async write(): Promise<void> {
    if (!this.dirty) return;
    const fs = await this.getFs();
    const dir = this.filePath.replace(/[\\/][^\\/]+$/, '');
    if (dir && dir !== this.filePath) fs.mkdirSync(dir, { recursive: true });

    const tmp = `${this.filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      fs.writeFileSync(tmp, codec.serialize(this.data));
      if (fs.openSync && fs.fsyncSync && fs.closeSync) {
        const fd = fs.openSync(tmp, 'r+');
        try {
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
      fs.renameSync(tmp, this.filePath);
      this.dirty = false;
    } catch (error) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {
        // Preserve the original write failure.
      }
      throw new StorageError('BareFileStore write failed', 'write-failed', { cause: error });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureLoaded();
    return key in this.data ? (this.data[key] as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.ensureLoaded();
    const existed = key in this.data;
    const previous = this.data[key];
    this.data[key] = value;
    this.dirty = true;
    try {
      await this.write();
    } catch (error) {
      if (existed) this.data[key] = previous;
      else delete this.data[key];
      this.dirty = false;
      throw error;
    }
  }

  async remove(key: string): Promise<boolean> {
    await this.ensureLoaded();
    if (!(key in this.data)) return false;
    const previous = this.data[key];
    delete this.data[key];
    this.dirty = true;
    try {
      await this.write();
    } catch (error) {
      this.data[key] = previous;
      this.dirty = false;
      throw error;
    }
    return true;
  }

  async clear(): Promise<void> {
    await this.ensureLoaded();
    const previous = this.data;
    this.data = {};
    this.dirty = true;
    try {
      await this.write();
    } catch (error) {
      this.data = previous;
      this.dirty = false;
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    await this.ensureLoaded();
    return Object.keys(this.data);
  }

  async has(key: string): Promise<boolean> {
    await this.ensureLoaded();
    return key in this.data;
  }

  /** Writes are already durable; retained for shutdown-call compatibility. */
  async flush(): Promise<void> {
    if (!this.loaded) return;
    await this.write();
  }
}

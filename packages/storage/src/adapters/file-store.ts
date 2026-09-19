/**
 * @module @totemsdk/storage/fs
 *
 * Node file-system `StorageAdapter` — hardened replacement for
 * `server.FileStorageAdapter`, omnia `JsonFileStorageAdapter`, and Pear
 * `BareFileStore`. One versioned codec record per key, written temp+rename with
 * an fsync on the write path, so corruption is detectable (`corrupt`) rather
 * than silently returned as JSON `null`.
 *
 * Node `fs` lives behind this isolated subpath; the neutral package surface
 * (`@totemsdk/storage`) never imports it.
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';

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

interface FileEnvelope {
  k: string;
  v: unknown;
  r: number;
}

type FileOp =
  | { type: 'set'; key: string; value: unknown }
  | { type: 'remove'; key: string };

function fileNameFor(key: string): string {
  return `${Buffer.from(key, 'utf8').toString('hex')}.bin`;
}

function keyForFile(name: string): string {
  return Buffer.from(name.slice(0, -4), 'hex').toString('utf8');
}

export interface FileStoreOptions {
  readonly failurePolicy?: FailurePolicy;
  /** Stale CAS lock age in ms after which the lock is stolen (default 30_000). */
  readonly lockStaleMs?: number;
}

/**
 * Advisory per-key lock used to make `conditionalUpdate` a true CAS across both
 * concurrent calls on one store and separate processes sharing one directory.
 * `fs.mkdir` is atomic and exclusive on POSIX (a directory is the classic
 * lock primitive): exactly one contender wins `EEXIST`-free creation. The lock
 * directory is removed on release; a crashed holder leaves it behind, so a
 * holder that has outlived the stale threshold is stolen, with the record
 * re-read fresh after any steal — the read-modify-write always runs inside
 * mutual exclusion.
 *
 * Safety rules:
 * - a lock is only ever stolen when it is provably stale (marker present and
 *   older than `staleMs`) or provably orphaned (marker absent for a full
 *   `staleMs/2` grace, i.e. a claim crashed before writing its marker);
 * - release removes only the owner's own marker, then rmdir's the now-empty
 *   directory — a new holder's directory is never removed (rmdir of a
 *   non-empty directory fails and is ignored).
 */
class CasLock {
  private static readonly MARKER = '__owner__';

  constructor(
    readonly path: string,
    readonly staleMs: number,
  ) {}

  private async readMarker(): Promise<number | null> {
    try {
      const raw = await fs.readFile(join(this.path, CasLock.MARKER), 'utf8');
      const born = Number(raw.split('\n')[0]);
      return Number.isFinite(born) ? born : null;
    } catch {
      return null;
    }
  }

  private async steal(): Promise<void> {
    await fs.rm(this.path, { recursive: true, force: true }).catch(() => undefined);
  }

  async acquire(): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    for (;;) {
      try {
        await fs.mkdir(this.path);
        await fs.writeFile(join(this.path, CasLock.MARKER), `${Date.now()}\n${process.pid}`, 'utf8');
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw new StorageError(`FileStore CAS lock acquire failed: ${(err as Error).message}`, 'unavailable', { cause: err });
        }
      }

      const born = await this.readMarker();
      if (born !== null) {
        if (Date.now() - born >= this.staleMs) {
          await this.steal();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        continue;
      }

      // Marker missing: either a claim still in flight (mkdir→marker is a
      // microsecond window) or a holder that crashed before its marker. Wait a
      // short fixed grace for the marker to appear (normal handoff / in-flight
      // claim); only steal if it never does (a genuine orphan).
      const graceUntil = Date.now() + ORPHAN_GRACE_MS;
      let orphan = true;
      while (Date.now() < graceUntil) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if ((await this.readMarker()) !== null) {
          orphan = false;
          break;
        }
      }
      if (orphan) {
        await this.steal();
      }
    }
  }

  async release(): Promise<void> {
    await fs.rm(join(this.path, CasLock.MARKER), { force: true }).catch(() => undefined);
    await fs.rmdir(this.path).catch(() => undefined);
  }
}

/** Fixed grace for a marker-less lock dir (crash between `mkdir` and the
 *  marker write). The mkdir→marker window is microseconds, so 150ms is ample
 *  to observe a normal claim in flight without stalling hand-offs. */
const ORPHAN_GRACE_MS = 150;

export class FileStore implements StorageAdapterWithCapabilities, CasStore, TransactionalStore {
  readonly capabilities: StoreCapabilities = {
    acknowledge: 'durably-acknowledged',
    atomic: false,
    conditional: true,
  };

  private readonly failurePolicy: FailurePolicy;
  private readonly lockStaleMs: number;

  constructor(
    private readonly dir: string,
    options: FileStoreOptions = {},
  ) {
    this.failurePolicy = options.failurePolicy ?? 'strict';
    this.lockStaleMs = options.lockStaleMs ?? 30_000;
  }

  private fileFor(key: string): string {
    return join(this.dir, fileNameFor(key));
  }

  /** Advisory lock path for a key. Sits beside the data (same filesystem) but
   *  is named without the `.bin` suffix so `keys()` and `clear()` never see it. */
  private lockFor(key: string): CasLock {
    return new CasLock(join(this.dir, `.locks-${fileNameFor(key).slice(0, -4)}`), this.lockStaleMs);
  }

  private async readEnvelope(key: string): Promise<FileEnvelope | null> {
    const file = this.fileFor(key);
    let data: Buffer;
    try {
      data = await fs.readFile(file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new StorageError(`FileStore read failed: ${(err as Error).message}`, 'unavailable', { key, cause: err });
    }
    try {
      return codec.deserialize(new Uint8Array(data)) as FileEnvelope;
    } catch (err) {
      return this.damaged(key, err);
    }
  }

  private damaged(key: string, cause: unknown): null {
    if (this.failurePolicy === 'lenient') {
      return null;
    }
    throw new StorageError(cause instanceof StorageError ? cause.message : `corrupt record for key`, 'corrupt', { key, cause });
  }

  async get<T>(key: string): Promise<T | null> {
    const envelope = await this.readEnvelope(key);
    if (envelope === null) return null;
    if (envelope.k !== key) {
      return this.damaged(key, new StorageError('envelope key mismatch', 'corrupt'));
    }
    return envelope.v as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const envelope: FileEnvelope = { k: key, v: value, r: 0 };
    const file = this.fileFor(key);
    const tmp = join(this.dir, `.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
    let handle: fs.FileHandle;
    try {
      handle = await fs.open(tmp, 'w');
    } catch (err) {
      throw new StorageError(`FileStore open failed: ${(err as Error).message}`, 'unavailable', { key, cause: err });
    }
    try {
      await handle.writeFile(codec.serialize(envelope));
      await handle.sync();
    } catch (err) {
      await handle.close();
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw new StorageError(`FileStore write failed: ${(err as Error).message}`, 'write-failed', { key, cause: err });
    }
    await handle.close();
    try {
      await fs.rename(tmp, file);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw new StorageError(`FileStore commit failed: ${(err as Error).message}`, 'write-failed', { key, cause: err });
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      await fs.unlink(this.fileFor(key));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw new StorageError(`FileStore remove failed: ${(err as Error).message}`, 'unavailable', { key, cause: err });
    }
  }

  async clear(): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new StorageError(`FileStore clear failed: ${(err as Error).message}`, 'unavailable', { cause: err });
    }
    for (const name of names) {
      if (name.endsWith('.bin')) {
        await fs.rm(join(this.dir, name), { force: true }).catch(() => undefined);
      }
    }
  }

  async keys(): Promise<string[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new StorageError(`FileStore keys failed: ${(err as Error).message}`, 'unavailable', { cause: err });
    }
    return names.filter((n) => n.endsWith('.bin')).map(keyForFile).sort();
  }

  async has(key: string): Promise<boolean> {
    try {
      await fs.access(this.fileFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async conditionalUpdate<T>(key: string, update: ConditionalUpdater<T>): Promise<ConditionalResult<T>> {
    // The read → update → write must be in mutual exclusion; without a lock two
    // writers both read the same revision and the last rename silently clobbers
    // the other (AUD-033). Under this per-key lock, contention either waits or
    // is detected — it is never resolved by overwriting a peer's commit.
    const lock = this.lockFor(key);
    await lock.acquire();
    try {
      const envelope = await this.readEnvelope(key);
      const current = envelope ? (envelope.v as T | null) : null;
      const revision = envelope ? envelope.r : 0;

      const decision = update(current);
      if ('abort' in decision) {
        return { applied: false, value: current, revision };
      }

      const next: FileEnvelope = { k: key, v: decision.next, r: revision + 1 };
      await fs.mkdir(this.dir, { recursive: true });
      const file = this.fileFor(key);
      const tmp = join(this.dir, `.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
      let handle: fs.FileHandle;
      try {
        handle = await fs.open(tmp, 'w');
      } catch (err) {
        throw new StorageError(`FileStore open failed: ${(err as Error).message}`, 'unavailable', { key, cause: err });
      }
      try {
        await handle.writeFile(codec.serialize(next));
        await handle.sync();
        await handle.close();
        await fs.rename(tmp, file);
      } catch (err) {
        await handle.close();
        await fs.rm(tmp, { force: true }).catch(() => undefined);
        throw new StorageError(`FileStore CAS failed: ${(err as Error).message}`, 'write-failed', { key, cause: err });
      }
      return { applied: true, value: decision.next, revision: revision + 1 };
    } finally {
      await lock.release();
    }
  }

  transaction(): Transaction {
    return new FileTransaction(this);
  }
}

class FileTransaction implements Transaction {
  private readonly ops: FileOp[] = [];

  constructor(private readonly store: FileStore) {}

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
    const prior = new Map<string, { existed: boolean; value: Buffer | null }>();
    for (const op of this.ops) {
      const file = this.store['fileFor'](op.key);
      let data: Buffer | null = null;
      try {
        data = await fs.readFile(file);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new StorageError(`FileStore transaction read failed: ${(err as Error).message}`, 'unavailable', { key: op.key, cause: err });
        }
      }
      prior.set(op.key, { existed: data !== null, value: data });
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
        const file = this.store['fileFor'](key);
        if (snapshot.existed && snapshot.value !== null) {
          const tmp = join(dirname(file), `.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
          await fs.writeFile(tmp, snapshot.value).catch(() => undefined);
          await fs.rename(tmp, file).catch(() => undefined);
        } else {
          await fs.rm(file, { force: true }).catch(() => undefined);
        }
      }
      throw new StorageError(`FileStore transaction rolled back: ${(err as Error).message}`, 'write-failed', { cause: err });
    }
  }
}
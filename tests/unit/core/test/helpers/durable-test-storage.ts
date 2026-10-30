/**
 * Strict, disk-backed StorageAdapter used by the core persistence-consumer
 * conformance tests (Phase 4 of RFC-007).
 *
 * Mirrors the strict contract of the shared `@totemsdk/storage` FileStore:
 * - a corrupt record is surfaced as a thrown StorageError (never silently
 *   reported as absent);
 * - a missing record is `null`;
 * - writes go through a temp-file + rename so a crash never leaves a trampled
 *   record.
 *
 * Fault injection (`failNextSet` / `failAllSets`) lets the consumer tests
 * exercise the "write-failed surfaced where strict" rollback paths.
 */

import { mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { StorageAdapter } from '../../src/adapters/index.js';
import { StorageError } from '../../src/adapters/types.js';

function fileNameFor(key: string): string {
  return `${Buffer.from(key, 'utf8').toString('hex')}.json`;
}

export class DurableTestStorage implements StorageAdapter {
  private failNext = false;
  private failAll = false;
  private failNextRemoveOp = false;
  private failAllRemoveOp = false;

  constructor(readonly dir: string) {}

  async get<T>(key: string): Promise<T | null> {
    let data: string;
    try {
      data = await readFile(join(this.dir, fileNameFor(key)), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new StorageError(`DurableTestStorage read failed: ${(err as Error).message}`, err as Error);
    }
    try {
      return JSON.parse(data) as T;
    } catch (err) {
      return this.damaged(key, err);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.failAll || this.failNext) {
      this.failNext = false;
      throw new StorageError('injected write failure');
    }
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, fileNameFor(key));
    const tmp = join(this.dir, `tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, file);
  }

  async remove(key: string): Promise<boolean> {
    if (this.failAllRemoveOp || this.failNextRemoveOp) {
      this.failNextRemoveOp = false;
      throw new StorageError('injected remove failure');
    }
    try {
      await unlink(join(this.dir, fileNameFor(key)));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
  }

  async clear(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
    await mkdir(this.dir, { recursive: true });
  }

  async keys(): Promise<string[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    return names
      .filter((name) => name.endsWith('.json') && !name.startsWith('tmp-'))
      .map((name) => Buffer.from(name.slice(0, -5), 'hex').toString('utf8'));
  }

  async has(key: string): Promise<boolean> {
    try {
      await readFile(join(this.dir, fileNameFor(key)));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
  }

  /** Make `set` fail for the next invocation only. */
  failNextSet(): void {
    this.failNext = true;
  }

  /** Make `set` fail for every subsequent invocation. */
  failAllSets(): void {
    this.failAll = true;
  }

  repairSets(): void {
    this.failNext = false;
    this.failAll = false;
  }

  /** Make `remove` fail for the next invocation only. */
  failNextRemove(): void {
    this.failNextRemoveOp = true;
  }

  /** Make `remove` fail for every subsequent invocation. */
  failAllRemoves(): void {
    this.failAllRemoveOp = true;
  }

  repairRemoves(): void {
    this.failNextRemoveOp = false;
    this.failAllRemoveOp = false;
  }

  /** Clear all fault injection. */
  repairAll(): void {
    this.repairSets();
    this.repairRemoves();
  }

  /** Overwrite the record for `key` with non-JSON garbage. */
  async corrupt(key: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, fileNameFor(key)), '{not-valid-json');
  }

  private damaged(key: string, cause: unknown): never {
    throw new StorageError(`corrupt record for key '${key}'`, cause instanceof Error ? cause : undefined);
  }
}

export function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'totem-conformance-'));
}
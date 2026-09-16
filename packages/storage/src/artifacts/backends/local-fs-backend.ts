/**
 * @module @totemsdk/storage/artifacts/backends/local-fs-backend
 *
 * Reference `ArtifactStoreBackend` adapter backed by the local Node file system.
 * File names are content-addressed (`<namespace>.<digest>.art`) so the backend
 * is a byte-mover with no KV semantics. Write acknowledgment is
 * `durably-acknowledged` (write + fsync + rename).
 *
 * This adapter proves the port seam. The SDK never maintains a provider
 * registry — any external store earns "tested contract" status by passing the
 * backend conformance suite.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import { StorageError } from '../../errors.js';
import type {
  ArtifactBackendCapabilities,
  ArtifactRef,
  ArtifactRead,
  ArtifactStoreBackend,
  PutOptions,
  PutReceipt,
} from '../types.js';

export class LocalFileBackend implements ArtifactStoreBackend {
  readonly capabilities: ArtifactBackendCapabilities = {
    writable: true,
    acknowledge: 'durably-acknowledged',
    atomic: true,
    retention: 'managed',
    offlineReadable: true,
  };

  constructor(private readonly root: string) {}

  private fileFor(ref: ArtifactRef): string {
    const ns = Buffer.from(ref.namespace, 'utf8').toString('hex');
    return join(this.root, `${ns}.${ref.digest}.art`);
  }

  async put(ref: ArtifactRef, bytes: Uint8Array, options?: PutOptions): Promise<PutReceipt> {
    await fs.mkdir(this.root, { recursive: true });
    const file = this.fileFor(ref);
    const tmp = `${file}.tmp-${Math.random().toString(36).slice(2)}`;
    let handle: fs.FileHandle;
    try {
      handle = await fs.open(tmp, 'w');
    } catch (err) {
      throw new StorageError(`LocalFileBackend open failed: ${(err as Error).message}`, 'unavailable', { cause: err });
    }
    try {
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      await fs.rename(tmp, file);
    } catch (err) {
      await handle.close().catch(() => undefined);
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw new StorageError(`LocalFileBackend write failed: ${(err as Error).message}`, 'write-failed', { cause: err });
    }
    return { ref, size: bytes.byteLength, acknowledge: this.capabilities.acknowledge };
  }

  async get(ref: ArtifactRef): Promise<ArtifactRead> {
    const file = this.fileFor(ref);
    let data: Buffer;
    try {
      data = await fs.readFile(file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { status: 'not-found' };
      }
      return { status: 'unavailable', message: (err as Error).message };
    }
    return { status: 'ok', bytes: new Uint8Array(data) };
  }

  async delete(ref: ArtifactRef): Promise<void> {
    try {
      await fs.unlink(this.fileFor(ref));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new StorageError(`LocalFileBackend delete failed: ${(err as Error).message}`, 'unavailable', { cause: err });
    }
  }
}
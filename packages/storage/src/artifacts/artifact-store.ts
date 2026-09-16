/**
 * @module @totemsdk/storage/artifacts/artifact-store
 *
 * `ArtifactStore` wraps a pluggable `ArtifactStoreBackend` port and verifies
 * digests on read. Content-addressed references are created at `put` time; the
 * bytes move through the backend port. The store never exposes a KV surface —
 * this is the seam where Arweave/Filecoin/IPFS/torrents/Drive/object stores
 * plug in without proliferating SDK integrations.
 *
 * An optional `index` (any `StorageAdapter`) keeps per-artifact metadata
 * (retention policy, owner, tombstone) so the local journal remains authoritative
 * over what the remote backend knows about.
 */

import { sha3_256, toHex } from '@totemsdk/core';
import { StorageError } from '../errors.js';
import { codec } from '../codec.js';
import type { StorageAdapter } from '../types.js';
import {
  ARTIFACT_DEFAULT_ALGORITHM,
  artifactRefId,
} from './types.js';
import type {
  ArtifactBackendCapabilities,
  ArtifactIndexEntry,
  ArtifactRef,
  ArtifactRead,
  ArtifactReadStatus,
  ArtifactStoreBackend,
  PutOptions,
  PutReceipt,
} from './types.js';

export interface ArtifactStoreOptions {
  readonly index?: StorageAdapter;
  readonly defaultRetentionMs?: number;
}

export class ArtifactStore {
  private readonly backend: ArtifactStoreBackend;
  private readonly index?: StorageAdapter;
  private readonly defaultRetentionMs?: number;

  constructor(backend: ArtifactStoreBackend, options: ArtifactStoreOptions = {}) {
    this.backend = backend;
    this.index = options.index;
    this.defaultRetentionMs = options.defaultRetentionMs;
  }

  get capabilities(): ArtifactBackendCapabilities {
    return this.backend.capabilities;
  }

  async put(namespace: string, bytes: Uint8Array, options?: PutOptions): Promise<PutReceipt> {
    if (!this.backend.capabilities.writable) {
      throw new StorageError('backend is read-only', 'unavailable');
    }
    const digest = toHex(sha3_256(bytes));
    const ref: ArtifactRef = { namespace, algorithm: ARTIFACT_DEFAULT_ALGORITHM, digest };
    const receipt = await this.backend.put(ref, bytes, options);
    if (this.index) {
      const owner = options?.metadata?.owner;
    const retentionMs = options?.retentionMs ?? this.defaultRetentionMs;
    const entry = {
      id: artifactRefId(ref),
      ref,
      size: receipt.size,
      createdAt: Date.now(),
      ...(owner !== undefined ? { owner } : {}),
      ...(retentionMs !== undefined ? { retentionMs } : {}),
    };
    await this.index.set(artifactRefId(ref), codec.serialize(entry));
    }
    return receipt;
  }

  async get(ref: ArtifactRef): Promise<ArtifactRead> {
    const read = await this.backend.get(ref);
    if (read.status !== 'ok' || !read.bytes) return read;
    const actual = toHex(sha3_256(read.bytes));
    if (actual !== ref.digest) {
      return { status: 'corrupt', message: 'digest mismatch' };
    }
    return read;
  }

  async delete(ref: ArtifactRef): Promise<void> {
    if (!this.backend.delete) {
      throw new StorageError('backend does not support delete (immutable)', 'unavailable');
    }
    await this.backend.delete(ref);
    if (this.index) {
      await this.index.remove(artifactRefId(ref));
    }
  }

  async list(): Promise<ArtifactIndexEntry[]> {
    if (!this.index) return [];
    const keys = await this.index.keys();
    const entries: ArtifactIndexEntry[] = [];
    for (const key of keys) {
      const raw = await this.index.get<Uint8Array>(key);
      if (raw) {
        try {
          entries.push(codec.deserialize(raw) as ArtifactIndexEntry);
        } catch {
          // skip corrupt index entries — they don't block other entries
        }
      }
    }
    return entries;
  }
}
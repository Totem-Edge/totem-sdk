/**
 * RFC-007 Amendment A, phase A1: Edge artifact cache conformance.
 *
 * Write → process restart/reopen → retrieve; scope isolation; expiry/invalidation;
 * corrupt vs not-found; capability/policy rejection.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ArtifactStore, MemoryStore, StorageError, artifactRefId } from '@totemsdk/storage';
import type { ArtifactBackendCapabilities, ArtifactStoreBackend, StorageScope } from '@totemsdk/storage';
import { SqliteStore } from '@totemsdk/storage/sqlite';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';

import { createEdgeArtifactCache } from '../artifact-cache.js';

const scopeA: StorageScope = { principal: 'p', adapter: 'a', purpose: 'cache' };
const scopeB: StorageScope = { principal: 'p', adapter: 'a', purpose: 'other' };

function memBackend(overrides: Partial<ArtifactBackendCapabilities> = {}): ArtifactStoreBackend {
  const map = new Map<string, Uint8Array>();
  const capabilities: ArtifactBackendCapabilities = {
    writable: true,
    deletable: true,
    acknowledge: 'volatile',
    atomic: false,
    retention: 'none',
    offlineReadable: true,
    ...overrides,
  };
  return {
    capabilities,
    put: async (ref, bytes) => {
      map.set(artifactRefId(ref), bytes);
      return { ref, size: bytes.byteLength, acknowledge: capabilities.acknowledge };
    },
    get: async (ref) => {
      const bytes = map.get(artifactRefId(ref));
      return bytes ? { status: 'ok', bytes } : { status: 'not-found' };
    },
    delete: async (ref) => {
      map.delete(artifactRefId(ref));
    },
  };
}

describe('edge artifact cache (A1)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'edge-artifact-cache-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function durablePorts() {
    const dbPath = join(root, 'kv.sqlite');
    return {
      dbPath,
      storage: new SqliteStore(dbPath),
      artifacts: new ArtifactStore(new LocalFileBackend(join(root, 'artifacts'))),
    };
  }

  it('retrieves bytes after a process restart/reopen', async () => {
    const first = durablePorts();
    const cache1 = createEdgeArtifactCache({ storage: first.storage, artifacts: first.artifacts }, { durable: true });
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const ref = await cache1.put(scopeA, bytes);
    first.storage.close?.();

    // Reopen fresh store/backends over the same paths.
    const second = durablePorts();
    const cache2 = createEdgeArtifactCache({ storage: second.storage, artifacts: second.artifacts }, { durable: true });
    const read = await cache2.get(scopeA, ref);
    expect(read.status).toBe('ok');
    expect(Buffer.from(read.bytes!).toString('hex')).toBe(Buffer.from(bytes).toString('hex'));
    second.storage.close?.();
  });

  it('isolates scopes: same bytes under different scopes do not alias', async () => {
    const artifacts = new ArtifactStore(memBackend());
    const storage = new SqliteStore(':memory:');
    const cache = createEdgeArtifactCache({ storage, artifacts }, { durable: false });
    const bytes = new Uint8Array([9, 9]);
    const refA = await cache.put(scopeA, bytes);
    const refB = await cache.put(scopeB, bytes);

    // Same content digest, but distinct scoped namespaces.
    expect(refA.digest).toBe(refB.digest);
    expect(refA.namespace).not.toBe(refB.namespace);

    // A ref from one scope is not resolvable through another scope's index.
    expect((await cache.get(scopeA, refA)).status).toBe('ok');
    expect((await cache.get(scopeB, refB)).status).toBe('ok');
    expect((await cache.get(scopeB, refA)).status).toBe('not-found');

    // Invalidating in scope A leaves scope B's entry/blob intact.
    await cache.invalidate(scopeA, refA);
    expect((await cache.get(scopeA, refA)).status).toBe('not-found');
    expect((await cache.get(scopeB, refB)).status).toBe('ok');
    storage.close?.();
  });

  it('treats an expired entry as not-found and can invalidate it', async () => {
    const artifacts = new ArtifactStore(memBackend());
    const storage = new SqliteStore(':memory:');
    const cache = createEdgeArtifactCache({ storage, artifacts }, { durable: false });
    const ref = await cache.put(scopeA, new Uint8Array([7]), { ttlMs: -1 });

    expect((await cache.get(scopeA, ref)).status).toBe('not-found');
    // With invalidateOnExpiry, the bytes are actually deleted.
    expect((await cache.get(scopeA, ref, { invalidateOnExpiry: true })).status).toBe('not-found');
    expect((await cache.get(scopeA, ref)).status).toBe('not-found');
    storage.close?.();
  });

  it('distinguishes corrupt from not-found', async () => {
    // Backend returns bytes that do not match the ref digest → corrupt.
    const tampering: ArtifactStoreBackend = {
      ...memBackend(),
      get: async () => ({ status: 'ok', bytes: new Uint8Array([0xde, 0xad]) }),
    };
    const artifacts = new ArtifactStore(tampering);
    const storage = new SqliteStore(':memory:');
    const cache = createEdgeArtifactCache({ storage, artifacts }, { durable: false });

    const ref = await cache.put(scopeA, new Uint8Array([1, 2, 3]));
    expect((await cache.get(scopeA, ref)).status).toBe('corrupt');
    expect((await cache.get(scopeA, { ...ref, digest: 'ff'.repeat(32) })).status).toBe('not-found');
    storage.close?.();
  });

  it('rejects capability/policy mismatches at construction', () => {
    const storage = new SqliteStore(':memory:');
    const artifacts = new ArtifactStore(memBackend());

    // No artifact store.
    expect(() => createEdgeArtifactCache({ storage }, { durable: false })).toThrow(StorageError);
    // Non-deletable backend.
    const nonDeletable = new ArtifactStore(memBackend({ deletable: false }));
    expect(() => createEdgeArtifactCache({ storage, artifacts: nonDeletable }, { durable: false })).toThrow(/deletable/);
    // Read-only backend.
    const readOnly = new ArtifactStore(memBackend({ writable: false }));
    expect(() => createEdgeArtifactCache({ storage, artifacts: readOnly }, { durable: false })).toThrow(/read-only/);
    // Durable requirement with a volatile KV.
    expect(() =>
      createEdgeArtifactCache({ storage: new MemoryStore(), artifacts }, { durable: true }),
    ).toThrow(/durably-acknowledged/);
    storage.close?.();
  });

  it('rejects a lenient storage adapter when strict is required', () => {
    const storage = new SqliteStore(':memory:', { failurePolicy: 'lenient' });
    const artifacts = new ArtifactStore(memBackend());
    expect(() =>
      createEdgeArtifactCache({ storage, artifacts }, { durable: false, failurePolicy: 'strict' }),
    ).toThrow(/lenient/);
    storage.close?.();
  });
});

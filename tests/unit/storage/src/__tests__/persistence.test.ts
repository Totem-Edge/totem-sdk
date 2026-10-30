/**
 * RFC-007 Amendment A (§A.3, §A.9, §A.10): `assertPersistence` + `createScopedStorage`.
 */
import { MemoryStore } from '../adapters/memory-store.js';
import { SqliteStore } from '../adapters/sqlite-store.js';
import { ArtifactStore } from '../artifacts/artifact-store.js';
import type { ArtifactStoreBackend, ArtifactBackendCapabilities } from '../artifacts/types.js';
import { assertPersistence, createScopedStorage } from '../persistence.js';
import type { PersistencePorts, PersistenceRequirement } from '../persistence.js';

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
      map.set(ref.digest, bytes);
      return { ref, size: bytes.byteLength, acknowledge: capabilities.acknowledge };
    },
    get: async (ref) => {
      const bytes = map.get(ref.digest);
      return bytes ? { status: 'ok', bytes } : { status: 'not-found' };
    },
    delete: async (ref) => {
      map.delete(ref.digest);
    },
  };
}

const req = (r: Partial<PersistenceRequirement>): PersistenceRequirement => ({ durable: false, ...r });

describe('assertPersistence', () => {
  it('durable:false with no storage reports mode none', () => {
    const effective = assertPersistence({}, req({}), 'test');
    expect(effective.storage.mode).toBe('none');
    expect(effective.durable).toBe(false);
  });

  it('durable:false with a volatile adapter reports its ack mode', () => {
    const ports: PersistencePorts = { storage: new MemoryStore() };
    const effective = assertPersistence(ports, req({}), 'test');
    expect(effective.storage.mode).toBe('volatile');
    expect(effective.durable).toBe(false);
  });

  it('durable:true with no storage throws unavailable', () => {
    expect(() => assertPersistence({}, req({ durable: true }), 'test')).toThrow(/requires a storage adapter/);
  });

  it('durable:true with an explicit volatile ack is contradictory', () => {
    expect(() =>
      assertPersistence({ storage: new MemoryStore() }, req({ durable: true, acknowledge: 'volatile' }), 'test'),
    ).toThrow(/contradictory/);
  });

  it('durable:true with a volatile adapter throws (no silent downgrade)', () => {
    expect(() =>
      assertPersistence({ storage: new MemoryStore() }, req({ durable: true }), 'test'),
    ).toThrow(/durably-acknowledged/);
  });

  it('durable:true with a durable adapter succeeds', () => {
    const store = new SqliteStore(':memory:');
    const effective = assertPersistence({ storage: store }, req({ durable: true, atomic: true, conditional: true }), 'test');
    expect(effective.durable).toBe(true);
    expect(effective.storage.mode).toBe('durably-acknowledged');
    store.close?.();
  });

  it('rejects a lenient adapter when strict is required', () => {
    const lenient = new SqliteStore(':memory:', { failurePolicy: 'lenient' });
    expect(() => assertPersistence({ storage: lenient }, req({ failurePolicy: 'strict' }), 'test')).toThrow(/lenient/);
    lenient.close?.();
  });

  it('needsArtifacts with no artifact store throws', () => {
    expect(() => assertPersistence({ storage: new MemoryStore() }, req({ needsArtifacts: true }), 'test')).toThrow(
      /no artifact store/,
    );
  });

  it('needsArtifacts with a read-only backend throws', () => {
    const artifacts = new ArtifactStore(memBackend({ writable: false }));
    expect(() => assertPersistence({ artifacts }, req({ needsArtifacts: true }), 'test')).toThrow(/read-only/);
  });

  it('needsArtifactDelete with a non-deletable backend throws', () => {
    const artifacts = new ArtifactStore(memBackend({ deletable: false }));
    expect(() =>
      assertPersistence({ artifacts }, req({ needsArtifacts: true, needsArtifactDelete: true }), 'test'),
    ).toThrow(/not deletable/);
  });

  it('durable:true requires a durable artifact floor too', () => {
    const store = new SqliteStore(':memory:');
    const artifacts = new ArtifactStore(memBackend({ acknowledge: 'volatile' }));
    expect(() =>
      assertPersistence({ storage: store, artifacts }, req({ durable: true, needsArtifacts: true }), 'test'),
    ).toThrow(/artifact backend acknowledges 'volatile'/);
    store.close?.();
  });

  it('needsArtifacts independent of durable: ephemeral KV + volatile artifacts is allowed', () => {
    const artifacts = new ArtifactStore(memBackend());
    const effective = assertPersistence({ artifacts }, req({ needsArtifacts: true }), 'test');
    expect(effective.durable).toBe(false);
    expect(effective.artifacts?.mode).toBe('volatile');
  });
});

describe('createScopedStorage', () => {
  it('scopes keys and does not expose close()', async () => {
    const store = new MemoryStore();
    const scoped = createScopedStorage(store, { principal: 'p', adapter: 'a', purpose: 'x' });
    await scoped.set('k', 1);
    expect(await scoped.get('k')).toBe(1);
    expect(await scoped.keys()).toEqual(['k']);
    expect((scoped as unknown as Record<string, unknown>).close).toBeUndefined();

    // The underlying store holds a namespaced key, so another scope cannot see it.
    const other = createScopedStorage(store, { principal: 'p', adapter: 'a', purpose: 'y' });
    expect(await other.get('k')).toBeNull();

    await scoped.clear();
    expect(await store.keys()).toEqual([]);
  });

  it('exposes a scoped CAS facade, not the raw store', async () => {
    const store = new MemoryStore();
    const scoped = createScopedStorage(store, { principal: 'p', adapter: 'a', purpose: 'x' });
    expect(scoped.cas).toBeDefined();
    const first = await scoped.cas!.conditionalUpdate<number>('c', (cur) => ({ next: (cur ?? 0) + 1 }));
    expect(first.applied).toBe(true);
    expect(first.value).toBe(1);
    // Scoped, so the raw key is not visible at the top level.
    expect(await store.get('c')).toBeNull();
  });
});

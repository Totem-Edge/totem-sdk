/**
 * Storage adapter tests — BareFileStore and BareKVStore
 *
 * All tests run on Node.js (CI proxy for Bare).
 *
 * BareFileStore: uses a real temporary JSON file via injected node:fs mock.
 * BareKVStore:   uses an injected in-memory Hyperbee mock so no real Hypercore
 *               or disk access is needed — the KVStore logic is fully exercised.
 */

import { BareFileStore } from '../storage/BareFileStore';
import { BareKVStore } from '../storage/BareKVStore';
import type { HypebeeLike } from '../storage/BareKVStore';
import type { FsLike } from '../storage/BareFileStore';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';

// ── BareFileStore ─────────────────────────────────────────────────────────────

describe('BareFileStore', () => {
  const filePath = join(tmpdir(), `bare-file-store-test-${Date.now()}.json`);

  afterAll(() => {
    if (existsSync(filePath)) unlinkSync(filePath);
  });

  let store: BareFileStore;
  beforeEach(() => {
    store = new BareFileStore({ filePath });
  });

  it('returns null for a missing key', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('write → read round-trip', async () => {
    await store.set('hello', 'world');
    // Allow the scheduled flush to run
    await new Promise(r => setImmediate(r));
    expect(await store.get('hello')).toBe('world');
  });

  it('stores objects', async () => {
    await store.set('obj', { a: 1, b: [2, 3] });
    expect(await store.get('obj')).toEqual({ a: 1, b: [2, 3] });
  });

  it('has() returns true after set, false before', async () => {
    expect(await store.has('key-x')).toBe(false);
    await store.set('key-x', 42);
    expect(await store.has('key-x')).toBe(true);
  });

  it('keys() lists all keys', async () => {
    const fresh = new BareFileStore({ filePath: join(tmpdir(), `bare-keys-${Date.now()}.json`) });
    await fresh.set('a', 1);
    await fresh.set('b', 2);
    const k = await fresh.keys();
    expect(k.sort()).toEqual(['a', 'b']);
  });

  it('remove() deletes key and returns true', async () => {
    await store.set('to-del', 'bye');
    const removed = await store.remove('to-del');
    expect(removed).toBe(true);
    expect(await store.get('to-del')).toBeNull();
  });

  it('remove() returns false for missing key', async () => {
    expect(await store.remove('no-such-key')).toBe(false);
  });

  it('clear() empties the store', async () => {
    await store.set('x', 1);
    await store.set('y', 2);
    await store.clear();
    expect(await store.keys()).toEqual([]);
  });

  it('data survives a reload from disk', async () => {
    const path2 = join(tmpdir(), `bare-reload-${Date.now()}.json`);
    const store1 = new BareFileStore({ filePath: path2 });
    await store1.set('persistent', 'yes');
    await store1.flush();

    const store2 = new BareFileStore({ filePath: path2 });
    expect(await store2.get('persistent')).toBe('yes');

    if (existsSync(path2)) unlinkSync(path2);
  });

  it('accepts injected fs mock — no real file I/O', async () => {
    const mem: Record<string, string> = {};
    const mockFs: FsLike = {
      readFileSync: (p, _enc) => mem[p] ?? '',
      writeFileSync: (p, data, _enc) => { mem[p] = String(data); },
      existsSync: (p) => p in mem,
      mkdirSync: () => {},
    };
    const mockPath = '/fake/store.json';
    const mockStore = new BareFileStore({ filePath: mockPath, fs: mockFs });
    await mockStore.set('injected', 'value');
    await mockStore.flush();
    expect(JSON.parse(mem[mockPath] ?? '{}')).toMatchObject({ injected: 'value' });
    expect(await mockStore.get('injected')).toBe('value');
  });
});

// ── BareKVStore (in-memory Hyperbee mock) ─────────────────────────────────────

function makeInMemoryBee(): HypebeeLike {
  const _store = new Map<string, unknown>();
  return {
    ready: async () => {},
    get: async (key) => {
      const v = _store.get(key);
      return v !== undefined ? { value: v } : null;
    },
    put: async (key, value) => { _store.set(key, value); },
    del: async (key) => { _store.delete(key); },
    createReadStream: async function* () {
      for (const key of _store.keys()) {
        yield { key };
      }
    },
    close: async () => {},
  };
}

describe('BareKVStore (in-memory mock)', () => {
  let store: BareKVStore;

  beforeEach(() => {
    store = new BareKVStore({ _bee: makeInMemoryBee() });
  });

  afterEach(async () => {
    await store.close();
  });

  it('returns null for a missing key', async () => {
    expect(await store.get('missing')).toBeNull();
  });

  it('write → read round-trip', async () => {
    await store.set('greet', 'hello');
    expect(await store.get('greet')).toBe('hello');
  });

  it('stores objects', async () => {
    await store.set('obj', { x: 10 });
    expect(await store.get('obj')).toEqual({ x: 10 });
  });

  it('has() reflects set/del', async () => {
    expect(await store.has('k')).toBe(false);
    await store.set('k', true);
    expect(await store.has('k')).toBe(true);
  });

  it('keys() lists all inserted keys', async () => {
    await store.set('a', 1);
    await store.set('b', 2);
    expect((await store.keys()).sort()).toEqual(['a', 'b']);
  });

  it('remove() deletes and returns true', async () => {
    await store.set('del-me', 99);
    expect(await store.remove('del-me')).toBe(true);
    expect(await store.get('del-me')).toBeNull();
  });

  it('remove() returns false for absent key', async () => {
    expect(await store.remove('ghost')).toBe(false);
  });

  it('clear() empties the store', async () => {
    await store.set('p', 1);
    await store.set('q', 2);
    await store.clear();
    expect(await store.keys()).toEqual([]);
  });
});

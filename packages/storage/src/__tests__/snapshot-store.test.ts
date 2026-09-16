/**
 * Revision-CAS snapshot store tests (RFC-007 §4.2: revision-CAS update,
 * no silent downgrade, state versioning, corruption surfaced — never absent).
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '../adapters/memory-store.js';
import { FileStore } from '../adapters/file-store.js';
import { SqliteStore } from '../adapters/sqlite-store.js';
import { createRevisionedSnapshotStore, SNAPSHOT_RECORD_VERSION } from '../snapshot.js';
import { StorageError } from '../errors.js';

interface CounterState {
  value: number;
  log: string[];
}

const VOLATILE = { requireAckMode: 'volatile' as const };

function counterStore(adapter: Parameters<typeof createRevisionedSnapshotStore<CounterState>>[0]) {
  return createRevisionedSnapshotStore<CounterState>(adapter, {
    ...VOLATILE,
    empty: () => ({ value: 0, log: [] }),
  });
}

describe('createRevisionedSnapshotStore', () => {
  describe('MemoryStore (volatile)', () => {
    let adapter: MemoryStore;
    let store: ReturnType<typeof counterStore>;

    beforeEach(() => {
      adapter = new MemoryStore();
      store = counterStore(adapter);
    });

    it('starts empty, adopts empty() state and revision 0', async () => {
      expect(await store.load()).toEqual({ value: 0, log: [] });
      expect(await store.getRevision()).toBe(0);
      expect(await store.hasState()).toBe(false);
    });

    it('persists mutations and advances revision per transition', async () => {
      const r1 = await store.mutate((s) => ({ value: s.value + 1, log: [...s.log, 'a'] }));
      expect(r1.revision).toBe(1);
      expect(r1.version).toBe(SNAPSHOT_RECORD_VERSION);
      const r2 = await store.mutate((s) => ({ value: s.value + 1, log: [...s.log, 'b'] }));
      expect(r2.revision).toBe(2);
      expect(r2.state).toEqual({ value: 2, log: ['a', 'b'] });
      expect(await store.getRevision()).toBe(2);
      expect(await store.hasState()).toBe(true);
      expect((await store.getRecord()).state).toEqual({ value: 2, log: ['a', 'b'] });
    });

    it('serializes concurrent mutations without losing updates (revision-CAS)', async () => {
      const N = 25;
      await Promise.all(
        Array.from({ length: N }, (_, i) =>
          store.mutate((s) => ({ value: s.value + 1, log: [...s.log, `op-${i}`] })),
        ),
      );
      const final = await store.load();
      expect(final.value).toBe(N);
      expect(final.log).toHaveLength(N);
    });

    it('persists JSON-clean records (undefined dropped, array holes → null)', async () => {
      interface WeirdState extends CounterState {
        dropMe?: string;
        list: Array<string | null | undefined>;
      }
      const weird = createRevisionedSnapshotStore<WeirdState>(adapter, {
        ...VOLATILE,
        empty: () => ({ value: 0, log: [], list: [] }),
      });
      await weird.mutate(() => ({ value: 1, log: [], dropMe: undefined, list: ['a', undefined, 'b'] }));
      const loaded = await weird.load();
      expect('dropMe' in loaded).toBe(false);
      expect(loaded.list).toEqual(['a', null, 'b']);
      expect(loaded.value).toBe(1);
    });

    it('rejects a voluntary-volatile adapter under the durable default (no silent downgrade)', () => {
      expect(() =>
        createRevisionedSnapshotStore<CounterState>(adapter, {
          empty: () => ({ value: 0, log: [] }),
        }),
      ).toThrow(/acknowledges "volatile" but consumer requires "durably-acknowledged"/);
    });

    it('rejects an adapter that cannot provide CAS', () => {
      const noCas = {
        capabilities: {
          acknowledge: 'durably-acknowledged' as const,
          atomic: false,
          conditional: false,
        },
        async get<T>() { return null; },
      };
      expect(() =>
        createRevisionedSnapshotStore<CounterState>(noCas as unknown as Parameters<typeof counterStore>[0], {
          ...VOLATILE,
          empty: () => ({ value: 0, log: [] }),
        }),
      ).toThrow(/conditional \(CAS\) writes/);
    });
  });

  describe('FileStore (durably-acknowledged, reopen)', () => {
    let dir: string;
    let adapter: FileStore;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-snapshot-'));
      adapter = new FileStore(dir);
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('survives a full store restart over the same directory (reopen)', async () => {
      const first = createRevisionedSnapshotStore<CounterState>(adapter, {
        empty: () => ({ value: 0, log: [] }),
      });
      await first.mutate((s) => ({ value: s.value + 7, log: [...s.log, 'survives'] }));
      await first.mutate((s) => ({ value: s.value + 1, log: [...s.log, 'restart-ready'] }));

      // Fresh process-equivalent: a brand-new store instance over the same dir.
      const reopened = createRevisionedSnapshotStore<CounterState>(adapter, {
        empty: () => ({ value: 0, log: [] }),
      });
      expect((await reopened.load()).value).toBe(8);
      expect((await reopened.getRevision())).toBe(2);
      expect(await reopened.hasState()).toBe(true);
    });

    it('surfaces tampered bytes as StorageError corrupt — never treated as absent', async () => {
      const store = createRevisionedSnapshotStore<CounterState>(adapter, {
        empty: () => ({ value: 0, log: [] }),
      });
      await store.mutate((s) => ({ value: s.value + 1, log: ['durable'] }));

      // Corrupt the on-disk record bytes directly.
      const files = await fs.readdir(dir);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        if (file.startsWith('.tmp')) continue;
        await fs.writeFile(join(dir, file), Buffer.from('TAMPERED'));
      }

      await expect(store.load()).rejects.toThrow(StorageError);
      await expect(adapter.get('totem_snapshot:v1:snapshot')).rejects.toMatchObject({ code: 'corrupt' });
    });

    it('refuses to open a structurally invalid record as corrupt', async () => {
      const store = createRevisionedSnapshotStore<CounterState>(adapter, {
        empty: () => ({ value: 0, log: [] }),
      });
      await store.mutate((s) => ({ value: 1, log: [] }));

      // Clobber the record with a value that is not a valid envelope.
      await adapter.set('totem_snapshot:v1:snapshot', { nope: true });
      await expect(store.load()).rejects.toMatchObject({ code: 'corrupt' });
      await expect(store.mutate((s) => s)).rejects.toMatchObject({ code: 'corrupt' });
    });

    it('refuses to open a record carrying a future state version', async () => {
      const store = createRevisionedSnapshotStore<CounterState>(adapter, {
        empty: () => ({ value: 0, log: [] }),
      });
      await store.mutate((s) => ({ value: 1, log: [] }));

      await adapter.set('totem_snapshot:v1:snapshot', {
        version: SNAPSHOT_RECORD_VERSION + 1,
        revision: 1,
        state: { value: 1, log: [] },
        savedAt: 1,
      });
      await expect(store.load()).rejects.toMatchObject({
        code: 'corrupt',
        details: { unsupportedVersion: 2 },
      });
      // And it is not silently reinitialised.
      expect((await store.hasState())).toBe(true);
    });
  });

  describe('SqliteStore (durably-acknowledged, CAS + reopen)', () => {
    let dir: string;
    let path: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-snapshot-sqlite-'));
      path = join(dir, 'state.sqlite');
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('persists across restarts with SQLite-level CAS', async () => {
      const adapter1 = new SqliteStore(path);
      const store1 = createRevisionedSnapshotStore<CounterState>(adapter1, {
        empty: () => ({ value: 0, log: [] }),
      });
      await store1.mutate((s) => ({ value: s.value + 5, log: [...s.log, 'sqlite'] }));

      const adapter2 = new SqliteStore(path);
      const store2 = createRevisionedSnapshotStore<CounterState>(adapter2, {
        empty: () => ({ value: 0, log: [] }),
      });
      expect((await store2.load()).value).toBe(5);
      expect((await store2.getRevision())).toBe(1);
    });
  });
});
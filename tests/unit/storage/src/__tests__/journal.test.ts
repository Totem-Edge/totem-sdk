/**
 * Append-only journal tests (RFC-007 §4.2).
 *
 * Covers: ordered replay + collision-free sequences, crash between head-bump
 * and entry write (unrecorded tail repaired by recover()), corruption surfaced
 * (mid-range hole, bad head, unsupported/undeclared-migration versions — never
 * treated as absent), and reopen survival on FileStore and SqliteStore.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '../adapters/memory-store.js';
import { FileStore } from '../adapters/file-store.js';
import { SqliteStore } from '../adapters/sqlite-store.js';
import { createJournal, JOURNAL_RECORD_VERSION, type Journal } from '../journal.js';
import { StorageError } from '../errors.js';

interface AuditRecord {
  kind: string;
  refId: string;
  usage?: { tokensIn?: number; tokensOut?: number };
}

const VOLATILE = { requireAckMode: 'volatile' as const };

function recordOf(kind: string, refId: string, usage?: AuditRecord['usage']): AuditRecord {
  return { kind, refId, usage };
}

function makeJournal(adapter: Parameters<typeof createJournal<AuditRecord>>[0]) {
  return createJournal<AuditRecord>(adapter, VOLATILE);
}

describe('createJournal', () => {
  describe('MemoryStore (volatile) — parity', () => {
    let adapter: MemoryStore;
    let journal: Journal<AuditRecord>;

    beforeEach(() => {
      adapter = new MemoryStore();
      journal = makeJournal(adapter);
    });

    it('starts empty at seq 0 with no state', async () => {
      expect(await journal.getHead()).toBe(0);
      expect(await journal.count()).toBe(0);
      expect(await journal.hasState()).toBe(false);
      expect(await journal.read()).toEqual([]);
    });

    it('appends records with ascending collision-free sequences', async () => {
      const a = await journal.append(recordOf('usage', 'run-a', { tokensIn: 10, tokensOut: 4 }));
      const b = await journal.append(recordOf('usage', 'run-b'));
      expect(a.seq).toBe(1);
      expect(a.version).toBe(JOURNAL_RECORD_VERSION);
      expect(b.seq).toBe(2);
      expect(await journal.count()).toBe(2);
      expect(await journal.getHead()).toBe(2);
      expect(await journal.hasState()).toBe(true);
    });

    it('replays ascending and supports readSince/tail', async () => {
      await journal.append(recordOf('usage', 'r1'));
      await journal.append(recordOf('usage', 'r2'));
      await journal.append(recordOf('usage', 'r3'));
      const all = await journal.read();
      expect(all.map((e) => e.seq)).toEqual([1, 2, 3]);
      expect((await journal.readSince(2)).map((e) => e.seq)).toEqual([3]);
      expect((await journal.tail(2)).map((e) => e.seq)).toEqual([2, 3]);
      expect((await journal.read(2, 3)).map((e) => e.seq)).toEqual([2, 3]);
    });

    it('appendBatch preserves order', async () => {
      const entries = await journal.appendBatch([recordOf('usage', 'a'), recordOf('usage', 'b')]);
      expect(entries.map((e) => e.seq)).toEqual([1, 2]);
      expect(entries.map((e) => e.record.refId)).toEqual(['a', 'b']);
    });

    it('serializes concurrent appends without sequence collisions', async () => {
      const N = 25;
      const entries = await Promise.all(
        Array.from({ length: N }, (_, i) => journal.append(recordOf('usage', `c-${i}`))),
      );
      const seqs = entries.map((e) => e.seq).sort((x, y) => x - y);
      expect(seqs).toEqual(Array.from({ length: N }, (_, i) => i + 1));
    });

    it('rejects a voluntary-volatile adapter under the durable default (no silent downgrade)', () => {
      expect(() => createJournal<AuditRecord>(adapter, {})).toThrow(
        /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
      );
    });

    it('rejects an adapter that cannot provide CAS', () => {
      const noCas = {
        capabilities: {
          acknowledge: 'durably-acknowledged' as const,
          atomic: false,
          conditional: false,
        },
        async get<T>() {
          return null;
        },
      };
      expect(() => createJournal<AuditRecord>(noCas as never, VOLATILE)).toThrow(/conditional \(CAS\) writes/);
    });
  });

  describe('FileStore (durably-acknowledged, reopen + corruption)', () => {
    let dir: string;
    let adapter: FileStore;
    let journal: Journal<AuditRecord>;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-journal-'));
      adapter = new FileStore(dir);
      journal = makeJournal(adapter);
    });

    afterEach(async () => {
      await journal;
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('survives a full restart over the same directory (reopen)', async () => {
      await journal.appendBatch([
        recordOf('usage', 'r1', { tokensIn: 11, tokensOut: 2 }),
        recordOf('usage', 'r2'),
        recordOf('usage', 'r3'),
      ]);

      const reopened = makeJournal(adapter);
      const all = await reopened.read();
      expect(all).toHaveLength(3);
      expect(all[0].record).toEqual(recordOf('usage', 'r1', { tokensIn: 11, tokensOut: 2 }));
      expect(await reopened.getHead()).toBe(3);
      expect(await reopened.count()).toBe(3);
      expect(await reopened.hasState()).toBe(true);
    });

    it('recovers an unrecorded tail (crash between head bump and entry write)', async () => {
      await journal.append(recordOf('usage', 'r1'));
      await journal.append(recordOf('usage', 'r2'));
      expect(await journal.getHead()).toBe(2);

      // Simulate the torn write: head advanced to 4, but entry 3/4 never landed.
      await adapter.set('totem_journal:v1:head', 4);
      const report = await makeJournal(adapter).recover();
      expect(report.repairedUnrecordedTail).toBe(true);
      expect(report.headBefore).toBe(4);
      expect(report.headAfter).toBe(2);

      // Appends continue cleanly after repair.
      const resumed = makeJournal(adapter);
      const e = await resumed.append(recordOf('usage', 'r3'));
      expect(e.seq).toBe(3);
      expect((await resumed.read()).map((x) => x.record.refId)).toEqual(['r1', 'r2', 'r3']);
    });

    it('surfaces a hole below the contiguous tail as corrupt — never absent', async () => {
      await journal.append(recordOf('usage', 'r1'));
      await journal.append(recordOf('usage', 'r2'));
      await journal.append(recordOf('usage', 'r3'));
      // Remove a durably-recorded middle entry directly on disk.
      await adapter.remove('totem_journal:v1:entry:2');
      await expect(journal.read()).rejects.toMatchObject({ code: 'corrupt' });
      await expect(journal.recover()).rejects.toMatchObject({ code: 'corrupt' });
      expect(await journal.hasState()).toBe(true);
    });

    it('surfaces a corrupt head as corrupt', async () => {
      await adapter.set('totem_journal:v1:head', 'not-a-number');
      await expect(journal.getHead()).rejects.toMatchObject({ code: 'corrupt' });
      await expect(journal.read()).rejects.toMatchObject({ code: 'corrupt' });
    });

    it('refuses an unsupported future record version rather than opening', async () => {
      await adapter.set('totem_journal:v1:entry:1', {
        version: 99, seq: 1, createdAt: Date.now(), record: { kind: 'usage', refId: 'future' },
      });
      await adapter.set('totem_journal:v1:head', 1);
      await expect(journal.read()).rejects.toMatchObject({ code: 'corrupt' });
    });

    it('forward-migrates an older record version via a declared hook', async () => {
      // Legacy shape: { usageKind, id } instead of { kind, refId }.
      await adapter.set('totem_journal:v1:entry:1', {
        version: 1, seq: 1, createdAt: 1_000_000, record: { usageKind: 'usage', id: 'legacy' },
      });
      await adapter.set('totem_journal:v1:head', 1);
      const migrated = createJournal<AuditRecord>(adapter, {
        migrate: (version, raw) => {
          const legacy = raw as { usageKind: string; id: string };
          return { kind: legacy.usageKind, refId: legacy.id };
        },
      });
      const entry = (await migrated.read())[0];
      expect(entry.version).toBe(1);
      expect(entry.record).toEqual({ kind: 'usage', refId: 'legacy' });
    });

    it('refuses an older version when no migration is declared (no silent reinterpretation)', async () => {
      await adapter.set('totem_journal:v1:entry:1', {
        version: 1, seq: 1, createdAt: 1_000_000, record: { usageKind: 'usage', id: 'legacy' },
      });
      await adapter.set('totem_journal:v1:head', 1);
      await expect(journal.read()).rejects.toThrow(/migration that is not declared/);
    });

    it('validate hook runs on append and read', async () => {
      const strict = createJournal<{ kind: string }>(adapter, {
        validate: (r) => {
          if (r.kind === 'boom') throw new StorageError('forbidden kind', 'write-failed');
        },
      });
      await expect(strict.append({ kind: 'boom' })).rejects.toThrow(/forbidden kind/);
      await strict.append({ kind: 'ok' });
    });
  });

  describe('SqliteStore (durably-acknowledged, reopen)', () => {
    it('survives reopen on a file path', async () => {
      const dir = await fs.mkdtemp(join(tmpdir(), 'totem-journal-sqlite-'));
      const path = join(dir, 'journal.db');
      try {
        const first = createJournal<AuditRecord>(new SqliteStore(path), VOLATILE);
        await first.append(recordOf('usage', 's1', { tokensIn: 3 }));
        await first.append(recordOf('usage', 's2'));

        const reopened = createJournal<AuditRecord>(new SqliteStore(path), VOLATILE);
        const all = await reopened.read();
        expect(all.map((e) => e.record.refId)).toEqual(['s1', 's2']);
        expect(await reopened.count()).toBe(2);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });
});
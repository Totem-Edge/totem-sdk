/**
 * Durable channel snapshot store tests (RFC-007 G6).
 *
 * A storage-backed `ChannelSnapshotStore` for Omnia pool orchestration: saved
 * serialized channel snapshots survive a full re-open, are isolated per
 * namespace, and a volatile adapter is never silently downgraded.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableChannelSnapshotStore } from '../durable-channel-store.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

const SNAPSHOT_A = JSON.stringify({ channelId: 'ch-1', version: 1, payload: { balance: '400' } });
const SNAPSHOT_B = JSON.stringify({ channelId: 'ch-2', version: 1, payload: { balance: '300' } });

describe('createDurableChannelSnapshotStore', () => {
  describe('MemoryStore (volatile) — port parity', () => {
    let store: ReturnType<typeof createDurableChannelSnapshotStore>;

    beforeEach(() => {
      store = createDurableChannelSnapshotStore(new MemoryStore(), VOLATILE);
    });

    it('round-trips an opaque channel snapshot verbatim', async () => {
      await store.set('ch-1', SNAPSHOT_A);
      expect(await store.get('ch-1')).toBe(SNAPSHOT_A);
    });

    it('returns undefined for a missing channel (port default)', async () => {
      expect(await store.get('ch-missing')).toBeUndefined();
      expect(await store.has('ch-missing')).toBe(false);
    });

    it('tracks keys() and supports remove()', async () => {
      await store.set('ch-1', SNAPSHOT_A);
      await store.set('ch-2', SNAPSHOT_B);
      expect(await store.keys()).toEqual(['ch-1', 'ch-2']);
      expect(await store.remove('ch-1')).toBe(true);
      expect(await store.keys()).toEqual(['ch-2']);
      expect(await store.get('ch-1')).toBeUndefined();
    });

    it('last-writer-wins per channel', async () => {
      await store.set('ch-1', SNAPSHOT_A);
      await store.set('ch-1', SNAPSHOT_B);
      expect(await store.get('ch-1')).toBe(SNAPSHOT_B);
    });

    it('isolates distinct namespaces over the same adapter', async () => {
      const adapter = new MemoryStore();
      const a = createDurableChannelSnapshotStore(adapter, { ...VOLATILE, namespace: 'pool-a:' });
      const b = createDurableChannelSnapshotStore(adapter, { ...VOLATILE, namespace: 'pool-b:' });
      await a.set('ch-1', SNAPSHOT_A);
      await b.set('ch-1', SNAPSHOT_B);
      expect(await a.get('ch-1')).toBe(SNAPSHOT_A);
      expect(await b.get('ch-1')).toBe(SNAPSHOT_B);
      expect(await a.keys()).toEqual(['ch-1']);
    });

    it('survives a full store restart over the same adapter (reopen)', async () => {
      const adapter = new MemoryStore();
      const first = createDurableChannelSnapshotStore(adapter, VOLATILE);
      await first.set('ch-1', SNAPSHOT_A);
      await first.set('ch-2', SNAPSHOT_B);

      const reopened = createDurableChannelSnapshotStore(adapter, VOLATILE);
      expect(await reopened.get('ch-1')).toBe(SNAPSHOT_A);
      expect(await reopened.get('ch-2')).toBe(SNAPSHOT_B);
      expect(await reopened.keys()).toEqual(['ch-1', 'ch-2']);
    });
  });

  describe('FileStore (durably-acknowledged) — durable close/reopen', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-omnia-pool-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('reopens on-disk snapshots after a brand-new store instance (snapshot reopen gate)', async () => {
      const adapter1 = new FileStore(dir);
      const first = createDurableChannelSnapshotStore(adapter1);
      await first.set('ch-1', SNAPSHOT_A);
      await first.set('ch-2', SNAPSHOT_B);

      const adapter2 = new FileStore(dir);
      const reopened = createDurableChannelSnapshotStore(adapter2);
      expect(await reopened.get('ch-1')).toBe(SNAPSHOT_A);
      expect(await reopened.get('ch-2')).toBe(SNAPSHOT_B);
      expect(await reopened.keys()).toEqual(['ch-1', 'ch-2']);
      expect(await reopened.has('ch-1')).toBe(true);
    });

    it('throws StorageError on tampered on-disk snapshot bytes', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableChannelSnapshotStore(adapter);
      await store.set('ch-1', SNAPSHOT_A);

      for (const file of await fs.readdir(dir)) {
        if (file.startsWith('.tmp')) continue;
        await fs.writeFile(join(dir, file), Buffer.from('TAMPERED'));
      }
      await expect(store.get('ch-1')).rejects.toThrow(StorageError);
    });
  });

  it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
    expect(() => createDurableChannelSnapshotStore(new MemoryStore())).toThrow(
      /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
    );
  });
});
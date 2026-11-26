/**
 * Durable VTXO/pool snapshot store tests (RFC-007 G6).
 *
 * Drop-in parity with `MemoryOmniaVtxoStore`, plus the Phase 3 gates:
 * reopen survival (including spent status + history), concurrent transition
 * safety (revision-CAS), bigint preservation, corrupt records surfaced
 * (never treated as absence), and no-silent-downgrade.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableOmniaVtxoStore } from '../durable-store.js';
import { createPool } from '../pool.js';
import { mintVtxo } from '../vtxo.js';
import { VtxoStatusError } from '../errors.js';

const VOLATILE = { requireAckMode: 'volatile' as const };
const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW,
  );
  const { pool: updatedPool, vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(400), nonce: 'mint-1' }, NOW);
  const { vtxo: v2 } = mintVtxo(updatedPool, { owner: 'bob', amount: BigInt(300), nonce: 'mint-2' }, NOW);
  return { pool: updatedPool, v1, v2 };
}

describe('createDurableOmniaVtxoStore', () => {
  describe('MemoryStore (volatile) — drop-in parity with MemoryOmniaVtxoStore', () => {
    let store: ReturnType<typeof createDurableOmniaVtxoStore>;

    beforeEach(() => {
      store = createDurableOmniaVtxoStore(new MemoryStore(), VOLATILE);
    });

    it('saves and retrieves a pool', async () => {
      const { pool } = setup();
      await store.savePool(pool);
      const retrieved = await store.getPool(pool.poolId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.poolId).toBe(pool.poolId);
      expect(retrieved?.totalCapacity).toBe(pool.totalCapacity);
      expect(retrieved?.policy).toEqual(pool.policy);
    });

    it('returns undefined for missing pool', async () => {
      expect(await store.getPool('non-existent')).toBeUndefined();
    });

    it('saves and retrieves a vtxo', async () => {
      const { v1 } = setup();
      await store.saveVtxo(v1);
      const retrieved = await store.getVtxo(v1.vtxoId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.vtxoId).toBe(v1.vtxoId);
      expect(retrieved?.amount).toBe(v1.amount);
      expect(retrieved?.history).toEqual(v1.history);
    });

    it('returns undefined for missing vtxo', async () => {
      expect(await store.getVtxo('non-existent')).toBeUndefined();
    });

    it('lists all vtxos', async () => {
      const { v1, v2 } = setup();
      await store.saveVtxo(v1);
      await store.saveVtxo(v2);
      const all = await store.listVtxos();
      expect(all).toHaveLength(2);
    });

    it('lists vtxos filtered by poolId', async () => {
      const { v1, v2, pool } = setup();
      await store.saveVtxo(v1);
      await store.saveVtxo(v2);

      const pool2 = createPool({ operator: 'op-2', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n2' }, NOW);
      const { vtxo: v3 } = mintVtxo(pool2, { owner: 'carol', amount: BigInt(100), nonce: 'mint-3' }, NOW);
      await store.saveVtxo(v3);

      const forPool1 = await store.listVtxos(pool.poolId);
      expect(forPool1).toHaveLength(2);
      for (const v of forPool1) expect(v.poolId).toBe(pool.poolId);
    });

    it('marks a vtxo as spent with a history entry', async () => {
      const { v1 } = setup();
      await store.saveVtxo(v1);
      await store.markVtxoSpent(v1.vtxoId, NOW + 1);
      const retrieved = await store.getVtxo(v1.vtxoId);
      expect(retrieved?.status).toBe('spent');
      expect(retrieved?.updatedAt).toBe(NOW + 1);
      expect(retrieved?.history.at(-1)).toEqual({ op: 'spent', at: NOW + 1 });
    });

    it('throws VtxoStatusError when marking already-spent vtxo', async () => {
      const { v1 } = setup();
      await store.saveVtxo(v1);
      await store.markVtxoSpent(v1.vtxoId, NOW + 1);
      await expect(store.markVtxoSpent(v1.vtxoId, NOW + 2)).rejects.toThrow(VtxoStatusError);
    });

    it('throws the same plain Error as MemoryOmniaVtxoStore for a missing vtxo', async () => {
      await expect(store.markVtxoSpent('non-existent', NOW)).rejects.toThrow(
        'VTXO non-existent not found',
      );
    });

    it('survives a full store restart over the same adapter (reopen)', async () => {
      const adapter = new MemoryStore();
      const first = createDurableOmniaVtxoStore(adapter, VOLATILE);
      const { pool, v1, v2 } = setup();
      await first.savePool(pool);
      await first.saveVtxo(v1);
      await first.saveVtxo(v2);

      const reopened = createDurableOmniaVtxoStore(adapter, VOLATILE);
      expect(await reopened.getPool(pool.poolId)).toBeDefined();
      expect(await reopened.listVtxos()).toHaveLength(2);
      expect(await reopened.getRevision()).toBe(3);
      expect(await reopened.hasState()).toBe(true);
    });

    it('keeps bigint-typed amounts as bigint through the store', async () => {
      const adapter = new MemoryStore();
      const first = createDurableOmniaVtxoStore(adapter, VOLATILE);
      const { v1 } = setup();
      await first.saveVtxo(v1);

      const raw = await adapter.get<{ state: { vtxos: Record<string, { amount: bigint }> } }>('totem_omnia_vtxo:v1:snapshot');
      expect(raw?.state.vtxos[v1.vtxoId].amount).toBe(400n);
    });

    it('serializes concurrent saves without a lost update (revision-CAS)', async () => {
      const store = createDurableOmniaVtxoStore(new MemoryStore(), VOLATILE);
      const { pool, v1 } = setup();
      await Promise.all([
        store.savePool(pool),
        ...Array.from({ length: 19 }, (_, i) => {
          const { vtxo } = mintVtxo(pool, { owner: `u-${i}`, amount: BigInt(10 + i), nonce: `mint-c${i}` }, NOW);
          return store.saveVtxo(vtxo);
        }),
        store.saveVtxo(v1),
      ]);
      expect(await store.listVtxos()).toHaveLength(20);
    });
  });

  describe('FileStore (durably-acknowledged) — durable close/reopen', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-omnia-vtxo-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('does not fail-open on a corrupt registry record (strict)', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableOmniaVtxoStore(adapter);
      const { v1 } = setup();
      await store.saveVtxo(v1);

      await adapter.set('totem_omnia_vtxo:v1:snapshot', { shreds: true });

      await expect(store.getVtxo(v1.vtxoId)).rejects.toMatchObject({ code: 'corrupt' });
      // The record is present-but-broken — presence is never reinitialised away.
      expect(await store.hasState()).toBe(true);
    });

    it('reopens on-disk state after a brand-new store instance, spent status intact (registry reopen gate)', async () => {
      const adapter1 = new FileStore(dir);
      const first = createDurableOmniaVtxoStore(adapter1);
      const { pool, v1, v2 } = setup();
      await first.savePool(pool);
      await first.saveVtxo(v1);
      await first.saveVtxo(v2);
      await first.markVtxoSpent(v2.vtxoId, NOW + 5);

      const adapter2 = new FileStore(dir);
      const reopened = createDurableOmniaVtxoStore(adapter2);
      expect(await reopened.getPool(pool.poolId)).toBeDefined();
      const all = await reopened.listVtxos();
      expect(all).toHaveLength(2);
      expect(all.find((v) => v.vtxoId === v1.vtxoId)?.status).toBe('active');
      const spent = all.find((v) => v.vtxoId === v2.vtxoId);
      expect(spent?.status).toBe('spent');
      expect(spent?.history.at(-1)).toEqual({ op: 'spent', at: NOW + 5 });
    });

    it('throws StorageError on tampered on-disk bytes', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableOmniaVtxoStore(adapter);
      const { v1 } = setup();
      await store.saveVtxo(v1);

      for (const file of await fs.readdir(dir)) {
        if (file.startsWith('.tmp')) continue;
        await fs.writeFile(join(dir, file), Buffer.from('TAMPERED'));
      }
      await expect(store.listVtxos()).rejects.toThrow(StorageError);
    });
  });

  it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
    expect(() => createDurableOmniaVtxoStore(new MemoryStore())).toThrow(
      /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
    );
  });
});
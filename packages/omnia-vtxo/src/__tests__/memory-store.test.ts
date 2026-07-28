import { MemoryOmniaVtxoStore } from '../memory-store';
import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';
import { VtxoStatusError } from '../errors';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
  const { pool: updatedPool, vtxo: v1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(400), nonce: 'mint-1' }, NOW);
  const { vtxo: v2 } = mintVtxo(updatedPool, { owner: 'bob', amount: BigInt(300), nonce: 'mint-2' }, NOW);
  return { pool: updatedPool, v1, v2 };
}

describe('MemoryOmniaVtxoStore', () => {
  it('saves and retrieves a pool', async () => {
    const store = new MemoryOmniaVtxoStore();
    const { pool } = setup();
    await store.savePool(pool);
    const retrieved = await store.getPool(pool.poolId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.poolId).toBe(pool.poolId);
    expect(retrieved?.totalCapacity).toBe(pool.totalCapacity);
  });

  it('returns undefined for missing pool', async () => {
    const store = new MemoryOmniaVtxoStore();
    const result = await store.getPool('non-existent');
    expect(result).toBeUndefined();
  });

  it('saves and retrieves a vtxo', async () => {
    const store = new MemoryOmniaVtxoStore();
    const { v1 } = setup();
    await store.saveVtxo(v1);
    const retrieved = await store.getVtxo(v1.vtxoId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.vtxoId).toBe(v1.vtxoId);
    expect(retrieved?.amount).toBe(v1.amount);
  });

  it('returns undefined for missing vtxo', async () => {
    const store = new MemoryOmniaVtxoStore();
    const result = await store.getVtxo('non-existent');
    expect(result).toBeUndefined();
  });

  it('lists all vtxos', async () => {
    const store = new MemoryOmniaVtxoStore();
    const { v1, v2 } = setup();
    await store.saveVtxo(v1);
    await store.saveVtxo(v2);
    const all = await store.listVtxos();
    expect(all).toHaveLength(2);
  });

  it('lists vtxos filtered by poolId', async () => {
    const store = new MemoryOmniaVtxoStore();
    const { v1, v2, pool } = setup();

    const pool2 = createPool({ operator: 'op-2', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n2' }, NOW);
    const { vtxo: v3 } = mintVtxo(pool2, { owner: 'carol', amount: BigInt(100), nonce: 'mint-3' }, NOW);

    await store.saveVtxo(v1);
    await store.saveVtxo(v2);
    await store.saveVtxo(v3);

    const forPool1 = await store.listVtxos(pool.poolId);
    expect(forPool1).toHaveLength(2);
    for (const v of forPool1) expect(v.poolId).toBe(pool.poolId);
  });

  it('marks a vtxo as spent', async () => {
    const store = new MemoryOmniaVtxoStore();
    const { v1 } = setup();
    await store.saveVtxo(v1);
    await store.markVtxoSpent(v1.vtxoId, NOW + 1);
    const retrieved = await store.getVtxo(v1.vtxoId);
    expect(retrieved?.status).toBe('spent');
  });

  it('throws VtxoStatusError when marking already-spent vtxo', async () => {
    const store = new MemoryOmniaVtxoStore();
    const { v1 } = setup();
    await store.saveVtxo(v1);
    await store.markVtxoSpent(v1.vtxoId, NOW + 1);
    await expect(store.markVtxoSpent(v1.vtxoId, NOW + 2)).rejects.toThrow(VtxoStatusError);
  });
});

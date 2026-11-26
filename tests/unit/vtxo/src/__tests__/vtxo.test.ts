import { createPool } from '../pool';
import { mintVtxo, markVtxoSpent, isVtxoActive } from '../vtxo';
import { VtxoStatusError, VtxoPoolCapacityError } from '../errors';

const NOW = 1000;

function makePool() {
  return createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000), nonce: 'n1' },
    NOW
  );
}

describe('mintVtxo', () => {
  it('returns pool, vtxo, and receipt', () => {
    const pool = makePool();
    const { pool: newPool, vtxo, receipt } = mintVtxo(pool, { owner: 'alice', amount: BigInt(500), nonce: 'nonce-1' }, NOW);
    expect(vtxo.status).toBe('active');
    expect(vtxo.owner).toBe('alice');
    expect(vtxo.amount).toBe(BigInt(500));
    expect(vtxo.tokenId).toBe('token-0');
    expect(vtxo.poolId).toBe(pool.poolId);
    expect(receipt.op).toBe('mint');
    expect(receipt.outputIds).toContain(vtxo.vtxoId);
    expect(receipt.inputIds).toHaveLength(0);
    expect(newPool.availableCapacity).toBe(BigInt(1_000_000) - BigInt(500));
  });

  it('reduces availableCapacity', () => {
    const pool = makePool();
    const { pool: p1 } = mintVtxo(pool, { owner: 'alice', amount: BigInt(300), nonce: 'n1' }, NOW);
    const { pool: p2 } = mintVtxo(p1, { owner: 'bob', amount: BigInt(200), nonce: 'n2' }, NOW);
    expect(p2.availableCapacity).toBe(BigInt(1_000_000) - BigInt(500));
  });

  it('populates proof', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, NOW);
    expect(vtxo.proof.leaf).toHaveLength(64);
    expect(vtxo.proof.root).toHaveLength(64);
  });

  it('adds history entry', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, NOW);
    expect(vtxo.history[0].op).toBe('mint');
    expect(vtxo.history[0].at).toBe(NOW);
  });

  it('sets createdAt and updatedAt', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, 9999);
    expect(vtxo.createdAt).toBe(9999);
    expect(vtxo.updatedAt).toBe(9999);
  });

  it('throws when insufficient capacity', () => {
    const pool = createPool(
      { operator: 'op', tokenId: 't', totalCapacity: BigInt(100), nonce: 'n' },
      NOW
    );
    expect(() => mintVtxo(pool, { owner: 'alice', amount: BigInt(200), nonce: 'n1' }, NOW))
      .toThrow(VtxoPoolCapacityError);
  });

  it('sets expiresAt when provided', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1', expiresAt: 9999 }, NOW);
    expect(vtxo.expiresAt).toBe(9999);
  });
});

describe('markVtxoSpent', () => {
  it('marks active vtxo as spent', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, NOW);
    const spent = markVtxoSpent(vtxo, NOW + 1);
    expect(spent.status).toBe('spent');
    expect(spent.updatedAt).toBe(NOW + 1);
  });

  it('throws for non-active vtxo', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, NOW);
    const spent = markVtxoSpent(vtxo, NOW + 1);
    expect(() => markVtxoSpent(spent, NOW + 2)).toThrow(VtxoStatusError);
  });
});

describe('isVtxoActive', () => {
  it('returns true for active vtxo', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, NOW);
    expect(isVtxoActive(vtxo)).toBe(true);
  });

  it('returns false for spent vtxo', () => {
    const pool = makePool();
    const { vtxo } = mintVtxo(pool, { owner: 'alice', amount: BigInt(100), nonce: 'n1' }, NOW);
    const spent = markVtxoSpent(vtxo, NOW + 1);
    expect(isVtxoActive(spent)).toBe(false);
  });
});

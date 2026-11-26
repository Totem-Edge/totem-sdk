import { serializeVtxo, deserializeVtxo, serializePool, deserializePool } from '../serialization';
import { createPool } from '../pool';
import { mintVtxo } from '../vtxo';

const NOW = 1000;

function setup() {
  const pool = createPool(
    { operator: 'op-1', tokenId: 'token-0', totalCapacity: BigInt(1_000_000_000_000), nonce: 'n1' },
    NOW
  );
  const { pool: updatedPool, vtxo } = mintVtxo(
    pool,
    { owner: 'alice', amount: BigInt('999999999999'), nonce: 'mint-1' },
    NOW
  );
  return { pool: updatedPool, vtxo };
}

describe('VTXO serialization', () => {
  it('round-trips a VTXO with BigInt amounts', () => {
    const { vtxo } = setup();
    const json = serializeVtxo(vtxo);
    const restored = deserializeVtxo(json);
    expect(restored.vtxoId).toBe(vtxo.vtxoId);
    expect(restored.owner).toBe(vtxo.owner);
    expect(restored.amount).toBe(vtxo.amount);
    expect(typeof restored.amount).toBe('bigint');
    expect(restored.status).toBe(vtxo.status);
    expect(restored.poolId).toBe(vtxo.poolId);
    expect(restored.tokenId).toBe(vtxo.tokenId);
  });

  it('preserves BigInt precision for large values', () => {
    const { vtxo } = setup();
    const json = serializeVtxo(vtxo);
    const restored = deserializeVtxo(json);
    expect(restored.amount).toBe(BigInt('999999999999'));
  });

  it('serializes to a valid JSON string', () => {
    const { vtxo } = setup();
    const json = serializeVtxo(vtxo);
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('Pool serialization', () => {
  it('round-trips a pool with BigInt fields', () => {
    const { pool } = setup();
    const json = serializePool(pool);
    const restored = deserializePool(json);
    expect(restored.poolId).toBe(pool.poolId);
    expect(restored.totalCapacity).toBe(pool.totalCapacity);
    expect(typeof restored.totalCapacity).toBe('bigint');
    expect(restored.availableCapacity).toBe(pool.availableCapacity);
    expect(typeof restored.availableCapacity).toBe('bigint');
    expect(restored.policy.minAmount).toBe(pool.policy.minAmount);
    expect(typeof restored.policy.minAmount).toBe('bigint');
  });

  it('preserves BigInt precision for policy fields', () => {
    const { pool } = setup();
    const json = serializePool(pool);
    const restored = deserializePool(json);
    expect(restored.policy.maxAmount).toBe(pool.policy.maxAmount);
  });
});

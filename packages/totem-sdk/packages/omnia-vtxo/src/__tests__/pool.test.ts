import { createPool, assertPoolCanMint, updatePoolRoot, advancePoolEpoch } from '../pool';
import { VtxoPoolCapacityError, VtxoPolicyError } from '../errors';
import { CreatePoolParams } from '../types';

function makeParams(overrides: Partial<CreatePoolParams> = {}): CreatePoolParams {
  return {
    operator: 'op-1',
    tokenId: 'token-0',
    totalCapacity: BigInt(1_000_000),
    nonce: 'nonce-1',
    ...overrides,
  };
}

describe('createPool', () => {
  it('creates a pool with correct fields', () => {
    const pool = createPool(makeParams(), 1000);
    expect(pool.operator).toBe('op-1');
    expect(pool.tokenId).toBe('token-0');
    expect(pool.totalCapacity).toBe(BigInt(1_000_000));
    expect(pool.availableCapacity).toBe(BigInt(1_000_000));
    expect(pool.epoch).toBe(0);
    expect(pool.createdAt).toBe(1000);
    expect(pool.poolId).toHaveLength(64);
  });

  it('produces deterministic poolId from stable inputs', () => {
    const p1 = createPool(makeParams(), 1000);
    const p2 = createPool(makeParams(), 9999);
    expect(p1.poolId).toBe(p2.poolId);
  });

  it('produces different poolId for different nonce', () => {
    const p1 = createPool(makeParams({ nonce: 'n1' }), 1000);
    const p2 = createPool(makeParams({ nonce: 'n2' }), 1000);
    expect(p1.poolId).not.toBe(p2.poolId);
  });

  it('uses provided now parameter (not hidden Date.now)', () => {
    const pool = createPool(makeParams(), 42);
    expect(pool.createdAt).toBe(42);
  });

  it('applies default policy', () => {
    const pool = createPool(makeParams(), 1000);
    expect(pool.policy.minAmount).toBe(BigInt(1));
    expect(pool.policy.maxMergeInputs).toBe(8);
  });

  it('applies custom policy overrides', () => {
    const pool = createPool(makeParams({ policy: { minAmount: BigInt(100), maxMergeInputs: 4 } }), 1000);
    expect(pool.policy.minAmount).toBe(BigInt(100));
    expect(pool.policy.maxMergeInputs).toBe(4);
    expect(pool.policy.maxSplitOutputs).toBe(8);
  });

  it('throws for zero totalCapacity', () => {
    expect(() => createPool(makeParams({ totalCapacity: BigInt(0) }), 1000))
      .toThrow(VtxoPolicyError);
  });
});

describe('assertPoolCanMint', () => {
  it('passes for valid amount', () => {
    const pool = createPool(makeParams(), 1000);
    expect(() => assertPoolCanMint(pool, BigInt(500))).not.toThrow();
  });

  it('throws VtxoPolicyError for zero amount', () => {
    const pool = createPool(makeParams(), 1000);
    expect(() => assertPoolCanMint(pool, BigInt(0))).toThrow(VtxoPolicyError);
  });

  it('throws VtxoPoolCapacityError when amount exceeds availableCapacity', () => {
    const pool = createPool(makeParams({ totalCapacity: BigInt(100) }), 1000);
    expect(() => assertPoolCanMint(pool, BigInt(200))).toThrow(VtxoPoolCapacityError);
  });

  it('throws VtxoPolicyError when amount below minimum', () => {
    const pool = createPool(makeParams({ policy: { minAmount: BigInt(10) } }), 1000);
    expect(() => assertPoolCanMint(pool, BigInt(5))).toThrow(VtxoPolicyError);
  });

  it('throws VtxoPolicyError when amount above maximum', () => {
    const pool = createPool(makeParams({ policy: { maxAmount: BigInt(50) } }), 1000);
    expect(() => assertPoolCanMint(pool, BigInt(100))).toThrow(VtxoPolicyError);
  });
});

describe('updatePoolRoot', () => {
  it('updates commitment root immutably', () => {
    const pool = createPool(makeParams(), 1000);
    const updated = updatePoolRoot(pool, 'new-root');
    expect(updated.commitmentRoot).toBe('new-root');
    expect(pool.commitmentRoot).not.toBe('new-root');
  });
});

describe('advancePoolEpoch', () => {
  it('advances epoch', () => {
    const pool = createPool(makeParams(), 1000);
    const advanced = advancePoolEpoch(pool, 5);
    expect(advanced.epoch).toBe(5);
  });

  it('throws for same epoch', () => {
    const pool = createPool(makeParams(), 1000);
    expect(() => advancePoolEpoch(pool, 0)).toThrow(VtxoPolicyError);
  });

  it('throws for lower epoch', () => {
    const pool = advancePoolEpoch(createPool(makeParams(), 1000), 5);
    expect(() => advancePoolEpoch(pool, 3)).toThrow(VtxoPolicyError);
  });
});

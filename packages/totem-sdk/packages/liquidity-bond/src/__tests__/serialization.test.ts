import { serializeLiquidityBondState, parseLiquidityBondState, serializeLiquidityBondRecord, parseLiquidityBondRecord } from '../serialization.js';
import { createEmptyLiquidityBondRegistryState, registerLiquidityPool } from '../registry.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';

function makePool(id: string) {
  return createLiquidityPoolManifest({
    poolId: id, poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
    asset: 'MINIMA', lockTerms: { lockType: 'none' }, totalCapacity: 1000000000000n, createdAt: 1000,
  });
}

describe('serialization', () => {
  describe('BigInt round-trip', () => {
    it('preserves BigInt values', () => {
      const original = { amount: 1000000000000n, name: 'test' };
      const json = serializeLiquidityBondRecord(original);
      const parsed = parseLiquidityBondRecord<typeof original>(json);
      expect(parsed.amount).toBe(1000000000000n);
      expect(typeof parsed.amount).toBe('bigint');
    });
  });

  describe('full registry state round-trip', () => {
    it('serializes and parses registry state', () => {
      let state = createEmptyLiquidityBondRegistryState();
      state = registerLiquidityPool(state, makePool('pool-1'));
      state = registerLiquidityPool(state, makePool('pool-2'));

      const json = serializeLiquidityBondState(state);
      const parsed = parseLiquidityBondState(json) as ReturnType<typeof createEmptyLiquidityBondRegistryState>;

      expect(Object.keys(parsed.pools)).toHaveLength(2);
      expect(parsed.pools['pool-1'].poolId).toBe('pool-1');
      expect(parsed.pools['pool-2'].totalCapacity).toBe(1000000000000n);
    });
  });

  describe('deterministic key order', () => {
    it('produces same JSON regardless of key insertion order', () => {
      const obj1: Record<string, unknown> = {}; obj1['b'] = 2; obj1['a'] = 1;
      const obj2: Record<string, unknown> = {}; obj2['a'] = 1; obj2['b'] = 2;
      expect(serializeLiquidityBondRecord(obj1)).toBe(serializeLiquidityBondRecord(obj2));
    });
  });

  describe('reject NaN and Infinity', () => {
    it('throws on NaN', () => {
      expect(() => serializeLiquidityBondRecord({ value: NaN })).toThrow();
    });
    it('throws on Infinity', () => {
      expect(() => serializeLiquidityBondRecord({ value: Infinity })).toThrow();
    });
  });
});

import { serializeProviderBondState, parseProviderBondState, serializeProviderBondRecord, parseProviderBondRecord } from '../serialization.js';
import { createEmptyProviderBondRegistryState, registerProvider } from '../registry.js';
import { createProviderBondManifest } from '../manifest.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';

function makeManifest(providerId: string) {
  const edgeService: EdgeServiceManifest = {
    type: 'edge-service', serviceId: `svc-${providerId}`, name: 'Test', version: '1.0.0',
    operatorAddress: 'MxRoot', serviceType: 'lookup-provider', description: '',
    capabilities: [], tags: [],
  };
  return createProviderBondManifest({
    edgeService,
    providerBond: {
      providerId,
      bondStack: [
        { bondId: 'b-1', asset: 'MINIMA', amount: 1000000000000n, purpose: 'hard-collateral', lockType: 'manual-attestation', status: 'active' },
      ],
    },
  });
}

describe('serialization', () => {
  describe('BigInt round-trip', () => {
    it('preserves BigInt values', () => {
      const original = { amount: 1000000000000n, name: 'test' };
      const json = serializeProviderBondRecord(original);
      const parsed = parseProviderBondRecord<typeof original>(json);
      expect(parsed.amount).toBe(1000000000000n);
      expect(typeof parsed.amount).toBe('bigint');
      expect(parsed.name).toBe('test');
    });

    it('handles nested BigInt values', () => {
      const original = { bonds: [{ amount: 100n }, { amount: 200n }] };
      const json = serializeProviderBondRecord(original);
      const parsed = parseProviderBondRecord<typeof original>(json);
      expect(parsed.bonds[0].amount).toBe(100n);
      expect(parsed.bonds[1].amount).toBe(200n);
    });
  });

  describe('full state round-trip', () => {
    it('serializes and parses registry state', () => {
      let state = createEmptyProviderBondRegistryState();
      state = registerProvider(state, makeManifest('p-1'));
      state = registerProvider(state, makeManifest('p-2'));

      const json = serializeProviderBondState(state);
      const parsed = parseProviderBondState(json) as ReturnType<typeof createEmptyProviderBondRegistryState>;

      expect(Object.keys(parsed.providers)).toHaveLength(2);
      expect(parsed.providers['p-1'].providerBond.providerId).toBe('p-1');
      expect(parsed.providers['p-2'].providerBond.bondStack![0].amount).toBe(1000000000000n);
    });
  });

  describe('deterministic key order', () => {
    it('produces same JSON regardless of key insertion order', () => {
      const obj1: Record<string, unknown> = {};
      obj1['b'] = 2;
      obj1['a'] = 1;
      const obj2: Record<string, unknown> = {};
      obj2['a'] = 1;
      obj2['b'] = 2;
      expect(serializeProviderBondRecord(obj1)).toBe(serializeProviderBondRecord(obj2));
    });
  });

  describe('reject NaN and Infinity', () => {
    it('throws on NaN', () => {
      expect(() => serializeProviderBondRecord({ value: NaN })).toThrow();
    });

    it('throws on Infinity', () => {
      expect(() => serializeProviderBondRecord({ value: Infinity })).toThrow();
    });
  });
});

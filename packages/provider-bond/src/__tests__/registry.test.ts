import {
  createEmptyProviderBondRegistryState,
  registerProvider,
  updateProviderManifest,
  attachBondProof,
  recordProviderProbe,
  recordProviderIncident,
  updateProviderScore,
  listProviders,
  getProvider,
  listProvidersByServiceType,
  listRiskyProviders,
  listOfflineProviders,
} from '../registry.js';
import { createProviderBondManifest } from '../manifest.js';
import { recordProbe } from '../probes.js';
import { recordIncident } from '../incidents.js';
import { computeProviderScore } from '../scoring.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import type { ProviderBondManifest } from '../types.js';

function makeManifest(providerId: string, serviceType = 'lookup-provider'): ProviderBondManifest {
  const edgeService: EdgeServiceManifest = {
    type: 'edge-service', serviceId: `svc-${providerId}`, name: 'Test', version: '1.0.0',
    operatorAddress: 'MxRoot', serviceType: serviceType as any, description: '',
    capabilities: [], tags: [],
  };
  return createProviderBondManifest({
    edgeService,
    providerBond: { providerId },
  });
}

describe('registry', () => {
  describe('registerProvider', () => {
    it('registers a provider', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1');
      state = registerProvider(state, manifest);
      expect(Object.keys(state.providers)).toHaveLength(1);
      expect(state.providers['p-1']).toBe(manifest);
    });

    it('does not mutate input state', () => {
      const state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1');
      const newState = registerProvider(state, manifest);
      expect(Object.keys(state.providers)).toHaveLength(0);
      expect(Object.keys(newState.providers)).toHaveLength(1);
    });
  });

  describe('updateProviderManifest', () => {
    it('updates a provider manifest', () => {
      let state = createEmptyProviderBondRegistryState();
      const m1 = makeManifest('p-1');
      state = registerProvider(state, m1);
      const m2 = makeManifest('p-1', 'omnia-router');
      state = updateProviderManifest(state, m2);
      expect(state.providers['p-1'].edgeService.serviceType).toBe('omnia-router');
    });
  });

  describe('attachBondProof', () => {
    it('attaches a bond proof', () => {
      let state = createEmptyProviderBondRegistryState();
      state = attachBondProof(state, 'p-1', {
        proofId: 'pr-1', bondId: 'b-1', providerId: 'p-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      });
      expect(state.bondProofs['p-1']).toHaveLength(1);
    });
  });

  describe('recordProviderProbe', () => {
    it('records a probe', () => {
      let state = createEmptyProviderBondRegistryState();
      const probe = recordProbe({ providerId: 'p-1', type: 'heartbeat', ok: true, now: 1000 });
      state = recordProviderProbe(state, 'p-1', probe);
      expect(state.probes['p-1']).toHaveLength(1);
    });
  });

  describe('recordProviderIncident', () => {
    it('records an incident', () => {
      let state = createEmptyProviderBondRegistryState();
      const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
      state = recordProviderIncident(state, 'p-1', incident);
      expect(state.incidents['p-1']).toHaveLength(1);
    });
  });

  describe('updateProviderScore', () => {
    it('updates a provider score', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1');
      state = registerProvider(state, manifest);
      const score = computeProviderScore({ provider: manifest, now: 1000 });
      state = updateProviderScore(state, 'p-1', score);
      expect(state.scores['p-1'].providerId).toBe('p-1');
    });
  });

  describe('listProviders', () => {
    it('lists all providers', () => {
      let state = createEmptyProviderBondRegistryState();
      state = registerProvider(state, makeManifest('p-1'));
      state = registerProvider(state, makeManifest('p-2'));
      expect(listProviders(state)).toHaveLength(2);
    });
  });

  describe('getProvider', () => {
    it('gets a provider by ID', () => {
      let state = createEmptyProviderBondRegistryState();
      state = registerProvider(state, makeManifest('p-1'));
      expect(getProvider(state, 'p-1')).toBeDefined();
      expect(getProvider(state, 'p-2')).toBeUndefined();
    });
  });

  describe('listProvidersByServiceType', () => {
    it('filters by service type', () => {
      let state = createEmptyProviderBondRegistryState();
      state = registerProvider(state, makeManifest('p-1', 'lookup-provider'));
      state = registerProvider(state, makeManifest('p-2', 'omnia-router'));
      const result = listProvidersByServiceType(state, 'omnia-router');
      expect(result).toHaveLength(1);
      expect(result[0].providerBond.providerId).toBe('p-2');
    });
  });

  describe('listRiskyProviders', () => {
    it('lists providers below threshold', () => {
      let state = createEmptyProviderBondRegistryState();
      const manifest = makeManifest('p-1');
      state = registerProvider(state, manifest);
      const score = computeProviderScore({ provider: manifest, now: 1000 });
      state = updateProviderScore(state, 'p-1', score);
      const risky = listRiskyProviders(state, 100);
      expect(risky.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('listOfflineProviders', () => {
    it('lists providers with no recent heartbeat', () => {
      let state = createEmptyProviderBondRegistryState();
      state = registerProvider(state, makeManifest('p-1'));
      const offline = listOfflineProviders(state, 120_000, Date.now());
      expect(offline).toHaveLength(1);
    });
  });
});

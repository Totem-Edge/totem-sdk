/**
 * id.test.ts
 * Stable IDs: same inputs → same ID; version change → same ID; key field change → different ID.
 */

import { computeManifestId } from '../id.js';
import type {
  AppManifest,
  CapabilityManifest,
  DAppManifest,
  EdgeServiceManifest,
} from '../types.js';

const APP: AppManifest = {
  type: 'app',
  appId: '',
  name: 'Test App',
  version: '1.0.0',
  authorAddress: 'MxAUTHOR1111',
  pearTopicKey: 'aaaa1111',
  price: '0',
  category: ['finance'],
  permissions: ['wallet:read-balance'],
  description: 'Test',
  minTotemVersion: '0.1.0',
};

const CAP: CapabilityManifest = {
  type: 'capability',
  capabilityId: '',
  capabilityName: 'invoice-translate',
  agentAddress: 'MxAGENT2222',
  agentIdentityKey: 'bbbb2222',
  description: 'Translates',
  inputSchema: {},
  outputSchema: {},
  pricePerCall: '1',
  expiresAt: 9999,
  tags: [],
};

const DAPP: DAppManifest = {
  type: 'dapp',
  dappId: '',
  name: 'Swap',
  version: '1.0.0',
  authorAddress: 'MxAUTHOR3333',
  contractHash: 'cccc3333',
  abi: [],
  price: '0',
  category: [],
  description: '',
};

const EDGE: EdgeServiceManifest = {
  type: 'edge-service',
  serviceId: '',
  name: 'My Sensor',
  version: '1.0.0',
  operatorAddress: 'MxOPERATOR4444',
  serviceType: 'sensor',
  description: '',
  capabilities: [],
  tags: [],
};

describe('computeManifestId — stable IDs', () => {
  it('returns the same ID for identical AppManifest inputs', () => {
    expect(computeManifestId(APP)).toBe(computeManifestId({ ...APP }));
  });

  it('AppManifest: ID is stable when version changes', () => {
    expect(computeManifestId(APP)).toBe(computeManifestId({ ...APP, version: '2.0.0' }));
  });

  it('AppManifest: ID changes when authorAddress changes', () => {
    expect(computeManifestId(APP)).not.toBe(computeManifestId({ ...APP, authorAddress: 'MxOTHER' }));
  });

  it('AppManifest: ID changes when pearTopicKey changes', () => {
    expect(computeManifestId(APP)).not.toBe(computeManifestId({ ...APP, pearTopicKey: 'bbbb' }));
  });

  it('returns the same ID for identical CapabilityManifest inputs', () => {
    expect(computeManifestId(CAP)).toBe(computeManifestId({ ...CAP }));
  });

  it('CapabilityManifest: ID is stable when expiresAt changes', () => {
    expect(computeManifestId(CAP)).toBe(computeManifestId({ ...CAP, expiresAt: 0 }));
  });

  it('CapabilityManifest: ID changes when agentAddress changes', () => {
    expect(computeManifestId(CAP)).not.toBe(computeManifestId({ ...CAP, agentAddress: 'MxOTHER' }));
  });

  it('CapabilityManifest: ID changes when capabilityName changes', () => {
    expect(computeManifestId(CAP)).not.toBe(computeManifestId({ ...CAP, capabilityName: 'other-capability' }));
  });

  it('returns the same ID for identical DAppManifest inputs', () => {
    expect(computeManifestId(DAPP)).toBe(computeManifestId({ ...DAPP }));
  });

  it('DAppManifest: ID is stable when version changes', () => {
    expect(computeManifestId(DAPP)).toBe(computeManifestId({ ...DAPP, version: '9.9.9' }));
  });

  it('DAppManifest: ID changes when contractHash changes', () => {
    expect(computeManifestId(DAPP)).not.toBe(computeManifestId({ ...DAPP, contractHash: 'dddd' }));
  });

  it('returns the same ID for identical EdgeServiceManifest inputs', () => {
    expect(computeManifestId(EDGE)).toBe(computeManifestId({ ...EDGE }));
  });

  it('EdgeServiceManifest: ID is stable when version changes', () => {
    expect(computeManifestId(EDGE)).toBe(computeManifestId({ ...EDGE, version: '9.0.0' }));
  });

  it('EdgeServiceManifest: ID changes when serviceType changes', () => {
    expect(computeManifestId(EDGE)).not.toBe(computeManifestId({ ...EDGE, serviceType: 'robot' }));
  });

  it('EdgeServiceManifest: ID changes when name changes', () => {
    expect(computeManifestId(EDGE)).not.toBe(computeManifestId({ ...EDGE, name: 'Other Sensor' }));
  });

  it('IDs are 64-character hex strings (SHA3-256)', () => {
    const id = computeManifestId(APP);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('IDs differ across manifest types', () => {
    const ids = [
      computeManifestId(APP),
      computeManifestId(CAP),
      computeManifestId(DAPP),
      computeManifestId(EDGE),
    ];
    const unique = new Set(ids);
    expect(unique.size).toBe(4);
  });
});

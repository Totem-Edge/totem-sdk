/**
 * guards.test.ts
 * Type guard tests for all four manifest kinds.
 * Guards must work on both raw manifests and SignedManifest wrappers.
 */

import {
  isAppManifest,
  isCapabilityManifest,
  isDAppManifest,
  isEdgeServiceManifest,
} from '../guards.js';
import type {
  AppManifest,
  CapabilityManifest,
  DAppManifest,
  EdgeServiceManifest,
  SignedManifest,
} from '../types.js';

const APP: AppManifest = {
  type: 'app',
  appId: '',
  name: 'Test',
  version: '1.0.0',
  authorAddress: 'MxAPP',
  pearTopicKey: 'a'.repeat(64),
  price: '0',
  category: [],
  permissions: [],
  description: '',
  minTotemVersion: '0.1.0',
};

const CAP: CapabilityManifest = {
  type: 'capability',
  capabilityId: '',
  capabilityName: 'x',
  agentAddress: 'MxCAP',
  agentIdentityKey: 'b'.repeat(64),
  description: '',
  inputSchema: {},
  outputSchema: {},
  pricePerCall: '1',
  expiresAt: 0,
  tags: [],
};

const DAPP: DAppManifest = {
  type: 'dapp',
  dappId: '',
  name: 'x',
  version: '1.0.0',
  authorAddress: 'MxDAPP',
  contractHash: 'c'.repeat(64),
  abi: [],
  price: '0',
  category: [],
  description: '',
};

const EDGE: EdgeServiceManifest = {
  type: 'edge-service',
  serviceId: '',
  name: 'x',
  version: '1.0.0',
  operatorAddress: 'MxEDGE',
  serviceType: 'lookup-provider',
  description: '',
  capabilities: [],
  tags: [],
};

function mockSigned<T extends { type: string }>(manifest: T): SignedManifest<T extends AppManifest ? AppManifest : T extends CapabilityManifest ? CapabilityManifest : T extends DAppManifest ? DAppManifest : EdgeServiceManifest> {
  return {
    manifest: manifest as any,
    authorAddress: 'MxSIGNER',
    signerPublicKey: 'aa'.repeat(544),
    signedAt: Date.now(),
    signature: 'bb'.repeat(100),
  };
}

describe('isAppManifest', () => {
  it('returns true for raw AppManifest', () => expect(isAppManifest(APP)).toBe(true));
  it('returns true for SignedManifest<AppManifest>', () => expect(isAppManifest(mockSigned(APP))).toBe(true));
  it('returns false for CapabilityManifest', () => expect(isAppManifest(CAP)).toBe(false));
  it('returns false for DAppManifest', () => expect(isAppManifest(DAPP)).toBe(false));
  it('returns false for EdgeServiceManifest', () => expect(isAppManifest(EDGE)).toBe(false));
  it('returns false for null', () => expect(isAppManifest(null)).toBe(false));
  it('returns false for undefined', () => expect(isAppManifest(undefined)).toBe(false));
  it('returns false for SignedManifest<CapabilityManifest>', () => expect(isAppManifest(mockSigned(CAP))).toBe(false));
});

describe('isCapabilityManifest', () => {
  it('returns true for raw CapabilityManifest', () => expect(isCapabilityManifest(CAP)).toBe(true));
  it('returns true for SignedManifest<CapabilityManifest>', () => expect(isCapabilityManifest(mockSigned(CAP))).toBe(true));
  it('returns false for AppManifest', () => expect(isCapabilityManifest(APP)).toBe(false));
  it('returns false for DAppManifest', () => expect(isCapabilityManifest(DAPP)).toBe(false));
  it('returns false for EdgeServiceManifest', () => expect(isCapabilityManifest(EDGE)).toBe(false));
  it('returns false for null', () => expect(isCapabilityManifest(null)).toBe(false));
});

describe('isDAppManifest', () => {
  it('returns true for raw DAppManifest', () => expect(isDAppManifest(DAPP)).toBe(true));
  it('returns true for SignedManifest<DAppManifest>', () => expect(isDAppManifest(mockSigned(DAPP))).toBe(true));
  it('returns false for AppManifest', () => expect(isDAppManifest(APP)).toBe(false));
  it('returns false for CapabilityManifest', () => expect(isDAppManifest(CAP)).toBe(false));
  it('returns false for EdgeServiceManifest', () => expect(isDAppManifest(EDGE)).toBe(false));
  it('returns false for null', () => expect(isDAppManifest(null)).toBe(false));
});

describe('isEdgeServiceManifest', () => {
  it('returns true for raw EdgeServiceManifest', () => expect(isEdgeServiceManifest(EDGE)).toBe(true));
  it('returns true for SignedManifest<EdgeServiceManifest>', () => expect(isEdgeServiceManifest(mockSigned(EDGE))).toBe(true));
  it('returns false for AppManifest', () => expect(isEdgeServiceManifest(APP)).toBe(false));
  it('returns false for CapabilityManifest', () => expect(isEdgeServiceManifest(CAP)).toBe(false));
  it('returns false for DAppManifest', () => expect(isEdgeServiceManifest(DAPP)).toBe(false));
  it('returns false for null', () => expect(isEdgeServiceManifest(null)).toBe(false));
});

describe('cross-type guard correctness', () => {
  const allManifests = [APP, CAP, DAPP, EDGE];
  const guards = [isAppManifest, isCapabilityManifest, isDAppManifest, isEdgeServiceManifest];

  it('each manifest is identified by exactly one guard', () => {
    for (const m of allManifests) {
      const trueCount = guards.filter(g => g(m)).length;
      expect(trueCount).toBe(1);
    }
  });

  it('each signed manifest is identified by exactly one guard', () => {
    for (const m of allManifests) {
      const signed = mockSigned(m);
      const trueCount = guards.filter(g => g(signed)).length;
      expect(trueCount).toBe(1);
    }
  });
});

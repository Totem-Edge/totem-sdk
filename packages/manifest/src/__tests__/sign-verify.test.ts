/**
 * sign-verify.test.ts
 * Round-trip sign → verify for all four manifest types.
 * Also tests tamper detection.
 */

import { signManifest } from '../sign.js';
import { verifyManifest } from '../verify.js';
import type {
  AppManifest,
  CapabilityManifest,
  DAppManifest,
  EdgeServiceManifest,
} from '../types.js';
import { computeManifestId } from '../id.js';

jest.setTimeout(60_000);

const TEST_SEED = new Uint8Array(32).fill(0x42);
const KEY_INDEX = 0;

const APP: AppManifest = {
  type: 'app',
  appId: '',
  name: 'Test App',
  version: '1.0.0',
  authorAddress: 'MxAUTHOR0000000000000000000000000000000000000000',
  pearTopicKey: 'a'.repeat(64),
  price: '0',
  category: ['finance'],
  permissions: ['wallet:read-balance'],
  description: 'A test app',
  minTotemVersion: '0.1.0',
};

const CAPABILITY: CapabilityManifest = {
  type: 'capability',
  capabilityId: '',
  capabilityName: 'invoice-translate',
  agentAddress: 'MxAGENT0000000000000000000000000000000000000000',
  agentIdentityKey: 'b'.repeat(64),
  description: 'Translates invoices',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  pricePerCall: '1',
  expiresAt: Date.now() + 86_400_000,
  tags: ['finance'],
};

const DAPP: DAppManifest = {
  type: 'dapp',
  dappId: '',
  name: 'Test dApp',
  version: '1.0.0',
  authorAddress: 'MxAUTHOR0000000000000000000000000000000000000000',
  contractHash: 'c'.repeat(64),
  abi: [{ name: 'transfer', description: 'Transfer tokens', params: [{ name: 'amount', type: 'string' }] }],
  price: '0',
  category: ['defi'],
  description: 'A test dApp',
};

const EDGE: EdgeServiceManifest = {
  type: 'edge-service',
  serviceId: '',
  name: 'Test Sensor',
  version: '1.0.0',
  operatorAddress: 'MxOPERATOR000000000000000000000000000000000000',
  serviceType: 'sensor',
  description: 'A test sensor node',
  capabilities: ['temperature'],
  tags: ['iot'],
};

function withId<T extends { type: string }>(m: T): T {
  return m;
}

describe('signManifest + verifyManifest round-trips', () => {
  let signedAddress: string;

  beforeAll(async () => {
    const tmp = await signManifest(APP, TEST_SEED, KEY_INDEX);
    signedAddress = tmp.authorAddress;
  });

  it('signs and verifies AppManifest', async () => {
    const app = { ...APP, authorAddress: signedAddress };
    const signed = await signManifest(app, TEST_SEED, KEY_INDEX);
    expect(signed.manifest.type).toBe('app');
    expect(signed.authorAddress).toBe(signedAddress);
    expect(signed.signature).toBeTruthy();
    expect(signed.signerPublicKey).toBeTruthy();

    const result = verifyManifest(signed);
    expect(result.valid).toBe(true);
    expect(result.signerAddress).toBe(signedAddress);
  });

  it('signs and verifies CapabilityManifest', async () => {
    const cap = { ...CAPABILITY, agentAddress: signedAddress };
    const signed = await signManifest(cap, TEST_SEED, KEY_INDEX);
    expect(signed.manifest.type).toBe('capability');

    const result = verifyManifest(signed);
    expect(result.valid).toBe(true);
  });

  it('signs and verifies DAppManifest', async () => {
    const dapp = { ...DAPP, authorAddress: signedAddress };
    const signed = await signManifest(dapp, TEST_SEED, KEY_INDEX);
    expect(signed.manifest.type).toBe('dapp');

    const result = verifyManifest(signed);
    expect(result.valid).toBe(true);
  });

  it('signs and verifies EdgeServiceManifest', async () => {
    const edge = { ...EDGE, operatorAddress: signedAddress };
    const signed = await signManifest(edge, TEST_SEED, KEY_INDEX);
    expect(signed.manifest.type).toBe('edge-service');

    const result = verifyManifest(signed);
    expect(result.valid).toBe(true);
  });

  it('detects manifest tampering — changed name field', async () => {
    const app = { ...APP, authorAddress: signedAddress };
    const signed = await signManifest(app, TEST_SEED, KEY_INDEX);

    const tampered = {
      ...signed,
      manifest: { ...signed.manifest, name: 'EVIL APP' } as AppManifest,
    };

    const result = verifyManifest(tampered);
    expect(result.valid).toBe(false);
  });

  it('detects tampered authorAddress in SignedManifest wrapper', async () => {
    const app = { ...APP, authorAddress: signedAddress };
    const signed = await signManifest(app, TEST_SEED, KEY_INDEX);

    const tampered = { ...signed, authorAddress: 'Mx999999999999999999' };
    const result = verifyManifest(tampered);
    expect(result.valid).toBe(false);
  });

  it('detects corrupted signature bytes', async () => {
    const app = { ...APP, authorAddress: signedAddress };
    const signed = await signManifest(app, TEST_SEED, KEY_INDEX);

    const corrupted = { ...signed, signature: 'ff' + signed.signature.slice(2) };
    const result = verifyManifest(corrupted);
    expect(result.valid).toBe(false);
  });
});

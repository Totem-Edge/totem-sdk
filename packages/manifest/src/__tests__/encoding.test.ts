/**
 * encoding.test.ts
 * encode → decode round-trips for all four manifest types.
 */

import { signManifest } from '../sign.js';
import { encodeManifest, decodeManifest } from '../encoding.js';
import { MANIFEST_VERSION, MANIFEST_TYPE_BYTE } from '../constants.js';
import type {
  AppManifest,
  CapabilityManifest,
  DAppManifest,
  EdgeServiceManifest,
} from '../types.js';

jest.setTimeout(60_000);

const TEST_SEED = new Uint8Array(32).fill(0x11);
const KEY_INDEX = 0;

let resolvedAddress: string;

beforeAll(async () => {
  const tmp = await signManifest(
    {
      type: 'app',
      appId: '',
      name: 'init',
      version: '1.0.0',
      authorAddress: 'MxINIT',
      pearTopicKey: 'a'.repeat(64),
      price: '0',
      category: [],
      permissions: [],
      description: '',
      minTotemVersion: '0.1.0',
    } satisfies AppManifest,
    TEST_SEED,
    KEY_INDEX,
  );
  resolvedAddress = tmp.authorAddress;
});

describe('encodeManifest / decodeManifest', () => {
  it('round-trips AppManifest and preserves manifest type', async () => {
    const manifest: AppManifest = {
      type: 'app',
      appId: 'abc123',
      name: 'My App',
      version: '1.0.0',
      authorAddress: resolvedAddress,
      pearTopicKey: 'f'.repeat(64),
      price: '0',
      category: ['finance'],
      permissions: ['wallet:read-balance'],
      description: 'Test',
      minTotemVersion: '0.1.0',
    };
    const signed = await signManifest(manifest, TEST_SEED, KEY_INDEX);
    const encoded = encodeManifest(signed);
    const decoded = decodeManifest(encoded);

    expect(decoded.manifest.type).toBe('app');
    expect(decoded.manifest.type).toBe(signed.manifest.type);
    expect((decoded.manifest as AppManifest).name).toBe('My App');
    expect(decoded.signature).toBe(signed.signature);
  });

  it('round-trips CapabilityManifest', async () => {
    const manifest: CapabilityManifest = {
      type: 'capability',
      capabilityId: 'cap1',
      capabilityName: 'price-oracle',
      agentAddress: resolvedAddress,
      agentIdentityKey: 'e'.repeat(64),
      description: 'Price oracle',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      pricePerCall: '2',
      expiresAt: Date.now() + 3600_000,
      tags: ['oracle'],
    };
    const signed = await signManifest(manifest, TEST_SEED, KEY_INDEX);
    const encoded = encodeManifest(signed);
    const decoded = decodeManifest(encoded);

    expect(decoded.manifest.type).toBe('capability');
    expect((decoded.manifest as CapabilityManifest).capabilityName).toBe('price-oracle');
  });

  it('round-trips DAppManifest', async () => {
    const manifest: DAppManifest = {
      type: 'dapp',
      dappId: 'dapp1',
      name: 'Swap dApp',
      version: '2.0.0',
      authorAddress: resolvedAddress,
      contractHash: 'd'.repeat(64),
      abi: [],
      price: '5',
      category: ['defi'],
      description: 'A swap contract',
    };
    const signed = await signManifest(manifest, TEST_SEED, KEY_INDEX);
    const encoded = encodeManifest(signed);
    const decoded = decodeManifest(encoded);

    expect(decoded.manifest.type).toBe('dapp');
    expect((decoded.manifest as DAppManifest).name).toBe('Swap dApp');
  });

  it('round-trips EdgeServiceManifest', async () => {
    const manifest: EdgeServiceManifest = {
      type: 'edge-service',
      serviceId: 'edge1',
      name: 'DHT Relay',
      version: '1.0.0',
      operatorAddress: resolvedAddress,
      serviceType: 'omnia-router',
      description: 'Omnia routing node',
      capabilities: ['relay'],
      tags: ['infrastructure'],
    };
    const signed = await signManifest(manifest, TEST_SEED, KEY_INDEX);
    const encoded = encodeManifest(signed);
    const decoded = decodeManifest(encoded);

    expect(decoded.manifest.type).toBe('edge-service');
    expect((decoded.manifest as EdgeServiceManifest).serviceType).toBe('omnia-router');
  });

  it('first byte is MANIFEST_VERSION', async () => {
    const manifest: AppManifest = {
      type: 'app',
      appId: '',
      name: 'v-test',
      version: '1.0.0',
      authorAddress: resolvedAddress,
      pearTopicKey: 'a'.repeat(64),
      price: '0',
      category: [],
      permissions: [],
      description: '',
      minTotemVersion: '0.1.0',
    };
    const signed = await signManifest(manifest, TEST_SEED, KEY_INDEX);
    const encoded = encodeManifest(signed);
    expect(encoded[0]).toBe(MANIFEST_VERSION);
  });

  it('second byte is correct type discriminant', async () => {
    const appSigned = await signManifest(
      { type: 'app', appId: '', name: 'x', version: '1.0.0', authorAddress: resolvedAddress, pearTopicKey: 'a'.repeat(64), price: '0', category: [], permissions: [], description: '', minTotemVersion: '0.1.0' } satisfies AppManifest,
      TEST_SEED, KEY_INDEX,
    );
    expect(encodeManifest(appSigned)[1]).toBe(MANIFEST_TYPE_BYTE.app);

    const capSigned = await signManifest(
      { type: 'capability', capabilityId: '', capabilityName: 'x', agentAddress: resolvedAddress, agentIdentityKey: 'e'.repeat(64), description: '', inputSchema: {}, outputSchema: {}, pricePerCall: '1', expiresAt: 0, tags: [] } satisfies CapabilityManifest,
      TEST_SEED, KEY_INDEX,
    );
    expect(encodeManifest(capSigned)[1]).toBe(MANIFEST_TYPE_BYTE.capability);

    const edgeSigned = await signManifest(
      { type: 'edge-service', serviceId: '', name: 'x', version: '1.0.0', operatorAddress: resolvedAddress, serviceType: 'sensor', description: '', capabilities: [], tags: [] } satisfies EdgeServiceManifest,
      TEST_SEED, KEY_INDEX,
    );
    expect(encodeManifest(edgeSigned)[1]).toBe(MANIFEST_TYPE_BYTE['edge-service']);
  });

  it('throws on unknown type discriminant byte', () => {
    const bad = new Uint8Array([1, 0xff, 0, 0, 0, 5, 104, 101, 108, 108, 111]);
    expect(() => decodeManifest(bad)).toThrow(/unknown type discriminant/);
  });

  it('throws on buffer too short', () => {
    expect(() => decodeManifest(new Uint8Array([1, 1, 0, 0]))).toThrow(/too short/);
  });

  it('throws on MANIFEST_VERSION mismatch', () => {
    const bad = new Uint8Array(10).fill(0);
    bad[0] = 255;
    expect(() => decodeManifest(bad)).toThrow(/unsupported MANIFEST_VERSION/);
  });
});

import { createLookupPortAdapter } from '../lookup';
import type { LookupClient } from '@totemsdk/lookup-client';

// encodeManifest is called inside the adapter; mock it so tests don't need
// real WOTS-signed manifests.
jest.mock('@totemsdk/manifest', () => ({
  encodeManifest: jest.fn().mockReturnValue(new Uint8Array([0x01, 0x02, 0x03])),
}));

function makeClient(overrides: Partial<LookupClient> = {}): LookupClient {
  return {
    getCoins: jest.fn().mockResolvedValue([{ coinid: '0xC1', amount: '10', address: 'MxFOO', tokenid: '0x00' }]),
    getCoin: jest.fn().mockResolvedValue({ coinid: '0xC2', amount: '5', address: 'MxFOO', tokenid: '0x00' }),
    watchAddress: jest.fn().mockResolvedValue(undefined),
    subscribeCoinUpdates: jest.fn().mockReturnValue(() => {}),
    announceApp: jest.fn().mockResolvedValue(undefined),
    announceAgent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as LookupClient;
}

afterEach(() => jest.clearAllMocks());

// ─── lookup ───────────────────────────────────────────────────────────────────

describe('createLookupPortAdapter — lookup', () => {
  it('calls getCoins with the query as address', async () => {
    const client = makeClient();
    const port = createLookupPortAdapter(client);
    const result = await port.lookup({ query: 'MxFOO' });
    expect(result.ok).toBe(true);
    expect(result.data?.results).toHaveLength(1);
    expect(client.getCoins).toHaveBeenCalledWith({ address: 'MxFOO' });
  });

  it('calls getCoin when kind is "coin"', async () => {
    const client = makeClient();
    const port = createLookupPortAdapter(client);
    const result = await port.lookup({ query: '0xC2', kind: 'coin' });
    expect(result.ok).toBe(true);
    expect(result.data?.results).toHaveLength(1);
    expect(client.getCoin).toHaveBeenCalledWith('0xC2');
  });

  it('returns empty array when getCoin returns null', async () => {
    const client = makeClient({ getCoin: jest.fn().mockResolvedValue(null) });
    const port = createLookupPortAdapter(client);
    const result = await port.lookup({ query: '0xMISSING', kind: 'coin' });
    expect(result.ok).toBe(true);
    expect(result.data?.results).toHaveLength(0);
  });

  it('returns ok:false when provider throws', async () => {
    const client = makeClient({ getCoins: jest.fn().mockRejectedValue(new Error('disconnected')) });
    const port = createLookupPortAdapter(client);
    const result = await port.lookup({ query: 'MxFOO' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('disconnected');
  });
});

// ─── watch ────────────────────────────────────────────────────────────────────

describe('createLookupPortAdapter — watch', () => {
  it('calls watchAddress and subscribes to coin updates', async () => {
    const client = makeClient();
    const port = createLookupPortAdapter(client);
    const onUpdate = jest.fn();
    const result = await port.watch({ address: 'MxFOO', onUpdate });
    expect(result.ok).toBe(true);
    expect(client.watchAddress).toHaveBeenCalledWith('MxFOO');
    expect(client.subscribeCoinUpdates).toHaveBeenCalled();
    expect(typeof result.data?.unsubscribe).toBe('function');
  });
});

// ─── announce ─────────────────────────────────────────────────────────────────

describe('createLookupPortAdapter — announce app', () => {
  const fakeSignedManifest = { manifest: { type: 'edge-service' }, authorAddress: 'MxFOO', signature: '0xSIG' };

  it('encodes the signed manifest and calls announceApp', async () => {
    const client = makeClient();
    const port = createLookupPortAdapter(client);
    const result = await port.announce({
      kind: 'app',
      signed: fakeSignedManifest,
      appId: 'svc-001',
      expiresAt: 9999999999,
      authorAddress: 'MxFOO',
      isFree: false,
    });
    expect(result.ok).toBe(true);
    expect(client.announceApp).toHaveBeenCalledWith({
      manifest: new Uint8Array([0x01, 0x02, 0x03]),
      appId: 'svc-001',
      expiresAt: 9999999999,
      authorAddress: 'MxFOO',
      isFree: false,
    });
    expect(client.announceAgent).not.toHaveBeenCalled();
  });

  it('returns ok:false when announceApp throws', async () => {
    const client = makeClient({ announceApp: jest.fn().mockRejectedValue(new Error('not connected')) });
    const port = createLookupPortAdapter(client);
    const result = await port.announce({ kind: 'app', signed: fakeSignedManifest, appId: 'x', expiresAt: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not connected');
  });
});

describe('createLookupPortAdapter — announce agent', () => {
  const fakeSignedManifest = { manifest: { type: 'capability' }, authorAddress: 'MxFOO', signature: '0xSIG' };

  it('encodes the signed manifest and calls announceAgent', async () => {
    const client = makeClient();
    const port = createLookupPortAdapter(client);
    const result = await port.announce({
      kind: 'agent',
      signed: fakeSignedManifest,
      capabilityId: 'cap-translation-v1',
      expiresAt: 9999999999,
      tags: ['translation', 'en-fr'],
      pricePerCall: 10,
      latencyMs: 200,
    });
    expect(result.ok).toBe(true);
    expect(client.announceAgent).toHaveBeenCalledWith({
      manifest: new Uint8Array([0x01, 0x02, 0x03]),
      capabilityId: 'cap-translation-v1',
      expiresAt: 9999999999,
      tags: ['translation', 'en-fr'],
      pricePerCall: 10,
      latencyMs: 200,
    });
    expect(client.announceApp).not.toHaveBeenCalled();
  });

  it('returns ok:false when announceAgent throws', async () => {
    const client = makeClient({ announceAgent: jest.fn().mockRejectedValue(new Error('timeout')) });
    const port = createLookupPortAdapter(client);
    const result = await port.announce({ kind: 'agent', signed: fakeSignedManifest, capabilityId: 'x', expiresAt: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('timeout');
  });
});

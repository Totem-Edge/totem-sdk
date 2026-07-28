import { PersonalLeaseNodeProvider } from '../stubs';
import type { LeaseCertificate } from '../types';

const NODE_URL = 'http://localhost:7777';
const NODE_PUBKEY = 'aabbccddeeff0011223344556677889900aabbccddeeff0011223344556677889900';

function mockFetch(body: unknown, status = 200): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

afterEach(() => jest.restoreAllMocks());

describe('PersonalLeaseNodeProvider — reserveKeyUse', () => {
  it('POSTs to /v1/lease/reserve and returns a LeaseReservation with certificate', async () => {
    const reservation = {
      reservationId: 'res-1',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      expiresAt: Date.now() + 120_000,
    };
    const certificate = {
      reservationId: 'res-1',
      treeId: 'wallet',
      indices: { addressIndex: 0, l1: 0, l2: 0 },
      issuedBy: NODE_PUBKEY,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 120_000,
      signature: 'aabbcc',
    };
    const spy = mockFetch({ reservation, certificate });

    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    const result = await provider.reserveKeyUse({ treeId: 'wallet', purpose: 'test' });

    expect(result.reservationId).toBe('res-1');
    expect(result.indices).toEqual({ addressIndex: 0, l1: 0, l2: 0 });
    expect(result.certificate?.issuedBy).toBe(NODE_PUBKEY);

    const [url, opts] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${NODE_URL}/v1/lease/reserve`);
    expect(opts.method).toBe('POST');
    const sentBody = JSON.parse(opts.body as string);
    expect(sentBody.treeId).toBe('wallet');
    expect(sentBody.purpose).toBe('test');
  });

  it('throws on HTTP error', async () => {
    mockFetch({ error: 'exhausted' }, 503);
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    await expect(provider.reserveKeyUse({ treeId: 'wallet' })).rejects.toThrow('HTTP 503');
  });

  it('includes Authorization header when authToken is provided', async () => {
    const spy = mockFetch({
      reservation: { reservationId: 'r', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: 0 },
      certificate: { reservationId: 'r', treeId: 't', indices: { addressIndex: 0, l1: 0, l2: 0 }, issuedBy: NODE_PUBKEY, issuedAt: 0, expiresAt: 0, signature: '' },
    });
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY, authToken: 'tok123' });
    await provider.reserveKeyUse({ treeId: 't' });
    const [, opts] = spy.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123');
  });
});

describe('PersonalLeaseNodeProvider — commitKeyUse', () => {
  it('POSTs to /v1/lease/commit', async () => {
    const spy = mockFetch({ ok: true });
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    await provider.commitKeyUse('res-1', '0xTXID');

    const [url, opts] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${NODE_URL}/v1/lease/commit`);
    const body = JSON.parse(opts.body as string);
    expect(body.reservationId).toBe('res-1');
    expect(body.txId).toBe('0xTXID');
  });

  it('throws when node returns ok:false', async () => {
    mockFetch({ ok: false, error: 'already committed' });
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    await expect(provider.commitKeyUse('res-1', '0x')).rejects.toThrow('already committed');
  });
});

describe('PersonalLeaseNodeProvider — burnReservation', () => {
  it('POSTs to /v1/lease/burn', async () => {
    const spy = mockFetch({ ok: true });
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    await provider.burnReservation('res-1', 'tx-failed');

    const [url, opts] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${NODE_URL}/v1/lease/burn`);
    const body = JSON.parse(opts.body as string);
    expect(body.reason).toBe('tx-failed');
  });
});

describe('PersonalLeaseNodeProvider — getLocalWatermark', () => {
  it('GETs /v1/lease/watermark/:treeId', async () => {
    const wm = { treeId: 'wallet', addressCursor: 2, l1Cursor: 0, l2Cursor: 5, unavailableCount: 7, capacity: 262144 };
    const spy = mockFetch(wm);
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    const result = await provider.getLocalWatermark('wallet');

    expect(result.unavailableCount).toBe(7);
    const [url] = spy.mock.calls[0] as [string];
    expect(url).toBe(`${NODE_URL}/v1/lease/watermark/wallet`);
  });
});

describe('PersonalLeaseNodeProvider — publishWatermark', () => {
  it('POSTs to /v1/lease/watermark/:treeId/publish', async () => {
    const spy = mockFetch({ ok: true });
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    await provider.publishWatermark('wallet');

    const [url] = spy.mock.calls[0] as [string];
    expect(url).toBe(`${NODE_URL}/v1/lease/watermark/wallet/publish`);
  });
});

describe('PersonalLeaseNodeProvider — syncLeaseJournal', () => {
  it('GETs /v1/lease/journal/sync and returns SyncResult', async () => {
    const syncResult = { synced: true, conflicts: [] };
    mockFetch(syncResult);
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    const result = await provider.syncLeaseJournal();
    expect(result.synced).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });
});

describe('PersonalLeaseNodeProvider — verifyLeaseCertificate', () => {
  const makeCert = (overrides: Partial<LeaseCertificate> = {}): LeaseCertificate => ({
    reservationId: 'r1',
    treeId: 'wallet',
    indices: { addressIndex: 0, l1: 0, l2: 0 },
    issuedBy: NODE_PUBKEY,
    issuedAt: Date.now() - 1000,
    expiresAt: Date.now() + 120_000,
    signature: 'sig',
    ...overrides,
  });

  it('returns false when cert is undefined', async () => {
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    expect(await provider.verifyLeaseCertificate(undefined)).toBe(false);
  });

  it('returns false when issuedBy does not match nodePubkey', async () => {
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    expect(await provider.verifyLeaseCertificate(makeCert({ issuedBy: 'wrong-key' }))).toBe(false);
  });

  it('returns false when cert is expired', async () => {
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    expect(await provider.verifyLeaseCertificate(makeCert({ expiresAt: Date.now() - 1 }))).toBe(false);
  });

  it('returns true for a valid cert from the configured node', async () => {
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    expect(await provider.verifyLeaseCertificate(makeCert())).toBe(true);
  });

  it('URL-encodes treeId with special characters in getLocalWatermark', async () => {
    const spy = mockFetch({ treeId: 'my tree', addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 262144 });
    const provider = new PersonalLeaseNodeProvider({ nodeUrl: NODE_URL, nodePubkey: NODE_PUBKEY });
    await provider.getLocalWatermark('my tree');
    const [url] = spy.mock.calls[0] as [string];
    expect(url).toBe(`${NODE_URL}/v1/lease/watermark/my%20tree`);
  });
});

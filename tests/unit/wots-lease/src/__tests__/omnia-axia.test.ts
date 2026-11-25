import { MemoryStore } from '@totemsdk/storage';
import { OmniaAxiaLeaseProvider } from '../omnia-axia.js';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function provider(fetchImpl: jest.Mock): OmniaAxiaLeaseProvider {
  return new OmniaAxiaLeaseProvider({
    apiUrl: 'https://api.axia.test',
    apiKey: 'totem-shared',
    rootPublicKey: '0x' + 'ab'.repeat(32),
    addressIndex: 0,
    storage: new MemoryStore(),
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe('OmniaAxiaLeaseProvider', () => {
  test('leases the wallet per-address slot through /prepare', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({
        leaseToken: 'lease-token-1',
        leaseId: 'lease-1',
        addressIndex: 0,
        l1: 4,
        l2: 7,
        leaseTTL: 60_000,
      }),
    );

    const lease = provider(fetchImpl);
    const reservation = await lease.reserveKeyUse({
      treeId: 'omnia-channel-0xabc',
      payloadHash: '0x' + '11'.repeat(32),
      purpose: 'channel-update',
    });

    expect(reservation.indices).toEqual({ addressIndex: 0, l1: 4, l2: 7 });
    expect(reservation.leaseToken).toBe('lease-token-1');
    expect(reservation.reservationId).toBe('lease-1');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.axia.test/v1/wots-hardened/prepare');
    expect(JSON.parse(String(init.body))).toMatchObject({
      rootPublicKey: '0x' + 'ab'.repeat(32),
      addressIndex: 0,
      paramSet: 'v2-spec',
    });
  });

  test('consumes the lease and advances the channel watermark on commit', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        leaseToken: 'lease-token-2',
        leaseId: 'lease-2',
        addressIndex: 0,
        l1: 1,
        l2: 2,
      }))
      .mockResolvedValueOnce(jsonResponse({ consumed: true }));

    const lease = provider(fetchImpl);
    const reservation = await lease.reserveKeyUse({ treeId: 'omnia-channel-0xdef' });
    await lease.commitKeyUse(reservation.reservationId, 'channel-update');

    const [, consumeInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(consumeInit.body))).toEqual({
      leaseToken: 'lease-token-2',
      txHash: 'channel-update',
    });

    const watermark = await lease.getLocalWatermark('omnia-channel-0xdef');
    expect(watermark.unavailableCount).toBeGreaterThan(0);
  });

  test('fails closed when /prepare rejects', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({ error: 'Daily WOTS signing limit reached' }, false, 429),
    );

    await expect(provider(fetchImpl).reserveKeyUse({ treeId: 'omnia-channel-0x1' }))
      .rejects.toThrow(/Daily WOTS signing limit/);
  });

  test('burns a reservation locally without reusing the index', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({
        leaseToken: 'lease-token-3',
        leaseId: 'lease-3',
        addressIndex: 0,
        l1: 9,
        l2: 9,
      }),
    );

    const lease = provider(fetchImpl);
    const reservation = await lease.reserveKeyUse({ treeId: 'omnia-channel-0x2' });
    await lease.burnReservation(reservation.reservationId, 'test abort');

    const watermark = await lease.getLocalWatermark('omnia-channel-0x2');
    expect(watermark.unavailableCount).toBeGreaterThan(0);
  });
});

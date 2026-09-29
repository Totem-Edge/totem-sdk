/**
 * RFC-020 C2: the Axia lease provider must detect and reject a replaying /
 * hostile lease server that hands out an already-consumed WOTS index, and must
 * key its watermark/journal by the real treeId.
 */
import { MemoryStore } from '@totemsdk/storage';
import { prepareLease, finalizeLease } from '@totemsdk/core';
import { AxiaLeaseProvider } from '../axia.js';
import { IndicesUnavailableError } from '../errors.js';

jest.mock('@totemsdk/core', () => {
  const actual = jest.requireActual('@totemsdk/core');
  return { ...actual, prepareLease: jest.fn(), finalizeLease: jest.fn() };
});

const prepareMock = prepareLease as unknown as jest.Mock;
const finalizeMock = finalizeLease as unknown as jest.Mock;

function makeProvider(): AxiaLeaseProvider {
  return new AxiaLeaseProvider({
    apiUrl: 'http://localhost:1',
    apiKey: 'k',
    rootPublicKey: '0x' + 'ab'.repeat(32),
    storage: new MemoryStore(),
  });
}

describe('RFC-020 C2: Axia lease provider reuse detection', () => {
  beforeEach(() => {
    prepareMock.mockReset();
    finalizeMock.mockReset();
    finalizeMock.mockResolvedValue({ status: 200, body: 'ok' });
  });

  it('rejects a lease server that replays an already-committed index', async () => {
    prepareMock.mockResolvedValueOnce({ leaseToken: 't1', txId: 'r1', lease: { addressIndex: 0, l1: 0, l2: 0 } });
    const provider = makeProvider();
    const first = await provider.reserveKeyUse({ treeId: 'tree-1' });
    await provider.commitKeyUse(first.reservationId, 'tx-1');

    // Hostile replay: same slot again.
    prepareMock.mockResolvedValueOnce({ leaseToken: 't2', txId: 'r2', lease: { addressIndex: 0, l1: 0, l2: 0 } });
    await expect(provider.reserveKeyUse({ treeId: 'tree-1' })).rejects.toBeInstanceOf(IndicesUnavailableError);
  });

  it('keys the watermark by the real treeId (not a reservation id)', async () => {
    prepareMock.mockResolvedValueOnce({ leaseToken: 't3', txId: 'r3', lease: { addressIndex: 1, l1: 2, l2: 3 } });
    const provider = makeProvider();
    const reservation = await provider.reserveKeyUse({ treeId: 'tree-2' });
    await provider.commitKeyUse(reservation.reservationId, 'tx-2');

    const watermark = await provider.getLocalWatermark('tree-2');
    expect(watermark.unavailableCount).toBeGreaterThan(0);

    // A different tree is unaffected.
    expect((await provider.getLocalWatermark('other-tree')).unavailableCount).toBe(0);
  });
});

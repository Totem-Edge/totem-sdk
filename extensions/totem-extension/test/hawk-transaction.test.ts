/**
 * Hawk transaction backend (RFC-062 Amendment A / RFC-073).
 *
 * Verifies the local-node path without Chrome or a real node:
 *   prepare → local watermark reservation
 *   fetchCoinProofs → coinexport
 *   finalize → txnimport + txnpost
 *   finalizeMined → sendtransaction
 *   broadcast → txnimport + txnpost
 */

import './setup';

jest.mock('../src/core/providers/activeNode', () => ({
  resolveActiveNodeRpc: jest.fn(),
  isHawkTransactionMode: jest.fn(),
}));

jest.mock('../src/core/stores/WatermarkStore', () => ({
  watermarkStore: {
    initialize: jest.fn(),
    reserveNextIndicesForAddress: jest.fn(),
    markUsed: jest.fn(),
    releaseReservation: jest.fn(),
  },
}));

jest.mock('../src/core/stores/LeaseStore', () => ({
  leaseStore: {
    save: jest.fn(),
    getByToken: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

jest.mock('../src/core/stores/signingLock', () => ({
  withSigningLock: <T,>(fn: () => Promise<T>) => fn(),
}));

import { resolveActiveNodeRpc } from '../src/core/providers/activeNode';
import { watermarkStore } from '../src/core/stores/WatermarkStore';
import { leaseStore } from '../src/core/stores/LeaseStore';
import { HawkTransactionService } from '../src/core/transaction/hawkTransactionService';

const node = (overrides: Record<string, jest.Mock> = {}) => ({
  client: {
    coinExport: jest.fn(),
    txnImport: jest.fn(),
    txnPost: jest.fn(),
    txnCheck: jest.fn(),
    sendTransaction: jest.fn(),
    ...overrides,
  },
  url: 'http://127.0.0.1:9005',
  mode: 'minima-rpc' as const,
});

const indices = { addressIndex: 3, l1: 7, l2: 9 };

describe('HawkTransactionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (watermarkStore.initialize as jest.Mock).mockResolvedValue(undefined);
    (watermarkStore.reserveNextIndicesForAddress as jest.Mock).mockResolvedValue(indices);
    (watermarkStore.markUsed as jest.Mock).mockResolvedValue(undefined);
    (watermarkStore.releaseReservation as jest.Mock).mockResolvedValue(undefined);
    (leaseStore.save as jest.Mock).mockResolvedValue(undefined);
    (leaseStore.updateStatus as jest.Mock).mockResolvedValue(undefined);
  });

  test('prepare reserves local indices and records a lease', async () => {
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(node());

    const prepared = await HawkTransactionService.prepare(
      { addressIndex: 3, txId: 'tx-1' },
      '0x' + 'aa'.repeat(32),
    );

    expect(watermarkStore.initialize).toHaveBeenCalled();
    expect(watermarkStore.reserveNextIndicesForAddress).toHaveBeenCalledWith(3);
    expect(prepared).toMatchObject({
      addressIndex: 3,
      l1: 7,
      l2: 9,
      paramSet: 'hawk-local-v1',
    });
    expect(prepared.leaseToken).toMatch(/^hawk-token-/);
    expect(leaseStore.save).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseToken: prepared.leaseToken,
        indices,
        status: 'active',
        txId: 'tx-1',
      }),
    );
  });

  test('prepare requires an addressIndex', async () => {
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(node());
    await expect(
      HawkTransactionService.prepare({ txId: 'tx-1' }, '0xroot'),
    ).rejects.toThrow(/addressIndex/);
  });

  test('prepare fails closed without a consented node', async () => {
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(null);
    await expect(
      HawkTransactionService.prepare({ addressIndex: 0 }, '0xroot'),
    ).rejects.toThrow(/not configured or its URL is not consented/);
  });

  test('fetchCoinProofs uses coinexport and returns bare hex in order', async () => {
    const n = node();
    n.client.coinExport
      .mockResolvedValueOnce({ data: '0xdead' })
      .mockResolvedValueOnce({ data: '0xBEEF' });
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(n);

    const proofs = await HawkTransactionService.fetchCoinProofs('lease', ['0x01', '0x02']);

    expect(n.client.coinExport).toHaveBeenNthCalledWith(1, '0x01');
    expect(n.client.coinExport).toHaveBeenNthCalledWith(2, '0x02');
    expect(proofs).toEqual(['dead', 'BEEF']);
  });

  test('finalize imports and mines the signed TxnRow', async () => {
    const n = node();
    n.client.txnImport.mockResolvedValue(undefined);
    n.client.txnPost.mockResolvedValue({ txpowid: '0x' + 'dd'.repeat(32) });
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(n);
    (leaseStore.getByToken as jest.Mock).mockReturnValue({
      leaseId: 'lease-1',
      leaseToken: 'token-1',
      indices,
      status: 'active',
    });

    const result = await HawkTransactionService.finalize({
      leaseToken: 'token-1',
      signedHex: '0xdeadbeef',
      importId: 'import-1',
    });

    expect(n.client.txnImport).toHaveBeenCalledWith('deadbeef', 'import-1');
    expect(n.client.txnPost).toHaveBeenCalledWith({ id: 'import-1', mine: true });
    expect(watermarkStore.markUsed).toHaveBeenCalledWith(indices);
    expect(leaseStore.updateStatus).toHaveBeenCalledWith('lease-1', 'finalized');
    expect(result).toEqual({
      ok: true,
      leaseId: 'lease-1',
      txpowid: '0x' + 'dd'.repeat(32),
    });
  });

  test('finalize never releases a leaf after signing, even when txnpost fails', async () => {
    const n = node();
    n.client.txnImport.mockResolvedValue(undefined);
    n.client.txnPost.mockRejectedValue(new Error('node rejected'));
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(n);
    (leaseStore.getByToken as jest.Mock).mockReturnValue({
      leaseId: 'lease-1',
      leaseToken: 'token-1',
      indices,
      status: 'active',
    });

    await expect(
      HawkTransactionService.finalize({ leaseToken: 'token-1', signedHex: '0xdeadbeef' }),
    ).rejects.toThrow('node rejected');

    expect(watermarkStore.markUsed).toHaveBeenCalledWith(indices);
    expect(watermarkStore.releaseReservation).not.toHaveBeenCalled();
    expect(leaseStore.updateStatus).toHaveBeenCalledWith('lease-1', 'cancelled');
  });

  test('finalize reads the TxnRow import id when no importId is supplied', async () => {
    const n = node();
    n.client.txnImport.mockResolvedValue(undefined);
    n.client.txnPost.mockResolvedValue({ txpowid: '0x' + 'ee'.repeat(32) });
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(n);
    (leaseStore.getByToken as jest.Mock).mockReturnValue(null);

    // uint32 length 4 || "tx-1" || payload
    const idHex = Buffer.from('tx-1').toString('hex');
    const txnRow = '00000004' + idHex + 'deadbeef';

    await HawkTransactionService.finalize({ leaseToken: 'unknown', signedHex: txnRow });

    expect(n.client.txnImport).toHaveBeenCalledWith(txnRow, 'tx-1');
    expect(n.client.txnPost).toHaveBeenCalledWith({ id: 'tx-1', mine: true });
  });

  test('finalizeMined submits a pre-mined TxPoW', async () => {
    const n = node();
    n.client.sendTransaction.mockResolvedValue({ txpowid: '0x' + 'ab'.repeat(32) });
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(n);
    (leaseStore.getByToken as jest.Mock).mockReturnValue({
      leaseId: 'lease-1',
      leaseToken: 'token-1',
      indices,
      status: 'active',
    });

    const result = await HawkTransactionService.finalizeMined({
      leaseToken: 'token-1',
      minedHex: '0xMINE',
    });

    expect(n.client.sendTransaction).toHaveBeenCalledWith('MINE');
    expect(result.txpowid).toBe('0x' + 'ab'.repeat(32));
  });

  test('broadcast imports, checks, and mines a pre-signed TxnRow', async () => {
    const n = node();
    n.client.txnImport.mockResolvedValue(undefined);
    n.client.txnCheck.mockResolvedValue({ validtransaction: true });
    n.client.txnPost.mockResolvedValue({ txpowid: '0x' + 'cd'.repeat(32) });
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(n);

    const result = await HawkTransactionService.broadcastSignedHex('0xdeadbeef');

    expect(n.client.txnImport).toHaveBeenCalled();
    expect(n.client.txnCheck).toHaveBeenCalled();
    expect(n.client.txnPost).toHaveBeenCalledWith({
      id: expect.any(String),
      mine: true,
    });
    expect(result.txpowid).toBe('0x' + 'cd'.repeat(32));
  });

  test('broadcast fails closed without a node', async () => {
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(null);
    await expect(HawkTransactionService.broadcastSignedHex('0xdeadbeef')).rejects.toThrow(
      /not configured or its URL is not consented/,
    );
  });
});

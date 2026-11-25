/**
 * Prepared-send flow: review and signing must use the same transaction bytes.
 */

import './setup';

jest.mock('@noble/hashes/sha3.js', () => {
  const sha3_256: any = (_data: Uint8Array) => new Uint8Array(32);
  sha3_256.arrayBuffer = (_data: Uint8Array) => new ArrayBuffer(32);
  return { sha3_256 };
});

jest.mock('../src/core/transaction/CoinSelectionService', () => {
  const actual = jest.requireActual('../src/core/transaction/CoinSelectionService');
  return {
    ...actual,
    coinSelectionService: { selectCoinsForSend: jest.fn() },
  };
});

jest.mock('../src/core/transaction/service', () => ({
  TransactionService: { fetchCoinProofs: jest.fn() },
}));

const mockFinalize = jest.fn();
const mockSign = jest.fn();
const mockLease = jest.fn();

jest.mock('../src/core/wallet', () => ({
  walletManager: {
    getAddressIndex: jest.fn(() => 0),
    requestLease: (...args: any[]) => mockLease(...args),
    getAccountByIndex: jest.fn(() => ({ publicKey: '0x' + '66'.repeat(32) })),
    getAllAddresses: jest.fn(() => ['0x' + '11'.repeat(32)]),
    signTransactionPerAddress: (...args: any[]) => mockSign(...args),
    finalizeTransaction: (...args: any[]) => mockFinalize(...args),
  },
}));

jest.mock('../src/core/transaction/MinimaTransactionBuilder', () => {
  const actual = jest.requireActual('../src/core/transaction/MinimaTransactionBuilder');
  return {
    ...actual,
    extractCoinDataFromCoinProof: jest.fn(() => ({
      coinId: new Uint8Array(32).fill(0x33),
      address: new Uint8Array(32).fill(0x11),
      rawAmountBytes: new Uint8Array([0x00, 0x01, 0x0a]),
      tokenId: new Uint8Array([0x00]),
      storeState: true,
      mmrEntryNumber: 0n,
      rawMmrEntryBytes: new Uint8Array(),
      spent: false,
      blockCreated: 0n,
      rawBlockCreatedBytes: new Uint8Array(),
      state: [],
    })),
    serializeForTxnImport: jest.fn(() => new Uint8Array([0x01, 0x02, 0x03])),
  };
});

import { coinSelectionService } from '../src/core/transaction/CoinSelectionService';
import { TransactionService } from '../src/core/transaction/service';
import { serializeForTxnImport } from '../src/core/transaction/MinimaTransactionBuilder';
import { prepareSimpleSend, sendPrepared } from '../src/core/transaction/preparedSend';

const SOURCE = '0x' + '11'.repeat(32);
const RECIPIENT = '0x' + '22'.repeat(32);
const COIN = '0x' + '33'.repeat(32);
const FIVE_MINIMA = (5n * (10n ** 44n)).toString();

describe('prepared simple send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (coinSelectionService.selectCoinsForSend as jest.Mock).mockResolvedValue({
      selectedCoins: [
        { coinId: COIN, address: SOURCE, amount: '10', tokenid: '0x00', created: 1 },
      ],
      totalSelected: '10',
      change: '5',
      insufficientFunds: false,
      fromAddresses: [SOURCE],
    });
    (TransactionService.fetchCoinProofs as jest.Mock).mockResolvedValue(['deadbeef']);
    mockLease.mockResolvedValue({
      addressIndex: 0,
      l1: 1,
      l2: 2,
      leaseToken: 'lease-token',
      leaseId: 'lease-id',
    });
    mockSign.mockResolvedValue({
      witnessBundle: {
        addressIndex: 0,
        l1: 1,
        l2: 2,
        rootPublicKey: '0x' + '66'.repeat(32),
        proofs: [
          {
            leafPubkey: '0x' + 'aa'.repeat(32),
            signature: '0x' + 'bb'.repeat(1088),
            mmrProof: '0x00',
          },
        ],
      },
    });
    mockFinalize.mockResolvedValue({
      ok: true,
      txpowid: '0x' + 'dd'.repeat(32),
      leaseId: 'lease-id',
    });
  });

  test('review preview and signing share one prepared transaction', async () => {
    const preview = await prepareSimpleSend({
      to: RECIPIENT,
      amount: FIVE_MINIMA,
      tokenid: '0x00',
      sourceAddress: SOURCE,
    });

    expect(preview.prepareId).toMatch(/^prepared-/);
    expect(preview.outputs.map(o => o.amount)).toEqual(['5', '5']);
    expect(preview.digestTxHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(mockSign).not.toHaveBeenCalled();

    const result = await sendPrepared(preview.prepareId);

    expect(result.txpowid).toBe('0x' + 'dd'.repeat(32));
    expect(mockSign).toHaveBeenCalledWith(
      expect.objectContaining({ digestTx: preview.digestTxHex }),
    );
    expect(serializeForTxnImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/^totem-/),
      expect.anything(),
      ['deadbeef'],
      expect.any(Array),
      expect.anything(),
    );
    expect(mockFinalize).toHaveBeenCalled();

    await expect(sendPrepared(preview.prepareId)).rejects.toThrow(/expired|not found/i);
  });
});

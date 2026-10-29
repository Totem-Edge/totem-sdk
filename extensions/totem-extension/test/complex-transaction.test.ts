/**
 * Complex/scripted transaction assembly (TOTEM_SEND_COMPLEX).
 *
 * Exercises the enhanced builder + local signing + backend finalize path with
 * mocked wallet/backend dependencies.
 */

import './setup';

// The complex builder pulls in minima-base32, which imports the ESM-only
// @noble/hashes package. Jest's transformIgnorePatterns leave it untransformed;
// this test only uses 0x addresses, so a deterministic stub is sufficient.
jest.mock('@noble/hashes/sha3.js', () => {
  const sha3_256: any = (_data: Uint8Array) => new Uint8Array(32);
  sha3_256.arrayBuffer = (_data: Uint8Array) => new ArrayBuffer(32);
  return { sha3_256 };
});

jest.mock('../src/core/providers/activeNode', () => ({
  isHawkTransactionMode: jest.fn(),
}));

jest.mock('../src/core/transaction/service', () => ({
  TransactionService: { fetchCoinProofs: jest.fn() },
}));

jest.mock('../src/core/wallet', () => ({
  walletManager: {
    getAddressIndex: jest.fn(),
    requestLease: jest.fn(),
    signTransactionPerAddress: jest.fn(),
    finalizeTransaction: jest.fn(),
  },
}));

import { isHawkTransactionMode } from '../src/core/providers/activeNode';
import { TransactionService } from '../src/core/transaction/service';
import { walletManager } from '../src/core/wallet';
import { buildComplexUnsigned, sendComplex } from '../src/core/transaction/complexTransactionService';

const hex32 = (b: string) => '0x' + b.repeat(32);
const ADDRESS = hex32('22');
const COIN = hex32('11');
const OUTPUT = hex32('33');
const ROOT = hex32('44');

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    inputs: [
      {
        coinId: COIN,
        address: ADDRESS,
        amount: '1',
        scriptDescriptor: {
          scriptType: 'custom',
          script: 'RETURN TRUE',
        },
      },
    ],
    outputs: [{ address: OUTPUT, amount: '1' }],
    ...overrides,
  };
}

function witnessBundle() {
  return {
    addressIndex: 0,
    l1: 1,
    l2: 2,
    rootPublicKey: ROOT,
    proofs: [
      {
        leafPubkey: hex32('aa'),
        signature: '0x' + 'bb'.repeat(1088),
        mmrProof: '0x00',
      },
    ],
  };
}

describe('complex transaction service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isHawkTransactionMode as jest.Mock).mockResolvedValue(true);
    (walletManager.getAddressIndex as jest.Mock).mockReturnValue(0);
    (walletManager.requestLease as jest.Mock).mockResolvedValue({
      addressIndex: 0,
      l1: 1,
      l2: 2,
      leaseToken: 'lease-token',
      leaseId: 'lease-id',
    });
    (walletManager.signTransactionPerAddress as jest.Mock).mockResolvedValue({
      witnessBundle: witnessBundle(),
    });
    (walletManager.finalizeTransaction as jest.Mock).mockResolvedValue({
      ok: true,
      txpowid: hex32('dd'),
    });
    (TransactionService.fetchCoinProofs as jest.Mock).mockResolvedValue(['deadbeef']);
  });

  test('build mode returns the unsigned tx, digest and fetched proofs without signing', async () => {
    const built = await buildComplexUnsigned(buildParams());

    expect(built.unsignedHex).toMatch(/^0x[0-9a-f]+$/);
    expect(built.digestTxHex).toMatch(/^0x[0-9a-f]{64}$/);
    expect(built.inputCoinProofs[0]).toMatchObject({
      coinId: COIN,
      proof: '0xdeadbeef',
    });
    expect(walletManager.requestLease).not.toHaveBeenCalled();
    expect(walletManager.signTransactionPerAddress).not.toHaveBeenCalled();
    expect(walletManager.finalizeTransaction).not.toHaveBeenCalled();
  });

  test('submit mode reserves a lease, signs locally and finalizes the TxnRow', async () => {
    const result = await sendComplex(buildParams(), 'contract_call');

    expect(walletManager.requestLease).toHaveBeenCalledWith(
      expect.objectContaining({ addressIndex: 0 }),
    );
    expect(TransactionService.fetchCoinProofs).toHaveBeenCalledWith('lease-token', [COIN]);
    expect(walletManager.signTransactionPerAddress).toHaveBeenCalledWith(
      expect.objectContaining({ addressIndex: 0, l1: 1, l2: 2 }),
    );
    expect(walletManager.finalizeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        leaseToken: 'lease-token',
        signedHex: expect.stringMatching(/^0x[0-9a-f]+$/),
        importId: expect.stringMatching(/^totem-/),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      mode: 'submit',
      txpowid: hex32('dd'),
      detectedIntent: 'contract_call',
      inputCount: 1,
      outputCount: 1,
    });
  });

  test('rejects an input set with no wallet-owned address', async () => {
    (walletManager.getAddressIndex as jest.Mock).mockReturnValue(null);

    await expect(sendComplex(buildParams())).rejects.toThrow(
      /None of the input addresses belong to this wallet/,
    );
  });

  test('rejects multiple distinct wallet-owned addresses', async () => {
    (walletManager.getAddressIndex as jest.Mock)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1);

    const params = buildParams({
      inputs: [
        {
          coinId: hex32('11'),
          address: hex32('22'),
          amount: '1',
          scriptDescriptor: { scriptType: 'custom', script: 'RETURN TRUE' },
        },
        {
          coinId: hex32('12'),
          address: hex32('23'),
          amount: '1',
          scriptDescriptor: { scriptType: 'custom', script: 'RETURN TRUE' },
        },
      ],
    });

    await expect(sendComplex(params)).rejects.toThrow(/multiple wallet addresses/i);
  });
});

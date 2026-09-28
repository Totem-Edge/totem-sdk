/**
 * signtoken key-reuse guard — wallet-mock tests (RFC-005 #2/#11).
 *
 * The token coinId is a different message than the transaction digest, so it
 * must be signed with a distinct WOTS leaf. These tests mock the wallet lease +
 * signing and assert the guard.
 */
import { signTokenCoinId, TokenSignKeyReuseError } from '../src/core/transaction/signtoken';
import type { SignTokenCoinIdParams, WotsLeaf } from '../src/core/transaction/signtoken';

const TOKEN_COIN_ID = '0x' + 'ab'.repeat(32);
const TX_LEAF: WotsLeaf = { addressIndex: 0, l1: 3, l2: 7 };

interface Deps {
  params: SignTokenCoinIdParams;
  requestLease: jest.Mock;
  signTransactionPerAddress: jest.Mock;
  signCalls: Array<{ addressIndex: number; l1: number; l2: number; digestTx: string }>;
}

function makeDeps(lease: WotsLeaf): Deps {
  const signCalls: Deps['signCalls'] = [];
  const requestLease = jest.fn(async () => lease);
  const signTransactionPerAddress = jest.fn(async (p: Deps['signCalls'][number]) => {
    signCalls.push(p);
    return { signedHex: '0xSIGNED' };
  });
  return {
    requestLease,
    signTransactionPerAddress,
    signCalls,
    params: {
      txLeaf: TX_LEAF,
      requestLease,
      signTransactionPerAddress,
      tokenCoinIdHex: TOKEN_COIN_ID,
      txId: 'tx1',
      addressIndex: 0,
    },
  };
}

describe('signtoken key-reuse guard', () => {
  it('signs the token coinId with a distinct leaf and returns the signature', async () => {
    const d = makeDeps({ addressIndex: 0, l1: 3, l2: 8 });
    const hex = await signTokenCoinId(d.params);
    expect(hex).toBe('0xSIGNED');
    expect(d.requestLease).toHaveBeenCalledWith({ txId: 'tokensign-tx1', addressIndex: 0 });
    expect(d.signCalls).toEqual([
      { addressIndex: 0, l1: 3, l2: 8, digestTx: TOKEN_COIN_ID },
    ]);
  });

  it('refuses to reuse the transaction leaf (key reuse) and does not sign', async () => {
    const d = makeDeps({ addressIndex: 0, l1: 3, l2: 7 });
    await expect(signTokenCoinId(d.params)).rejects.toBeInstanceOf(TokenSignKeyReuseError);
    expect(d.signTransactionPerAddress).not.toHaveBeenCalled();
  });

  it('allows a different addressIndex (distinct TreeKey)', async () => {
    const d = makeDeps({ addressIndex: 1, l1: 3, l2: 7 });
    await expect(signTokenCoinId(d.params)).resolves.toBe('0xSIGNED');
  });

  it('allows a different l1/l2 on the same address', async () => {
    const d = makeDeps({ addressIndex: 0, l1: 4, l2: 7 });
    await expect(signTokenCoinId(d.params)).resolves.toBe('0xSIGNED');
  });
});

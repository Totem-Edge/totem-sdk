/**
 * Coin lookup defaults for a paired lookup node.
 *
 * A Hawk lookup node's `coins address:…` command only searches the node
 * wallet's relevant set. Extension/dApp addresses are not in that wallet, so
 * the provider query must ask for the MegaMMR (the node's UTXO set).
 */

import './setup';

jest.mock('../src/core/config/activeChainProvider', () => ({
  resolveActiveChainProvider: jest.fn(),
}));

import { resolveActiveChainProvider } from '../src/core/config/activeChainProvider';
import { coinSelectionService } from '../src/core/transaction/CoinSelectionService';

const ADDRESS = 'MxG080DP9FYHSVE9E3NF9NY58FP1ZYGQRN2RNTG34R7ASV1PM8M405D0JSGG04P';

describe('CoinSelectionService node lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('searches the node MegaMMR by default', async () => {
    const getCoins = jest.fn().mockResolvedValue([]);
    (resolveActiveChainProvider as jest.Mock).mockResolvedValue({
      provider: { getCoins },
    });

    await coinSelectionService.fetchSpendableCoins([ADDRESS], '*');

    expect(getCoins).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ADDRESS,
        megammr: true,
      }),
    );
  });

  test('does not send the node-only megammr flag to the Axia REST endpoint', async () => {
    (resolveActiveChainProvider as jest.Mock).mockResolvedValue(null);
    (chrome.storage.local as any).getTyped = jest.fn((_keys, callback) =>
      callback({ AXIA_BASE: 'https://api.axia.to' }),
    );

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ coins: [] }),
    });
    global.fetch = fetchMock;

    await coinSelectionService.fetchSpendableCoins([ADDRESS], '*');

    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.megammr).toBeUndefined();
    expect(body.relevant).toBeUndefined();
  });

  test('matches the selected Mx address against hex coin addresses', () => {
    const result = coinSelectionService.selectCoins(
      [
        {
          coinId: '0x' + '11'.repeat(32),
          address: '0x0DCA5F58F3EE4B8777A6F52A1F90E2B0D6EE2DDFB019367573E1CD916200AD04',
          amount: '1',
          tokenid: '0x00',
          created: 1,
        },
      ],
      {
        mode: 'focused',
        focusedAddress: ADDRESS,
        targetAmount: '0.5',
      },
    );

    expect(result.selectedCoins).toHaveLength(1);
    expect(result.insufficientFunds).toBe(false);
  });
});

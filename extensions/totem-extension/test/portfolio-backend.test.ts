/**
 * Portfolio source selection.
 *
 * There is exactly one portfolio source per mode:
 *   - a paired/self-hosted node → node `balance … tokendetails:true`
 *   - Axia mode                → `/v1/wallet/portfolio/:address`
 *
 * The old `/v1/wallet/coins` fallback was a UTXO endpoint and silently dropped
 * token metadata. These tests pin the single-route contract.
 */

import './setup';

jest.mock('../src/core/providers/activeNode', () => ({
  resolveActiveNodeRpc: jest.fn(),
}));

import { resolveActiveNodeRpc } from '../src/core/providers/activeNode';
import { walletPortfolioBackend } from '../src/core/portfolio';

const ADDRESS = 'MxG080DP9FYHSVE9E3NF9NY58FP1ZYGQRN2RNTG34R7ASV1PM8M405D0JSGG04P';

describe('walletPortfolioBackend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chrome.storage.local as any).getTyped = jest.fn().mockResolvedValue({
      AXIA_BASE: 'https://api.axia.to',
      AXIA_PROJECT_ID: 'totem-shared',
    });
    global.fetch = jest.fn();
  });

  test('uses the paired node balance route and keeps token metadata', async () => {
    const balance = jest.fn().mockResolvedValue([
      {
        tokenid: '0x' + 'cc'.repeat(32),
        confirmed: '999',
        unconfirmed: '0',
        token: {
          name: JSON.stringify({
            name: 'porq',
            ticker: 'porq',
            url: '<artimage>/9j/4AAQ</artimage>',
          }),
          decimals: 0,
        },
      },
    ]);
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue({ client: { balance } });

    const entries = await walletPortfolioBackend.getPortfolio(ADDRESS);

    expect(balance).toHaveBeenCalledWith({
      address: ADDRESS,
      megammr: true,
      tokendetails: true,
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      name: 'porq',
      ticker: 'porq',
      artimage: '<artimage>/9j/4AAQ</artimage>',
      kind: 'token',
    });
  });

  test('uses the Axia portfolio route when no node is configured', async () => {
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(null);
    const entries = [
      {
        kind: 'native',
        tokenid: '0x00',
        confirmed: '1',
        unconfirmed: '0',
        sendable: '1',
        total: '1',
        decimals: 8,
        name: 'Minima',
        ticker: 'MINIMA',
        address: ADDRESS,
      },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entries }),
    });

    const result = await walletPortfolioBackend.getPortfolio(ADDRESS);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/v1/wallet/portfolio/${ADDRESS}`),
      expect.objectContaining({ headers: { 'x-api-key': 'totem-shared' } }),
    );
    expect(result).toEqual(entries);
  });

  test('surfaces the API failure instead of falling back to /v1/wallet/coins', async () => {
    (resolveActiveNodeRpc as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '{"detail":"No active healthy node available"}',
    });

    await expect(walletPortfolioBackend.getPortfolio(ADDRESS)).rejects.toThrow(
      /Portfolio API 503.*No active healthy node available/,
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/v1/wallet/portfolio/');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).not.toContain('/v1/wallet/coins');
  });
});

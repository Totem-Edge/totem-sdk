import { createLiquidityPortAdapter } from '../liquidity';
import type { ChainStateProvider, Coin } from '@totemsdk/chain-provider';

function makeCoin(amount: string, tokenid = '0x00'): Coin {
  return { coinid: '0xABC', amount, address: 'MxFOO', tokenid };
}

function makeProvider(coins: Coin[] = []): jest.Mocked<Pick<ChainStateProvider, 'getCoins'>> & ChainStateProvider {
  return {
    getCoins: jest.fn().mockResolvedValue(coins),
    getCoin: jest.fn(),
    getProof: jest.fn(),
    getTip: jest.fn(),
    getToken: jest.fn(),
    searchTokens: jest.fn(),
    getTokensByCreator: jest.fn(),
    broadcastTxPoW: jest.fn(),
  } as unknown as jest.Mocked<ChainStateProvider> & ChainStateProvider;
}

describe('createLiquidityPortAdapter — getBalance', () => {
  it('sums sendable coin amounts for the default tokenId', async () => {
    const provider = makeProvider([makeCoin('10'), makeCoin('5')]);
    const port = createLiquidityPortAdapter({ provider });
    const result = await port.getBalance('MxFOO');
    expect(result.ok).toBe(true);
    expect(result.data?.balance).toBe('15');
    expect(result.data?.tokenId).toBe('0x00');
    expect(provider.getCoins).toHaveBeenCalledWith({
      address: 'MxFOO',
      tokenId: '0x00',
      sendable: true,
    });
  });

  it('returns balance 0 when no coins exist', async () => {
    const provider = makeProvider([]);
    const port = createLiquidityPortAdapter({ provider });
    const result = await port.getBalance('MxEMPTY');
    expect(result.ok).toBe(true);
    expect(result.data?.balance).toBe('0');
  });

  it('uses a custom defaultTokenId', async () => {
    const provider = makeProvider([makeCoin('7', '0xFEED')]);
    const port = createLiquidityPortAdapter({ provider, defaultTokenId: '0xFEED' });
    const result = await port.getBalance('MxFOO');
    expect(result.data?.tokenId).toBe('0xFEED');
    expect(provider.getCoins).toHaveBeenCalledWith(expect.objectContaining({ tokenId: '0xFEED' }));
  });

  it('returns ok:false when provider throws', async () => {
    const provider = makeProvider();
    (provider.getCoins as jest.Mock).mockRejectedValue(new Error('network down'));
    const port = createLiquidityPortAdapter({ provider });
    const result = await port.getBalance('MxFOO');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });
});

describe('createLiquidityPortAdapter — getUtxos', () => {
  it('returns all coins regardless of tokenId or sendable', async () => {
    const coins = [makeCoin('1', '0x00'), makeCoin('2', '0xFEED')];
    const provider = makeProvider(coins);
    const port = createLiquidityPortAdapter({ provider });
    const result = await port.getUtxos('MxFOO');
    expect(result.ok).toBe(true);
    expect(result.data?.utxos).toHaveLength(2);
    expect(provider.getCoins).toHaveBeenCalledWith({ address: 'MxFOO' });
  });

  it('returns ok:false when provider throws', async () => {
    const provider = makeProvider();
    (provider.getCoins as jest.Mock).mockRejectedValue(new Error('timeout'));
    const port = createLiquidityPortAdapter({ provider });
    const result = await port.getUtxos('MxFOO');
    expect(result.ok).toBe(false);
  });
});

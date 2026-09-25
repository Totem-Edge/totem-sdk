import { CoinSelectionService, type SpendableCoin } from '../coin-selection';

function coin(coinId: string, amount: string, tokenid: string): SpendableCoin {
  return { coinId, address: 'addr1', amount, tokenid, created: 0 };
}

const service = new CoinSelectionService({ fetchCoins: async () => [] });

const mixedCoins: SpendableCoin[] = [
  coin('native', '10', '0x00'),
  coin('native-alt', '5', '0x01'),
  coin('usdt', '100', '0xUSDT'),
];

describe('CoinSelectionService.selectCoins token filtering (AUD-046)', () => {
  it('excludes non-base coins when tokenId is omitted', () => {
    const result = service.selectCoins(mixedCoins, { mode: 'global', targetAmount: '8' });
    expect(result.insufficientFunds).toBe(false);
    expect(
      result.selectedCoins.every(c => c.tokenid === '0x00' || c.tokenid === '0x01'),
    ).toBe(true);
    expect(result.selectedCoins.map(c => c.coinId)).not.toContain('usdt');
    expect(result.totalSelected).toBe('10');
  });

  it('excludes non-base coins when tokenId is the native 0x00', () => {
    const result = service.selectCoins(mixedCoins, {
      mode: 'global',
      targetAmount: '8',
      tokenId: '0x00',
    });
    expect(result.insufficientFunds).toBe(false);
    expect(result.selectedCoins.every(c => c.tokenid !== '0xUSDT')).toBe(true);
    expect(result.selectedCoins.map(c => c.coinId)).not.toContain('usdt');
  });

  it('selects only the requested alt token when specified', () => {
    const result = service.selectCoins(mixedCoins, {
      mode: 'global',
      targetAmount: '50',
      tokenId: '0xUSDT',
    });
    expect(result.insufficientFunds).toBe(false);
    expect(result.selectedCoins).toHaveLength(1);
    expect(result.selectedCoins[0].coinId).toBe('usdt');
  });

  it('does not let non-base coin balance mask insufficient base funds', () => {
    const result = service.selectCoins(mixedCoins, { mode: 'global', targetAmount: '50' });
    expect(result.insufficientFunds).toBe(true);
    expect(result.selectedCoins.every(c => c.tokenid !== '0xUSDT')).toBe(true);
  });
});

/**
 * RFC-005 #7: WalletDiscovery non-browser fallback.
 */
import { WalletDiscovery } from '../index';
import type { DiscoveredWallet } from '../index';
import type { TotemProvider, TotemWalletInfo } from '../types.js';

function mockProvider(): TotemProvider {
  return {
    isTotem: true,
    request: async () => ({ ok: true }),
    on: () => undefined,
    removeListener: () => undefined,
  } as unknown as TotemProvider;
}

describe('WalletDiscovery manual registration (non-browser)', () => {
  it('registers and removes a wallet without window events', () => {
    const discovery = new WalletDiscovery();
    const counts: number[] = [];
    const unsubscribe = discovery.onChange(wallets => counts.push(wallets.length));

    const wallet: DiscoveredWallet = {
      info: { id: 'node-wallet', name: 'Node Wallet', version: '1.0.0' } as TotemWalletInfo,
      provider: mockProvider(),
    };

    discovery.addWallet(wallet);
    expect(discovery.getWallets().map(w => w.info.id)).toEqual(['node-wallet']);
    expect(counts).toContain(1);

    discovery.removeWallet('node-wallet');
    expect(discovery.getWallets()).toHaveLength(0);

    unsubscribe();
    discovery.destroy();
  });

  it('ignores malformed registrations', () => {
    const discovery = new WalletDiscovery();
    discovery.addWallet({ info: undefined as unknown as TotemWalletInfo, provider: mockProvider() });
    expect(discovery.getWallets()).toHaveLength(0);
    discovery.destroy();
  });
});

import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

describe('omnia-host JSON-RPC methods', () => {
  it('returns channel summaries using connect-compatible strings', async () => {
    const channels = new Map<string, any>([['channel-1', {
      channelId: 'channel-1',
      status: 'active',
      tokenId: '0x00',
      totalValue: 10n,
      balances: { alice: 7n, bob: 3n },
      parties: [{ partyId: 'alice' }, { partyId: 'bob' }],
      currentSequence: 4,
    }]]);
    const methods = createHostMethods({ channels, routing: new InProcessRoutingProvider() });

    expect(methods.get('totem_omniaGetChannels')!({ origin: 'test' })).toEqual({
      channels: [{
        channelId: 'channel-1',
        status: 'active',
        tokenId: '0x00',
        totalValue: '10',
        localBalance: '7',
        remoteBalance: '3',
        currentSequence: 4,
      }],
    });
  });
});

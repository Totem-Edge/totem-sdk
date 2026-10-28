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

  it('discovers funding coins and reports missing proofs honestly', async () => {
    const methods = createHostMethods({
      channels: new Map(),
      routing: new InProcessRoutingProvider(),
      chainProvider: {
        getCoins: async () => [{
          coinid: '0x' + '11'.repeat(32), amount: '100', address: 'MxFund',
          tokenid: '0x00',
        }],
        getProof: async () => { throw new Error('not available'); },
      } as any,
    });
    const result = await methods.get('totem_omniaGetFundingCoins')!({ address: 'MxFund' }) as any;
    expect(result.coins).toHaveLength(1);
    expect(result.coins[0].proof).toBeUndefined();
    expect(result.limitations.join(' ')).toContain('wallet-relevant');
  });

  it('exposes a fully serializable channel state (CAN-006)', () => {
    const channels = new Map<string, any>([['channel-1', {
      channelId: 'channel-1',
      status: 'active',
      channelType: 'direct',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      currentSequence: 4,
      fundingAddress: 'addr',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      parties: [
        { partyId: 'alice', publicKeyDigest: 'a', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'b', addressIndex: 1 },
      ],
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      latestState: {
        sequence: 4,
        balances: { alice: 7n, bob: 3n },
        pendingHTLCs: [],
        stateVariables: [{ port: 101, value: 4n, type: 'number' }],
        transactionHex: '0xabcd',
        signatures: { alice: new Uint8Array([1, 2]) },
        signingIndices: {},
      },
      stateLog: [],
      createdAt: 1,
      updatedAt: 2,
    }]]);
    const methods = createHostMethods({ channels, routing: new InProcessRoutingProvider() });
    const view = methods.get('totem_omniaGetChannelState')!({ channelId: 'channel-1' }) as Record<string, any>;

    expect(() => JSON.stringify(view)).not.toThrow();
    expect(view.totalValue).toBe('10');
    expect(view.balances).toEqual({ alice: '7', bob: '3' });
    expect(view.currentSequence).toBe(4);
    expect(view.latestState.signatures).toEqual(['alice']);
    expect(view.latestState.stateVariables[0].value).toBe('4');
    expect(() => methods.get('totem_omniaGetChannelState')!({ channelId: 'missing' })).toThrow(/not found/);
  });
});

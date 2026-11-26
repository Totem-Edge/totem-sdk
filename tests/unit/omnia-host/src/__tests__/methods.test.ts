import { amountToAtoms } from '@totemsdk/core';
import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

/** Channel/pool internals are integer atoms; RPC amounts are decimal MINIMA text. */
const atoms = (value: string | number) => amountToAtoms(String(value));

describe('omnia-host JSON-RPC methods', () => {
  it('returns channel summaries using connect-compatible strings', async () => {
    const channels = new Map<string, any>([['channel-1', {
      channelId: 'channel-1',
      status: 'active',
      tokenId: '0x00',
      totalValue: atoms('10'),
      balances: { alice: atoms('7'), bob: atoms('3') },
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

  it('exposes a fully serializable channel state (CAN-006)', async () => {
    const channels = new Map<string, any>([['channel-1', {
      channelId: 'channel-1',
      status: 'active',
      channelType: 'direct',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: atoms('10'),
      currentSequence: 4,
      fundingAddress: 'addr',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      parties: [
        { partyId: 'alice', publicKeyDigest: 'a', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'b', addressIndex: 1 },
      ],
      balances: { alice: atoms('7'), bob: atoms('3') },
      pendingHTLCs: [],
      latestState: {
        sequence: 4,
        balances: { alice: atoms('7'), bob: atoms('3') },
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
    const view = await methods.get('totem_omniaGetChannelState')!({ channelId: 'channel-1' }) as Record<string, any>;

    expect(() => JSON.stringify(view)).not.toThrow();
    expect(view.totalValue).toBe('10');
    expect(view.balances).toEqual({ alice: '7', bob: '3' });
    expect(view.currentSequence).toBe(4);
    expect(view.latestState.signatures).toEqual(['alice']);
    expect(view.latestState.stateVariables[0].value).toBe('4');
    await expect(methods.get('totem_omniaGetChannelState')!({ channelId: 'missing' })).rejects.toThrow(/not found/);
  });

  it('activates an opening channel once its funding coin is confirmed', async () => {
    const channels = new Map<string, any>([['channel-1', {
      channelId: 'channel-1',
      status: 'opening',
      channelType: 'direct',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: atoms('10'),
      currentSequence: 0,
      fundingCoinId: 'coin',
      parties: [
        { partyId: 'alice', publicKeyDigest: 'a', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'b', addressIndex: 1 },
      ],
      balances: { alice: atoms('6'), bob: atoms('4') },
      pendingHTLCs: [],
      stateLog: [],
      createdAt: 1,
      updatedAt: 2,
    }]]);
    const methods = createHostMethods({
      channels,
      routing: new InProcessRoutingProvider(),
      chainProvider: {
        getCoin: async () => ({
          coinid: 'coin', amount: '10', address: 'addr', tokenid: '0x00',
          spent: false, created: 10,
        }),
        getTip: async () => ({ block: 11 }),
      } as any,
    });

    const view = await methods.get('totem_omniaGetChannelState')!({ channelId: 'channel-1' }) as Record<string, any>;
    expect(view.status).toBe('active');
    expect(channels.get('channel-1')!.status).toBe('active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-099 (audit 3, OMN-097) — depth alone does not activate a channel
// ─────────────────────────────────────────────────────────────────────────────

describe('activation requires the peer acknowledgement', () => {
  function pendingChannel(over: Record<string, unknown> = {}) {
    return {
      channelId: 'channel-1',
      status: 'funding_pending',
      channelType: 'direct',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      currentSequence: 0,
      fundingCoinId: 'coin',
      parties: [
        { partyId: 'alice', publicKeyDigest: 'a', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'b', addressIndex: 1 },
      ],
      balances: { alice: 6n, bob: 4n },
      pendingHTLCs: [],
      stateLog: [],
      createdAt: 1,
      updatedAt: 2,
      ...over,
    };
  }

  const confirmedChain = {
    getCoin: async () => ({
      coinid: 'coin', amount: '10', address: 'addr', tokenid: '0x00', spent: false, created: 10,
    }),
    getTip: async () => ({ block: 11 }),
  } as any;

  it('does not promote a confirmed but unacknowledged channel', async () => {
    const channels = new Map<string, any>([['channel-1', pendingChannel()]]);
    const methods = createHostMethods({
      channels,
      routing: new InProcessRoutingProvider(),
      chainProvider: confirmedChain,
    });

    const view = await methods.get('totem_omniaGetChannelState')!({ channelId: 'channel-1' }) as Record<string, unknown>;
    expect(view.status).toBe('funding_pending');
    expect(channels.get('channel-1')!.status).toBe('funding_pending');
  });

  it('promotes once the peer has acknowledged and the coin is buried', async () => {
    const channels = new Map<string, any>([['channel-1', pendingChannel({ peerAcceptedAt: 5 })]]);
    const methods = createHostMethods({
      channels,
      routing: new InProcessRoutingProvider(),
      chainProvider: confirmedChain,
    });

    const view = await methods.get('totem_omniaGetChannelState')!({ channelId: 'channel-1' }) as Record<string, unknown>;
    expect(view.status).toBe('active');
  });
});

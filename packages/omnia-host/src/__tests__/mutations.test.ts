import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

function channel() {
  return {
    channelId: 'channel-1',
    fundingTxId: 'tx',
    fundingCoinId: 'coin',
    fundingScript: 'script',
    fundingAddress: 'address',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 10n,
    parties: [
      { partyId: 'alice', publicKeyDigest: 'alice-key', addressIndex: 0, settlementAddress: 'alice-address' },
      { partyId: 'bob', publicKeyDigest: 'bob-key', addressIndex: 1, settlementAddress: 'bob-address' },
    ],
    balances: { alice: 7n, bob: 3n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
  } as any;
}

function operationStore() {
  const records = new Map<string, any>();
  return {
    get: (id: string) => records.get(id),
    create: (id: string, request?: unknown) => {
      const record = { operationId: id, status: 'pending', request };
      records.set(id, record);
      return record;
    },
    transition: (id: string, _from: string, to: string, patch?: any) => {
      const record = records.get(id);
      record.status = to;
      record.result = patch?.result;
      record.error = patch?.error;
      return record;
    },
    listByStatus: () => [],
  };
}

describe('omnia-host mutations', () => {
  it('rejects mutations without signer capabilities', async () => {
    const methods = createHostMethods({
      channels: new Map([['channel-1', channel()]]),
      routing: new InProcessRoutingProvider(),
    });
    await expect(methods.get('totem_omniaPay')!({ operationId: 'op-1', channelId: 'channel-1', amount: '1' }))
      .rejects.toThrow('require signer');
  });

  it('updates a channel and replays committed operations', async () => {
    const channels = new Map([['channel-1', channel()]]);
    const operations = operationStore();
    const signer = {
      publicKeyDigest: 'alice-key',
      sign: jest.fn(async () => new Uint8Array(1088)),
    };
    const leaseProvider = {
      reserveKeyUse: jest.fn(async () => ({ reservationId: 'lease-1', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: Date.now() + 1000 })),
      commitKeyUse: jest.fn(async () => undefined),
      burnReservation: jest.fn(async () => undefined),
    } as any;
    const methods = createHostMethods({
      channels,
      operations: operations as any,
      routing: new InProcessRoutingProvider(),
      signer,
      leaseProvider,
      localParticipant: channels.get('channel-1')!.parties[0],
      chainProvider: { broadcastTxPoW: jest.fn() } as any,
    });

    const params = { operationId: 'op-1', channelId: 'channel-1', amount: '1' };
    const first = await methods.get('totem_omniaPay')!(params);
    const second = await methods.get('totem_omniaPay')!(params);
    expect(first).toMatchObject({ success: true, sequence: 1 });
    expect(second).toEqual(first);
    expect(signer.sign).toHaveBeenCalledTimes(1);
    expect(channels.get('channel-1')!.balances).toEqual({ alice: 6n, bob: 4n });
  });
});

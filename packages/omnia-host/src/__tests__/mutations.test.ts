import { _resetChannelWatermarks } from '@totemsdk/omnia';
import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

function channel(overrides: Record<string, unknown> = {}) {
  return {
    channelId: 'channel-1',
    fundingTxId: '0x' + '11'.repeat(32),
    fundingCoinId: '0x' + '22'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + '33'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 10n,
    parties: [
      { partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0, settlementAddress: '0x' + '44'.repeat(32) },
      { partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1, settlementAddress: '0x' + '55'.repeat(32) },
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
    ...overrides,
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

function mutationContext(channels: Map<string, any>, operations = operationStore()) {
  const signer = {
    publicKeyDigest: '0x' + 'aa'.repeat(32),
    sign: jest.fn(async () => new Uint8Array(1088)),
  };
  const leaseProvider = {
    reserveKeyUse: jest.fn(async () => ({ reservationId: 'lease-1', indices: { addressIndex: 0, l1: 0, l2: 0 }, expiresAt: Date.now() + 1000 })),
    commitKeyUse: jest.fn(async () => undefined),
    burnReservation: jest.fn(async () => undefined),
  } as any;
  return {
    context: {
      channels,
      operations: operations as any,
      routing: new InProcessRoutingProvider(),
      signer,
      leaseProvider,
      localParticipant: channels.get('channel-1')!.parties[0],
      chainProvider: { broadcastTxPoW: jest.fn() } as any,
    },
    signer,
    leaseProvider,
  };
}

describe('omnia-host mutations', () => {
  beforeEach(() => {
    _resetChannelWatermarks();
  });

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
    const { context, signer } = mutationContext(channels, operations);
    const methods = createHostMethods(context);

    const params = { operationId: 'op-1', channelId: 'channel-1', amount: '1' };
    const first = await methods.get('totem_omniaPay')!(params);
    const second = await methods.get('totem_omniaPay')!(params);
    expect(first).toMatchObject({ success: true, sequence: 1 });
    expect(second).toEqual(first);
    expect(signer.sign).toHaveBeenCalledTimes(2);
    expect(channels.get('channel-1')!.balances).toEqual({ alice: 6n, bob: 4n });
  });

  it('applies a generic program transition and persists the updated channel', async () => {
    const channels = new Map([['channel-1', channel({ programId: 'counter', programVersion: 1 })]]);
    const { context, signer } = mutationContext(channels);
    const methods = createHostMethods(context);

    const result = await methods.get('totem_omniaApplyProgramTransition')!({
      operationId: 'op-transition',
      channelId: 'channel-1',
      action: 'increment',
      inputs: { by: '3' },
    });

    expect(result).toMatchObject({ success: true, channelId: 'channel-1', sequence: 1, balances: { alice: '7', bob: '3' } });
    expect(channels.get('channel-1')!.latestState).toBeNull();
    expect(channels.get('channel-1')!.pendingProposal).toEqual(expect.objectContaining({ sequence: 1 }));
    expect(signer.sign).toHaveBeenCalledTimes(2);
  });

  it('exposes counter helper methods', async () => {
    const channels = new Map([['channel-1', channel({ programId: 'counter', programVersion: 1 })]]);
    const { context } = mutationContext(channels);
    const methods = createHostMethods(context);

    const result = await methods.get('totem_omniaIncrementCounter')!({
      operationId: 'op-counter',
      channelId: 'channel-1',
      by: '5',
    });

    expect(result).toMatchObject({ success: true, channelId: 'channel-1', sequence: 1 });
    expect(channels.get('channel-1')!.currentSequence).toBe(1);
    expect(channels.get('channel-1')!.balances).toEqual({ alice: 7n, bob: 3n });
  });

  it('records meter readings and transfers payer balance to payee', async () => {
    const channels = new Map([['channel-1', channel({ programId: 'meter', programVersion: 1 })]]);
    const { context } = mutationContext(channels);
    const methods = createHostMethods(context);

    const result = await methods.get('totem_omniaRecordMeterReading')!({
      operationId: 'op-meter',
      channelId: 'channel-1',
      reading: '2',
      unitPrice: '1',
    });

    expect(result).toMatchObject({ success: true, channelId: 'channel-1', sequence: 1, balances: { alice: '5', bob: '5' } });
    expect(channels.get('channel-1')!.balances).toEqual({ alice: 5n, bob: 5n });
  });

  it('rejects a reused operation ID with different request data', async () => {
    const records = new Map<string, any>();
    records.set('same', { operationId: 'same', status: 'committed', result: { success: true } });
    const operations = {
      get: (id: string) => records.get(id),
      create: (id: string, request: unknown) => {
        const record = { operationId: id, status: 'committed', request, result: { success: true } };
        records.set(id, record);
        return record;
      },
      transition: jest.fn(),
      listByStatus: () => [],
      verifyRequest: () => false,
    };
    const methods = createHostMethods({ channels: new Map(), routing: new InProcessRoutingProvider(), operations: operations as any });
    await expect(methods.get('totem_omniaCloseChannel')!({ operationId: 'same', channelId: 'other' }))
      .rejects.toThrow('does not match the original request');
  });
});

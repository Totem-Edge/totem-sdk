import { createObservationSnapshot } from '../observe/snapshot.js';

describe('observation snapshot serialization', () => {
  it('serializes BigInt values in channels, factories and operations', () => {
    const snapshot = createObservationSnapshot({
      networkId: 'test',
      sourceNodeId: 'host-a',
      streamId: 'host-a:omnia',
      cursor: 7,
      channels: [{
        channelId: 'ch-1',
        status: 'active',
        tokenId: '0x00',
        tokenScale: 0,
        totalValue: 100n,
        currentSequence: 1,
        fundingCoinId: '0x' + 'aa'.repeat(32),
        fundingTxId: '0x' + 'bb'.repeat(32),
        parties: [{ partyId: 'alice', contributionAmount: 100n }],
        balances: { alice: 60n, bob: 40n },
        pendingHTLCs: [],
        updatedAt: 1,
      } as never],
      factories: [{
        factoryId: 'factory-1',
        status: 'active',
        tokenId: '0x00',
        tokenScale: 0,
        participants: [{ partyId: 'alice', contributionAmount: 100n }],
        allocations: { alice: 100n },
        updatedAt: 1,
      } as never],
      operations: {
        listByStatus: () => [{
          operationId: 'op-1',
          status: 'pending',
          updatedAt: 1,
          payload: { amount: 5n },
        }],
      },
    });

    const json = JSON.stringify(snapshot);
    expect(json).toContain('"contributionAmount":"100"');
    expect(json).toContain('"alice":"60"');
    expect(json).not.toContain('100n');
    expect(json).not.toContain('5n');
  });
});

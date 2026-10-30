import { ObservationBus } from '../observe/bus.js';
import { ObservationEmitter, channelTransitionHash, hashTransition } from '../observe/emitter.js';
import { createObservationSnapshot } from '../observe/snapshot.js';
import { createMemoryObservationStore } from '../observe/store.js';

function fakeChannel(overrides: Record<string, unknown> = {}): any {
  return {
    channelId: 'ch-1',
    status: 'active',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 100n,
    currentSequence: 3,
    fundingCoinId: '0xfund',
    fundingTxId: '0xtx',
    parties: [
      { partyId: 'alice', publicKeyDigest: '0xaa' },
      { partyId: 'bob', publicKeyDigest: '0xbb' },
    ],
    balances: { alice: 60n, bob: 40n },
    pendingHTLCs: [],
    latestState: { sequence: 3, transactionHex: '0xdeadbeef' },
    updatedAt: 1,
    ...overrides,
  };
}

describe('observation store + emitter', () => {
  it('assigns durable sequences and replays from a cursor', async () => {
    const store = await createMemoryObservationStore({ namespace: 'test:observe:' });
    const bus = new ObservationBus();
    const received: number[] = [];
    bus.subscribe((obs) => received.push(obs.sourceSequence));
    const emitter = new ObservationEmitter({ store, bus, networkId: 'test', sourceNodeId: 'host-a' });

    const first = await emitter.emit({
      domain: 'channel', kind: 'channel.opened', phase: 'accepted',
      entity: { type: 'channel', id: 'ch-1' },
      amounts: { capacity: '100' },
    });
    const second = await emitter.emit({
      domain: 'channel', kind: 'channel.updated', phase: 'committed',
      entity: { type: 'channel', id: 'ch-1' },
      after: { sequence: 1 },
    });

    expect(first?.sourceSequence).toBe(1);
    expect(second?.sourceSequence).toBe(2);
    expect(received).toEqual([1, 2]);
    expect(await store.head()).toBe(2);
    expect((await store.readSince(0)).map((o) => o.sourceSequence)).toEqual([1, 2]);
    expect((await store.readSince(1)).map((o) => o.sourceSequence)).toEqual([2]);
    expect((await store.tail(1))[0]?.sourceSequence).toBe(2);
    await store.close();
  });

  it('redacts secrets and never throws into the caller', async () => {
    const store = await createMemoryObservationStore({ namespace: 'test:redact:' });
    const emitter = new ObservationEmitter({
      store, bus: new ObservationBus(), networkId: 'test', sourceNodeId: 'host-a',
    });
    const obs = await emitter.emit({
      domain: 'payment', kind: 'htlc.added', phase: 'committed',
      entity: { type: 'channel', id: 'ch-1' },
      data: {
        seed: 'do-not-leak',
        preimage: '0xdead',
        signature: '0xbeef',
        amount: 42n,
        note: 'x'.repeat(2000),
      },
    });
    expect(obs?.data?.['seed']).toBe('[redacted]');
    expect(obs?.data?.['preimage']).toBe('[redacted]');
    expect(obs?.data?.['signature']).toBe('[redacted]');
    expect(obs?.data?.['amount']).toBe('42');
    expect(String(obs?.data?.['note']).length).toBeLessThan(2000);
    await store.close();
  });

  it('hashes transitions deterministically', () => {
    expect(hashTransition(['a', 1, 'b'])).toBe(hashTransition(['a', 1, 'b']));
    expect(hashTransition(['a', 1, 'b'])).not.toBe(hashTransition(['a', 2, 'b']));
    const a = channelTransitionHash(fakeChannel());
    const b = channelTransitionHash(fakeChannel());
    expect(a).toBe(b);
    expect(channelTransitionHash(fakeChannel({ currentSequence: 4 }))).not.toBe(a);
  });

  it('projects a snapshot with a cursor and operations', () => {
    const snap = createObservationSnapshot({
      networkId: 'test',
      sourceNodeId: 'host-a',
      streamId: 'host-a:test',
      cursor: 7,
      channels: [fakeChannel()],
      factories: [],
      operations: { listByStatus: () => [{ operationId: 'op-1', status: 'committed', updatedAt: 5 }] },
    });
    expect(snap.cursor).toBe(7);
    expect(snap.state.channels).toHaveLength(1);
    expect((snap.state.channels[0] as any).balances).toEqual({ alice: '60', bob: '40' });
    expect((snap.state.channels[0] as any).totalValue).toBe('100');
    expect(snap.state.operations).toEqual([
      expect.objectContaining({ operationId: 'op-1', status: 'committed' }),
    ]);
  });
});

import { SqliteChannelStore } from '../stores/sqlite-store.js';
import { OperationStore } from '../stores/operations.js';
import type { OmniaChannel } from '@totemsdk/omnia';

function sqliteAvailable(): boolean {
  try {
    const store = new SqliteChannelStore(':memory:');
    store.close();
    return true;
  } catch (error) {
    if (String(error).includes('Could not locate the bindings file')) return false;
    throw error;
  }
}

const describeSqlite = sqliteAvailable() ? describe : describe.skip;

describeSqlite('SqliteChannelStore', () => {
  it('persists recoverable channel state and omits runtime signers', () => {
    const store = new SqliteChannelStore(':memory:');
    const signature = new Uint8Array([1, 2, 3, 4]);
    const channel = {
      channelId: 'channel-1',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      fundingScript: 'script',
      programId: 'eltoo-payment',
      programVersion: 1,
      fundingAddress: 'address',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      parties: [
        { partyId: 'alice', publicKeyDigest: 'alice-pkd', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'bob-pkd', addressIndex: 1 },
      ],
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      currentSequence: 2,
      latestState: {
        sequence: 2,
        balances: { alice: 7n, bob: 3n },
        pendingHTLCs: [],
        stateVariables: [],
        transactionHex: '0x1234',
        signatures: { alice: signature },
        signingIndices: { alice: { addressIndex: 0, l1: 0, l2: 2 } },
      },
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      localSigner: { sign: jest.fn(), publicKeyDigest: 'runtime-only' },
      createdAt: 1,
      updatedAt: 2,
    } as unknown as OmniaChannel;

    store.set(channel.channelId, channel);
    const loaded = store.get(channel.channelId)!;

    expect(loaded.totalValue).toBe(10n);
    expect(loaded.balances).toEqual({ alice: 7n, bob: 3n });
    expect(loaded.latestState?.signatures.alice).toBeInstanceOf(Uint8Array);
    expect(Array.from(loaded.latestState!.signatures.alice)).toEqual([1, 2, 3, 4]);
    expect(loaded.localSigner).toBeUndefined();
    expect(store.size).toBe(1);
    store.close();
  });

  it('rebinds the host signer on every recovered channel (CAN-002)', () => {
    const store = new SqliteChannelStore(':memory:');
    const signer = { publicKeyDigest: 'local-pkd', sign: jest.fn() } as never;
    store.setLocalSigner(signer);
    const channel = {
      channelId: 'channel-2',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      fundingScript: 'script',
      programId: 'eltoo-payment',
      programVersion: 1,
      fundingAddress: 'address',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      parties: [
        { partyId: 'alice', publicKeyDigest: 'alice-pkd', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'bob-pkd', addressIndex: 1 },
      ],
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      currentSequence: 2,
      latestState: {
        sequence: 2,
        balances: { alice: 7n, bob: 3n },
        pendingHTLCs: [],
        stateVariables: [],
        transactionHex: '0x1234',
        signatures: {},
        signingIndices: {},
      },
      stateLog: [],
      status: 'active',
      channelType: 'direct',
      createdAt: 1,
      updatedAt: 2,
    } as unknown as OmniaChannel;

    store.set('channel-2', channel);
    expect(store.get('channel-2')!.localSigner).toBe(signer);
    const values = Array.from(store.values());
    expect(values[0].localSigner).toBe(signer);
    store.close();
  });
});

describeSqlite('OperationStore', () => {
  it('creates and atomically transitions operations', () => {
    const store = new OperationStore(':memory:');
    const created = store.create('op-1', { amount: '10' }, 100);
    expect(created.status).toBe('pending');

    const executing = store.transition('op-1', 'pending', 'executing', {}, 200);
    expect(executing.status).toBe('executing');

    const committed = store.transition('op-1', 'executing', 'committed', { result: { ok: true } }, 300);
    expect(committed.result).toEqual({ ok: true });
    expect(() => store.transition('op-1', 'pending', 'failed')).toThrow('expected status pending');
    store.close();
  });

  it('journals bigint-bearing requests/results without throwing (CAN-001)', () => {
    const store = new OperationStore(':memory:');
    const request = { route: { hops: [{ amount: 5000n, channelId: 'c-1' }] } };
    const created = store.create('op-big', request, 100);
    expect(created.request).toEqual(request);
    expect(store.verifyRequest('op-big', request)).toBe(true);
    expect(store.verifyRequest('op-big', { route: { hops: [{ amount: 6000n }] } })).toBe(false);

    const committed = store.transition('op-big', 'pending', 'committed', { result: { paid: 5000n } });
    expect(committed.result).toEqual({ paid: 5000n });
    store.close();
  });
});

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
  it('persists bigint channel state and omits runtime signers', () => {
    const store = new SqliteChannelStore(':memory:');
    const channel = {
      channelId: 'channel-1',
      fundingTxId: 'tx',
      fundingCoinId: 'coin',
      fundingScript: 'script',
      fundingAddress: 'address',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 10n,
      parties: [],
      balances: { alice: 7n, bob: 3n },
      pendingHTLCs: [],
      currentSequence: 2,
      latestState: null,
      stateLog: [],
      status: 'open',
      channelType: 'direct',
      localSigner: { sign: jest.fn(), publicKeyDigest: 'runtime-only' },
      createdAt: 1,
      updatedAt: 2,
    } as unknown as OmniaChannel;

    store.set(channel.channelId, channel);
    const loaded = store.get(channel.channelId)!;

    expect(loaded.totalValue).toBe(10n);
    expect(loaded.balances).toEqual({ alice: 7n, bob: 3n });
    expect(loaded.localSigner).toBeUndefined();
    expect(store.size).toBe(1);
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
});

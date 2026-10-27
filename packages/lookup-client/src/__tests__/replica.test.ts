import type { ChainTip, Coin } from '@totemsdk/chain-provider';
import { LookupClientReadReplica } from '../replica.js';
import type { LookupClient } from '../client.js';

const coins = [{ coinId: '0x01' }] as unknown as Coin[];
const tip = { block: 10 } as ChainTip;

function client(): LookupClient {
  return {
    getCoins: jest.fn(async () => coins),
    getTip: jest.fn(async () => tip),
  } as unknown as LookupClient;
}

describe('LookupClientReadReplica', () => {
  it('returns a fresh replica value without calling the primary', async () => {
    const primary = client();
    const replica = new LookupClientReadReplica(primary, {
      get: async () => ({ value: coins, complete: true, observedAt: 100 }),
    }, { maxAgeMs: 1000, now: () => 200 });
    const result = await replica.getCoins({ address: 'MxABC' } as never);
    expect(result).toMatchObject({ source: 'replica', freshness: 'fresh', complete: true });
    expect(primary.getCoins).not.toHaveBeenCalled();
  });

  it('reports stale rather than claiming freshness for incomplete data', async () => {
    const primary = client();
    const replica = new LookupClientReadReplica(primary, {
      get: async () => ({ value: coins, complete: false, observedAt: 100 }),
    });
    expect(await replica.getCoins({} as never)).toMatchObject({
      source: 'replica', freshness: 'stale', complete: false,
    });
  });

  it('falls back to the primary only when the replica has no value', async () => {
    const primary = client();
    const replica = new LookupClientReadReplica(primary, { get: async () => null });
    expect(await replica.getTip()).toMatchObject({
      value: tip, source: 'primary', freshness: 'fresh', complete: true,
    });
    expect(primary.getTip).toHaveBeenCalledTimes(1);
  });

  it('does not hide a replica failure behind the primary', async () => {
    const primary = client();
    const replica = new LookupClientReadReplica(primary, {
      get: async () => { throw new Error('replica offline'); },
    });
    await expect(replica.getTip()).rejects.toThrow('replica offline');
    expect(primary.getTip).not.toHaveBeenCalled();
  });
});

describe('LookupClient replicated methods', () => {
  it('expose the configured replica through getCoinsReplicated/getTipReplicated', async () => {
    const primary = client();
    const { LookupClient } = await import('../client.js');
    const instance = new LookupClient({
      _transport: {} as never,
      replica: { get: async (key) => key === 'chain-tip'
        ? { value: tip, complete: true, observedAt: Date.now() }
        : { value: coins, complete: true, observedAt: Date.now() } },
    });
    (instance as any)._rpc = { sendRequest: jest.fn(async () => ({ payload: {} })) };
    expect(await instance.getCoinsReplicated({} as never)).toMatchObject({
      source: 'replica', freshness: 'fresh', complete: true,
    });
    expect(await instance.getTipReplicated()).toMatchObject({
      value: tip, source: 'replica', freshness: 'fresh',
    });
    expect(primary.getCoins).not.toHaveBeenCalled();
  });
});

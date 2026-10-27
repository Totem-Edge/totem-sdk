import { readReplicated } from '../read-replica';

describe('readReplicated', () => {
  it('returns fresh replica data only when complete and within age', async () => {
    const result = await readReplicated('coin', {
      readReplica: async () => ({ value: 'cached', complete: true, observedAt: 900 }),
      maxAgeMs: 200,
      now: () => 1000,
    });
    expect(result).toMatchObject({ value: 'cached', source: 'replica', freshness: 'fresh', complete: true });
  });

  it('marks an incomplete or expired replica as stale and never fresh', async () => {
    const incomplete = await readReplicated('coin', {
      readReplica: async () => ({ value: 'cached', complete: false, observedAt: 900 }),
    });
    expect(incomplete).toMatchObject({ source: 'replica', freshness: 'stale', complete: false });

    const expired = await readReplicated('coin', {
      readReplica: async () => ({ value: 'cached', complete: true, observedAt: 1 }),
      maxAgeMs: 10,
      now: () => 1000,
    });
    expect(expired).toMatchObject({ source: 'replica', freshness: 'stale', complete: false });
  });

  it('uses a primary only when the replica has no value, and never on replica error', async () => {
    const primary = await readReplicated('coin', {
      readReplica: async () => null,
      readPrimary: async () => 'authoritative',
    });
    expect(primary).toMatchObject({ value: 'authoritative', source: 'primary', complete: true });

    await expect(
      readReplicated('coin', {
        readReplica: async () => { throw new Error('replica down'); },
        readPrimary: async () => 'authoritative',
      }),
    ).rejects.toThrow('replica down');
  });

  it('reports none/unknown without a replica value or primary', async () => {
    expect(await readReplicated('coin', { readReplica: async () => null })).toMatchObject({
      value: null,
      source: 'none',
      freshness: 'unknown',
      complete: false,
    });
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SyncSqliteStore } from '@totemsdk/storage/sqlite-sync';
import { HOST_STATE_FORMAT_KEY, PersistentMap } from '../stores/persistent-map.js';

describe('PersistentMap (durable omnia-host state)', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnia-host-state-'));
    file = path.join(dir, 'omnia.sqlite');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips state and survives a reopen', () => {
    const kv = new SyncSqliteStore(file);
    const map = new PersistentMap<{
      amount: bigint;
      nested: { ok: boolean };
      set: Set<string>;
      when: Date;
    }>(kv, 'test:state:');
    map.set('a', {
      amount: 42n,
      nested: { ok: true },
      set: new Set(['x', 'y']),
      when: new Date('2026-01-02T03:04:05.000Z'),
    });
    expect(map.size).toBe(1);
    expect(map.get('a')?.amount).toBe(42n);
    expect(map.get('a')?.set).toEqual(new Set(['x', 'y']));
    expect(map.get('a')?.when).toBeInstanceOf(Date);
    kv.close();

    const reopenedKv = new SyncSqliteStore(file);
    const reopened = new PersistentMap<{ amount: bigint; nested: { ok: boolean } }>(
      reopenedKv,
      'test:state:',
    );
    expect(reopened.get('a')?.amount).toBe(42n);
    expect(reopened.get('a')?.nested).toEqual({ ok: true });
    expect(Array.from(reopened.keys())).toEqual(['a']);
    reopenedKv.close();
  });

  it('persists a factory-shaped object and strips runtime signers', () => {
    const kv = new SyncSqliteStore(file);
    const factories = new PersistentMap<Record<string, unknown>>(kv, 'omnia:factory:');
    const factory = {
      factoryId: 'factory-1',
      status: 'active',
      totalValue: 1000n,
      allocations: { alice: 600n, bob: 400n },
      participants: [
        { partyId: 'alice', publicKeyDigest: '0xaa', contributionAmount: 500n },
        { partyId: 'bob', publicKeyDigest: '0xbb', contributionAmount: 500n },
      ],
      virtualChannels: [
        { channelId: 'vc-1', localSigner: { sign: () => undefined }, totalValue: 10n },
      ],
      localSigner: { sign: () => undefined },
    };
    factories.set('factory-1', factory);
    kv.close();

    const reopenedKv = new SyncSqliteStore(file);
    const reopened = new PersistentMap<Record<string, unknown>>(reopenedKv, 'omnia:factory:');
    const loaded = reopened.get('factory-1') as Record<string, any>;
    expect(loaded.totalValue).toBe(1000n);
    expect(loaded.allocations).toEqual({ alice: 600n, bob: 400n });
    expect(loaded.localSigner).toBeUndefined();
    expect(loaded.virtualChannels[0].channelId).toBe('vc-1');
    expect(loaded.virtualChannels[0].localSigner).toBeUndefined();
    reopenedKv.close();
  });

  it('supports delete/clear and refuses an unsupported format', () => {
    const kv = new SyncSqliteStore(file);
    const map = new PersistentMap<number>(kv, 'test:del:');
    map.set('a', 1);
    map.set('b', 2);
    expect(map.delete('a')).toBe(true);
    expect(map.size).toBe(1);
    map.clear();
    expect(map.size).toBe(0);

    kv.set(HOST_STATE_FORMAT_KEY, 999);
    expect(() => new PersistentMap<number>(kv, 'test:new:')).toThrow(
      'Unsupported omnia-host state format 999',
    );
    kv.close();
  });
});

import { IDBFactory } from 'fake-indexeddb';
import { IdbStore } from '../adapters/idb-store.js';
import { runCoreConformance } from '../conformance/harness.js';
import { enqueueItem } from '../transaction.js';
import { assertCapabilities } from '../types.js';
import { StorageError } from '../errors.js';

let dbCounter = 0;
function freshFactory(): IDBFactory {
  return new IDBFactory() as unknown as IDBFactory;
}

runCoreConformance('IdbStore (conformance)', async () =>
  new IdbStore({ factory: freshFactory(), databaseName: `totem-conformance-${++dbCounter}` }));

describe('IdbStore durability & CAS', () => {
  it('declares durable, atomic, conditional capabilities', () => {
    const store = new IdbStore({ factory: freshFactory(), databaseName: 'totem-cap' });
    expect(store.capabilities).toEqual({
      acknowledge: 'durably-acknowledged',
      atomic: true,
      conditional: true,
    });
    expect(() => assertCapabilities(store, { acknowledge: 'durably-acknowledged', conditional: true })).not.toThrow();
  });

  it('survives a reopen and reads back committed data', async () => {
    const factory = freshFactory();
    const name = 'totem-reopen';
    const first = new IdbStore({ factory, databaseName: name });
    await first.set('k', { a: 1n, b: new Uint8Array([1, 2, 3]) });
    await first.close();

    const second = new IdbStore({ factory, databaseName: name });
    const value = await second.get<{ a: bigint; b: Uint8Array }>('k');
    expect(value?.a).toBe(1n);
    expect(Array.from(value?.b ?? [])).toEqual([1, 2, 3]);
    await second.close();
  });

  it('does not lose concurrent conditional updates', async () => {
    const store = new IdbStore({ factory: freshFactory(), databaseName: 'totem-cas' });
    await store.set('counter', 0);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        store.conditionalUpdate<number>('counter', (current) => ({ next: (current ?? 0) + 1 })),
      ),
    );
    const applied = results.filter((r) => r.applied);
    expect(applied).toHaveLength(8);
    expect(await store.get<number>('counter')).toBe(8);
    expect(new Set(applied.map((r) => r.revision)).size).toBe(8);
  });

  it('returns applied:false and leaves the value unchanged on abort', async () => {
    const store = new IdbStore({ factory: freshFactory(), databaseName: 'totem-abort' });
    await store.set('k', 'original');
    const result = await store.conditionalUpdate<string>('k', () => ({ abort: 'no' }));
    expect(result.applied).toBe(false);
    expect(result.value).toBe('original');
    expect(await store.get('k')).toBe('original');
  });

  it('reports corruption under strict policy and null under lenient', async () => {
    const factory = freshFactory();
    const name = 'totem-corrupt';
    const strict = new IdbStore({ factory, databaseName: name });
    await strict.set('k', 'v');
    await strict.close();

    // Overwrite the raw record with garbage through a fresh connection.
    const sabotage = new IdbStore({ factory, databaseName: name });
    // @ts-expect-error — reaching into internals to corrupt a record.
    const db: IDBDatabase = await sabotage.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(new Uint8Array([0, 1, 2, 3, 4]), 'k');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await sabotage.close();

    const strictReader = new IdbStore({ factory, databaseName: name, failurePolicy: 'strict' });
    await expect(strictReader.get('k')).rejects.toBeInstanceOf(StorageError);

    const lenientReader = new IdbStore({ factory, databaseName: name, failurePolicy: 'lenient' });
    expect(await lenientReader.get('k')).toBeNull();
  });

  it('transaction buffer does not apply until commit and supports enqueueItem', async () => {
    const store = new IdbStore({ factory: freshFactory(), databaseName: 'totem-tx' });
    const tx = store.transaction();
    tx.set('pending', 'v');
    expect(await store.get('pending')).toBeNull();
    await tx.commit();
    expect(await store.get('pending')).toBe('v');

    await store.set('queue', [1]);
    await enqueueItem(store, 'queue', 2);
    expect(await store.get('queue')).toEqual([1, 2]);
  });
});

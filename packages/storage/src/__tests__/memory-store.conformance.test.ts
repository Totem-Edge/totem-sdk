import { MemoryStore } from '../adapters/memory-store.js';
import { enqueueItem } from '../transaction.js';
import { runCoreConformance } from '../conformance/harness.js';

runCoreConformance('MemoryStore (conformance)', async () => new MemoryStore());

describe('MemoryStore transactions', () => {
  it('does not apply operations until commit', async () => {
    const store = new MemoryStore();
    const tx = store.transaction();
    tx.set('pending', 'v');
    expect(await store.get('pending')).toBeNull();
    await tx.commit();
    expect(await store.get('pending')).toBe('v');
  });
});

describe('enqueueItem (transitionAndEnqueue generalization)', () => {
  it('appends to an array field in one commit', async () => {
    const store = new MemoryStore();
    await store.set('queue', [1, 2]);
    await enqueueItem(store, 'queue', 3);
    expect(await store.get('queue')).toEqual([1, 2, 3]);
  });

  it('creates the field when absent', async () => {
    const store = new MemoryStore();
    const receipt = await enqueueItem(store, 'fresh', 'x');
    expect(receipt.index).toBe(0);
    expect(await store.get('fresh')).toEqual(['x']);
  });
});
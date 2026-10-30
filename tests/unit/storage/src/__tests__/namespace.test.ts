import { MemoryStore } from '../adapters/memory-store.js';
import { Namespace } from '../namespace.js';

describe('Namespace', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('scopes keys under a prefix', async () => {
    const ns = new Namespace(store, 'app:');
    await ns.set('config', 1);
    expect(await ns.get('config')).toBe(1);
    expect(await store.get('app:config')).toBe(1);
  });

  it('returns null for keys outside the prefix', async () => {
    const ns = new Namespace(store, 'app:');
    await store.set('other:config', 2);
    expect(await ns.get('config')).toBeNull();
  });

  it('lists only prefixed keys (stripped)', async () => {
    const ns = new Namespace(store, 'app:');
    await ns.set('a', 1);
    await ns.set('b', 2);
    await store.set('other:c', 3);
    expect((await ns.keys()).sort()).toEqual(['a', 'b']);
  });

  it('clear only removes prefixed keys', async () => {
    const ns = new Namespace(store, 'app:');
    await ns.set('a', 1);
    await store.set('other:c', 3);
    await ns.clear();
    expect(await ns.get('a')).toBeNull();
    expect(await store.get('other:c')).toBe(3);
  });

  it('remove and has respect the prefix', async () => {
    const ns = new Namespace(store, 'app:');
    await ns.set('a', 1);
    expect(await ns.has('a')).toBe(true);
    expect(await ns.remove('a')).toBe(true);
    expect(await ns.has('a')).toBe(false);
  });

  it('is itself a StorageAdapter usable by a Namespace chain', async () => {
    const outer = new Namespace(new Namespace(store, 'a:'), 'b:');
    await outer.set('k', 'v');
    expect(await store.get('a:b:k')).toBe('v');
  });
});
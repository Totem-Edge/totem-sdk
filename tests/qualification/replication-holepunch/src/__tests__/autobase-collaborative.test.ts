import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codec } from '@totemsdk/storage/codec';
import { defineDataset } from '@totemsdk/replication';
import { AutobaseCollaborativeStore, type AutobaseReducer } from '../autobase-collaborative.js';
import { HyperbeeDistributedIndex } from '../hyperbee-index.js';

type Op = { type: 'inc'; by: number } | { type: 'label'; value: string };
type State = { count: number; labels: string[] };

const reducer: AutobaseReducer<Op, State> = {
  initialState: () => ({ count: 0, labels: [] }),
  reduce: (state, op) =>
    op.type === 'inc'
      ? { ...state, count: state.count + op.by }
      : { ...state, labels: [...state.labels, op.value] },
};

const dirs: string[] = [];
const makeDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'rep-ab-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function waitFor(check: () => Promise<boolean>, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('waitFor timed out');
}

jest.setTimeout(30000);

const indexDescriptor = defineDataset({
  datasetId: 'test.collab-view',
  datasetVersion: 1,
  codecVersion: codec.version,
  writerModel: 'multi-writer',
  encryptionProfile: 'none',
  retention: 'full',
});

describe('AutobaseCollaborativeStore', () => {
  it('converges competing writers to the same state', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    const b = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'b'),
      datasetVersion: 1,
      reducer,
      bootstrapKey: Buffer.from(a.baseKey, 'hex'),
      ownerKey: a.localKey,
    });

    const s1 = a.replicate(true);
    const s2 = b.replicate(false);
    s1.pipe(s2).pipe(s1);

    await a.addWriter(b.localKey);
    await waitFor(async () => b.writable);
    await a.propose({ type: 'inc', by: 1 });
    await b.propose({ type: 'label', value: 'remote' });
    await a.propose({ type: 'inc', by: 2 });

    await waitFor(async () => {
      const va = await a.readView();
      const vb = await b.readView();
      return va.revision === vb.revision && va.state.count === 3;
    });

    await a.ack();
    await b.ack();
    const va = await a.readView();
    const vb = await b.readView();
    expect(vb.state).toEqual(va.state);
    expect(va.revision).toBe(vb.revision);
    expect(va.complete).toBe(true);
    expect(vb.complete).toBe(true);

    await a.close();
    await b.close();
  });

  it('rejects an unadmitted writer', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    const c = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'c'),
      datasetVersion: 1,
      reducer,
      bootstrapKey: Buffer.from(a.baseKey, 'hex'),
      ownerKey: a.localKey,
    });
    const s1 = a.replicate(true);
    const s2 = c.replicate(false);
    s1.pipe(s2).pipe(s1);
    await c.status();
    await expect(c.propose({ type: 'inc', by: 1 })).rejects.toThrow(/not admitted/);

    await a.close();
    await c.close();
  });

  it('converges after an offline write and reconnect', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    const b = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'b'),
      datasetVersion: 1,
      reducer,
      bootstrapKey: Buffer.from(a.baseKey, 'hex'),
      ownerKey: a.localKey,
    });
    let s1 = a.replicate(true);
    let s2 = b.replicate(false);
    s1.pipe(s2).pipe(s1);
    await a.addWriter(b.localKey);
    await waitFor(async () => b.writable);
    await a.propose({ type: 'inc', by: 1 });
    await waitFor(async () => (await b.readView()).state.count === 1);

    s1.destroy();
    s2.destroy();
    await b.propose({ type: 'label', value: 'offline' });
    expect((await b.readView()).state.labels).toEqual(['offline']);

    s1 = a.replicate(true);
    s2 = b.replicate(false);
    s1.pipe(s2).pipe(s1);
    await a.ack();
    await b.ack();
    await waitFor(async () => {
      const va = await a.readView();
      const vb = await b.readView();
      return va.revision === vb.revision && va.complete && vb.complete;
    });
    expect((await a.readView()).state).toEqual({ count: 1, labels: ['offline'] });
    await a.close();
    await b.close();
  });

  it('rotates the writer set and rejects a removed writer', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    const b = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'b'),
      datasetVersion: 1,
      reducer,
      bootstrapKey: Buffer.from(a.baseKey, 'hex'),
      ownerKey: a.localKey,
    });
    const s1 = a.replicate(true);
    const s2 = b.replicate(false);
    s1.pipe(s2).pipe(s1);
    await a.addWriter(b.localKey);
    await waitFor(async () => b.writable);
    await a.removeWriter(b.localKey);
    await waitFor(async () => !b.writable);
    await expect(b.propose({ type: 'inc', by: 1 })).rejects.toThrow(/not admitted/);
    await a.close();
    await b.close();
  });

  it('migrates older dataset versions deterministically', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    await a.propose({ type: 'inc', by: 1 });
    const b = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'b'),
      datasetVersion: 2,
      reducer: {
        ...reducer,
        migrate: (op) => {
          const value = op as Op;
          return value.type === 'inc' ? { type: 'inc', by: value.by * 10 } : value;
        },
      },
      bootstrapKey: Buffer.from(a.baseKey, 'hex'),
      ownerKey: a.localKey,
    });
    const s1 = a.replicate(true);
    const s2 = b.replicate(false);
    s1.pipe(s2).pipe(s1);
    await waitFor(async () => (await b.readView()).state.count === 10);
    expect((await a.readView()).state.count).toBe(1);
    expect((await b.readView()).state.count).toBe(10);
    await a.close();
    await b.close();
  });

  it('materialises the reduced view into Hyperbee', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    await a.propose({ type: 'inc', by: 4 });
    const index = await HyperbeeDistributedIndex.open({
      storagePath: join(makeDir(), 'index'),
      descriptor: indexDescriptor,
    });
    const materialised = await a.materialize(index);
    expect(materialised.state.count).toBe(4);
    expect((await index.get('collab:state')) as any).toMatchObject({
      state: { count: 4 },
      revision: materialised.revision,
    });
    await index.close();
    await a.close();
  });

  it('never reports complete while paused or behind', async () => {
    const a = await AutobaseCollaborativeStore.open<Op, State>({
      storagePath: join(makeDir(), 'a'),
      datasetVersion: 1,
      reducer,
    });
    await a.propose({ type: 'inc', by: 1 });
    (a as any).base.pause();
    expect((await a.readView()).complete).toBe(false);
    await a.close();
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AutobaseCollaborativeStore, type AutobaseReducer } from '../autobase-collaborative.js';

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

    const va = await a.readView();
    const vb = await b.readView();
    expect(vb.state).toEqual(va.state);
    expect(va.revision).toBe(vb.revision);

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

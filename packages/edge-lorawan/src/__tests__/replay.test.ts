import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '@totemsdk/storage/sqlite';
import {
  createMemoryLorawanReplayStore,
  createStorageLorawanReplayStore,
} from '../replay.js';

describe('LoRaWAN replay guard', () => {
  it('rejects duplicate and rolled-back frames, then accepts advancement', async () => {
    const store = createMemoryLorawanReplayStore();
    await store.beginSession('dev-1', 100);
    expect(await store.claimFrame('dev-1', 5, 101)).toBe(true);
    expect(await store.claimFrame('dev-1', 5, 102)).toBe(false);
    expect(await store.claimFrame('dev-1', 4, 103)).toBe(false);
    expect(await store.claimFrame('dev-1', 6, 104)).toBe(true);
  });

  it('resets the frame watermark on rejoin', async () => {
    const store = createMemoryLorawanReplayStore();
    await store.beginSession('dev-1', 100);
    expect(await store.claimFrame('dev-1', 9, 101)).toBe(true);
    const epoch = await store.beginSession('dev-1', 200);
    expect(epoch).toBe(2);
    expect(await store.claimFrame('dev-1', 1, 201)).toBe(true);
    // Without a transport-supplied session epoch, a rejoin intentionally opens
    // a new watermark; old frames cannot be distinguished by counter alone.
    expect(await store.claimFrame('dev-1', 9, 202)).toBe(true);
  });

  it('persists session state through the storage CAS adapter across restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lorawan-replay-'));
    const path = join(directory, 'replay.sqlite');
    let storage = new SqliteStore(path, { busyTimeoutMs: 5000 });
    let guard = createStorageLorawanReplayStore(storage);
    await guard.beginSession('dev-1', 100);
    expect(await guard.claimFrame('dev-1', 7, 101)).toBe(true);
    await storage.close();

    storage = new SqliteStore(path, { busyTimeoutMs: 5000 });
    guard = createStorageLorawanReplayStore(storage);
    expect(await guard.claimFrame('dev-1', 7, 102)).toBe(false);
    expect(await guard.claimFrame('dev-1', 8, 103)).toBe(true);
    expect(await guard.beginSession('dev-1', 200)).toBe(2);
    expect(await guard.claimFrame('dev-1', 1, 201)).toBe(true);
    await storage.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('rejects volatile storage for the durable adapter unless explicitly allowed', () => {
    const volatile = {
      capabilities: { acknowledge: 'buffered', atomic: true, conditional: true },
      failurePolicy: 'strict',
      async conditionalUpdate() { return { applied: true, value: null, revision: 1 }; },
    } as never;
    expect(() => createStorageLorawanReplayStore(volatile)).toThrow(/durably acknowledged/);
  });
});

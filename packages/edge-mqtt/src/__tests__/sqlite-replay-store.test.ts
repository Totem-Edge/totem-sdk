import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '@totemsdk/storage/sqlite';
import { createStorageMqttReplayStore } from '../storage-replay-store.js';
import type { StorageMqttReplayStoreOptions } from '../storage-replay-store.js';
import { createMqttCommandHandler } from '../command-handler.js';
import type { MqttCommandHandlerConfig } from '../types.js';

describe('file-backed atomic MQTT replay claims', () => {
  let directory: string;
  let stores: Array<{ close(): Promise<void> }>;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'mqtt-sqlite-test-')); stores = []; });
  afterEach(async () => {
    await Promise.all(stores.map((store) => store.close().catch(() => {})));
    rmSync(directory, { recursive: true, force: true });
  });
  async function open(options: Partial<StorageMqttReplayStoreOptions> = {}) {
    const storage = new SqliteStore(join(directory, 'replay.sqlite'));
    const store = createStorageMqttReplayStore(storage, options);
    stores.push(storage);
    // The production port has no lifecycle; this SQLite test fixture owns it.
    return Object.assign(store, { close: () => storage.close() });
  }

  it('retains claims across close/reopen through the inclusive expiry boundary', async () => {
    const first = await open();
    expect(await first.claim('command', 200, 100)).toBe(true);
    await first.close();
    const second = await open();
    expect(await second.claim('command', 300, 200)).toBe(false);
    expect(await second.claim('command', 300, 201)).toBe(true);
    expect(await second.claim('command', 400, 300)).toBe(false);
  });

  it('does not forget old claims when another command is admitted or the clock moves back', async () => {
    const store = await open();
    expect(await store.claim('old-command', 200, 100)).toBe(true);
    expect(await store.claim('new-command', 400, 300)).toBe(true);
    expect(await store.claim('old-command', 250, 150)).toBe(false);
  });

  it('atomically admits one of many deliveries over independent SQLite connections', async () => {
    const left = await open();
    const right = await open();
    const results = await Promise.all(Array.from({ length: 40 }, (_, index) =>
      (index % 2 ? left : right).claim('shared', 200, 100)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('isolates namespaces without interpreting keys or namespace separators', async () => {
    const left = await open({ namespace: 'left:scope' });
    const right = await open({ namespace: 'right:scope' });
    const key = "command'; DROP TABLE ignored; --";
    expect(await left.claim(key, 200, 100)).toBe(true);
    expect(await right.claim(key, 200, 100)).toBe(true);
    expect(await left.claim(key, 200, 100)).toBe(false);
  });

  it.each([[200, -1], [99, 100], [NaN, 100], [Infinity, 100], [200, 100.5]])('rejects invalid claim timestamps (%s, %s)', async (expiresAt, now) => {
    const store = await open();
    await expect(store.claim('command', expiresAt, now)).rejects.toThrow(/safe integers/);
    expect(await store.claim('command', 200, 100)).toBe(true);
  });

  it('blocks a command when the owning replay connection has been closed', async () => {
    const replayStore = await open();
    await replayStore.close();
    const execute = jest.fn(async () => ({ ok: true }));
    const config = {
      runtime: { deviceId: 'sqlite-test', ports: { policy: { async check() { return { ok: true, data: { allowed: true } }; } } } },
      client: { async publish() {} }, executor: { execute }, replayStore, requireSignedCommands: false,
    } as unknown as MqttCommandHandlerConfig;
    const handler = createMqttCommandHandler(config);
    const result = await handler.handleCommand({
      topic: 'commands', receivedAt: Date.now(),
      payload: JSON.stringify({ commandId: 'closed', command: 'pulse', createdAt: Date.now() }),
    });
    expect(result.errorCode).toBe('MQTT_REPLAY_UNAVAILABLE');
    expect(execute).not.toHaveBeenCalled();
  });
});

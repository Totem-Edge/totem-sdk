/**
 * Replay-ledger persistence tests (RFC-007 G4): a durable command store keeps
 * the processed-ID ledger across handler restarts, whereas the in-memory
 * freshness window resets.
 */

import { createMqttCommandHandler } from '../command-handler.js';
import type { MqttClientPort, MqttMessage } from '../client-port.js';
import type { MqttCommandHandlerConfig, ReplayLedgerStore } from '../types.js';

// Simulates an atomic store shared across handlers, not a real disk/process restart.
class AtomicTestStore implements ReplayLedgerStore {
  readonly entries = new Map<string, number>();

  async claim(key: string, expiresAt: number, now: number): Promise<boolean> {
    await Promise.resolve(); // Include I/O scheduling, without splitting the atomic operation.
    const previous = this.entries.get(key);
    if (previous !== undefined && previous >= now) return false;
    this.entries.set(key, expiresAt);
    return true;
  }
}

function makeHandlerConfig(store?: ReplayLedgerStore, overrides: Partial<MqttCommandHandlerConfig> = {}): MqttCommandHandlerConfig {
  const published: MqttMessage[] = [];
  const client: MqttClientPort = {
    async subscribe() {},
    async unsubscribe() {},
    async publish(message: MqttMessage) {
      published.push(message);
    },
    async connect() {},
    async disconnect() {},
    async ping(): Promise<boolean> { return true; },
    isConnected(): boolean { return true; },
  } as unknown as MqttClientPort;

  const executed: string[] = [];
  void executed;

  const config: MqttCommandHandlerConfig = {
    runtime: {
      deviceId: 'dev-1',
      ports: {
        policy: {
          check: async () => ({ ok: true, data: { allowed: true } }),
        },
      },
    } as unknown as MqttCommandHandlerConfig['runtime'],
    client,
    executor: {
      execute: async () => ({ ok: true }),
    },
    requireSignedCommands: false,
    ...(store ? { replayStore: store } : {}),
    ...overrides,
  };
  return config;
}

function makeCommandMessage(commandId: string): MqttMessage {
  return {
    topic: 'totem/dev-1/commands',
    payload: Buffer.from(JSON.stringify({ commandId, command: 'ping', createdAt: Date.now() })),
    receivedAt: Date.now(),
  };
}

describe('command replay ledger', () => {
  it('accepts a command once, then rejects its replay after a handler restart (durable store)', async () => {
    const store = new AtomicTestStore();

    const first = createMqttCommandHandler(makeHandlerConfig(store));
    expect((await first.handleCommand(makeCommandMessage('cmd-1'))).ok).toBe(true);

    // Restart: new handler instance, same durable store.
    const second = createMqttCommandHandler(makeHandlerConfig(store));
    const replay = await second.handleCommand(makeCommandMessage('cmd-1'));
    expect(replay.ok).toBe(false);
    expect(replay.error).toMatch(/duplicate commandId/i);
  });

  it('keeps new command IDs acceptable across a restart (durable store)', async () => {
    const store = new AtomicTestStore();

    const first = createMqttCommandHandler(makeHandlerConfig(store));
    await first.handleCommand(makeCommandMessage('cmd-old'));

    const second = createMqttCommandHandler(makeHandlerConfig(store));
    expect((await second.handleCommand(makeCommandMessage('cmd-new'))).ok).toBe(true);
  });

  it('without a store, a fresh handler accepts the same commandId again (in-memory window resets)', async () => {
    const first = createMqttCommandHandler(makeHandlerConfig());
    expect((await first.handleCommand(makeCommandMessage('cmd-mem'))).ok).toBe(true);

    const second = createMqttCommandHandler(makeHandlerConfig());
    expect((await second.handleCommand(makeCommandMessage('cmd-mem'))).ok).toBe(true);
  });

  it.each([false, true])('executes only once under concurrent delivery (store=%s)', async (durable) => {
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler(makeHandlerConfig(
      durable ? new AtomicTestStore() : undefined,
      { executor: { execute } },
    ));
    const message = makeCommandMessage('concurrent');
    const results = await Promise.all(Array.from({ length: 20 }, () => handler.handleCommand(message)));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('shares atomic claims across concurrent handlers for one device', async () => {
    const store = new AtomicTestStore();
    const execute = jest.fn(async () => ({ ok: true }));
    const handlers = Array.from({ length: 20 }, () => createMqttCommandHandler(
      makeHandlerConfig(store, { executor: { execute } }),
    ));
    const message = makeCommandMessage('shared');
    const results = await Promise.all(handlers.map((handler) => handler.handleCommand(message)));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('scopes shared claims to the device as well as command ID', async () => {
    const store = new AtomicTestStore();
    const config = makeHandlerConfig(store);
    const first = createMqttCommandHandler(config);
    const second = createMqttCommandHandler({
      ...config, runtime: { ...config.runtime, deviceId: 'dev-2' },
    });
    const message = makeCommandMessage('same-id');
    expect((await first.handleCommand(message)).ok).toBe(true);
    expect((await second.handleCommand(message)).ok).toBe(true);
  });

  it('blocks execution when persistence is unavailable or uncertain', async () => {
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler(makeHandlerConfig({
      async claim() { throw new Error('connection lost during commit'); },
    }, { executor: { execute } }));
    const result = await handler.handleCommand(makeCommandMessage('uncertain-claim'));
    expect(result.errorCode).toBe('MQTT_REPLAY_UNAVAILABLE');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not release the claim when execution throws', async () => {
    const execute = jest.fn(async () => { throw new Error('write outcome unknown'); });
    const handler = createMqttCommandHandler(makeHandlerConfig(new AtomicTestStore(), { executor: { execute } }));
    const message = makeCommandMessage('uncertain-execution');
    await expect(handler.handleCommand(message)).rejects.toThrow('write outcome unknown');
    expect((await handler.handleCommand(message)).error).toMatch(/duplicate/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('refuses legacy get/set stores without atomic claims', () => {
    const store = { async get() {}, async set() {} } as unknown as ReplayLedgerStore;
    expect(() => createMqttCommandHandler(makeHandlerConfig(store))).toThrow(/atomic durable claim/);
  });
});

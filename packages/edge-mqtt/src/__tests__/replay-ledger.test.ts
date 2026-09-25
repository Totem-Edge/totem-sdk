/**
 * Replay-ledger persistence tests (RFC-007 G4): a durable command store keeps
 * the processed-ID ledger across handler restarts, whereas the in-memory
 * freshness window resets.
 */

import { MemoryStore } from '@totemsdk/storage';
import { createMqttCommandHandler } from '../command-handler.js';
import type { MqttClientPort, MqttMessage } from '../client-port.js';
import type { MqttCommandHandlerConfig } from '../types.js';

function makeHandlerConfig(store?: MemoryStore, overrides: Partial<MqttCommandHandlerConfig> = {}): MqttCommandHandlerConfig {
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
    const store = new MemoryStore();

    const first = createMqttCommandHandler(makeHandlerConfig(store));
    expect((await first.handleCommand(makeCommandMessage('cmd-1'))).ok).toBe(true);

    // Restart: new handler instance, same durable store.
    const second = createMqttCommandHandler(makeHandlerConfig(store));
    const replay = await second.handleCommand(makeCommandMessage('cmd-1'));
    expect(replay.ok).toBe(false);
    expect(replay.error).toMatch(/duplicate commandId/i);
  });

  it('keeps new command IDs acceptable across a restart (durable store)', async () => {
    const store = new MemoryStore();

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
});
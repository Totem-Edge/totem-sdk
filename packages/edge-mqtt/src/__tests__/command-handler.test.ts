import { createMqttCommandHandler } from '../command-handler.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import type { MqttClientPort, MqttMessage } from '../client-port.js';
import type { MqttCommandExecutor } from '../types.js';

function makeMockClient() {
  const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  const client: MqttClientPort = {
    async subscribe(topic) { return { topic, async unsubscribe() {} }; },
    async publish(topic, payload) { published.push({ topic, payload }); },
    onMessage() { return () => {}; },
  };
  return { client, published };
}

const makeMsg = (command: string, overrides: Record<string, unknown> = {}): MqttMessage => ({
  topic: 'totem/gw/commands',
  payload: JSON.stringify({ commandId: 'test-cmd-1', command, requestedBy: 'agent-x', createdAt: Date.now(), ...overrides }),
  receivedAt: Date.now(),
});

describe('command-handler.test — policy deny + executor approve', () => {
  it('rejects command when policy denies', async () => {
    const { client, published } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test',
      capabilities: createCapabilitySet([]),
      ports: {
        policy: {
          async check() { return { ok: true, data: { allowed: false, reason: 'Not permitted' } }; },
        },
      },
    });
    const handler = createMqttCommandHandler({ runtime, client });
    const result = await handler.handleCommand(makeMsg('reboot'));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
    expect(published.some((p) => p.payload.toString().includes('rejected'))).toBe(true);
  });

  it('executes command via injected executor when policy approves', async () => {
    const { client, published } = makeMockClient();
    let executorCalled = false;
    const executor: MqttCommandExecutor = {
      async execute() {
        executorCalled = true;
        return { ok: true, data: { output: 'done' } };
      },
    };
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test2',
      capabilities: createCapabilitySet([]),
      ports: {
        policy: {
          async check() { return { ok: true, data: { allowed: true } }; },
        },
      },
    });
    const handler = createMqttCommandHandler({ runtime, client, executor });
    const result = await handler.handleCommand(makeMsg('ping'));
    expect(result.ok).toBe(true);
    expect(executorCalled).toBe(true);
    expect(published.some((p) => p.payload.toString().includes('executed'))).toBe(true);
  });

  it('rejects when no executor is injected', async () => {
    const { client, published } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test3',
      capabilities: createCapabilitySet([]),
      ports: {
        policy: {
          async check() { return { ok: true, data: { allowed: true } }; },
        },
      },
    });
    const handler = createMqttCommandHandler({ runtime, client });
    const result = await handler.handleCommand(makeMsg('ping'));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_EXECUTOR');
  });

  it('rejects when no policy port is configured (fail closed)', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test4',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const handler = createMqttCommandHandler({ runtime, client });
    const result = await handler.handleCommand(makeMsg('reboot'));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
  });

  it('rejects when createdAt is missing (replay prevention)', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test5',
      capabilities: createCapabilitySet([]),
      ports: {
        policy: {
          async check() { return { ok: true, data: { allowed: true } }; },
        },
      },
    });
    const handler = createMqttCommandHandler({ runtime, client });
    const result = await handler.handleCommand(makeMsg('reboot', { createdAt: undefined }));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
  });

  it('rejects when commandId is auto-generated', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test6',
      capabilities: createCapabilitySet([]),
      ports: {
        policy: {
          async check() { return { ok: true, data: { allowed: true } }; },
        },
      },
    });
    const handler = createMqttCommandHandler({ runtime, client });
    const result = await handler.handleCommand({ topic: 'totem/gw/commands', payload: '{"command":"test"}', receivedAt: Date.now() });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
  });

  it('handles malformed JSON payload gracefully', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'cmd-test4',
      capabilities: createCapabilitySet([]),
      ports: {
        policy: {
          async check() { return { ok: true, data: { allowed: true } }; },
        },
      },
    });
    const handler = createMqttCommandHandler({ runtime, client });
    const result = await handler.handleCommand({
      topic: 'totem/gw/commands',
      payload: 'not-json',
      receivedAt: Date.now(),
    });
    expect(result.ok).toBe(false);
  });
});

import { createMqttCommandHandler } from '../command-handler.js';
import { canonicalJson, toHex } from '../canonical.js';
import { sha3_256 } from '@totemsdk/proof';
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
    const handler = createMqttCommandHandler({ runtime, client, requireSignedCommands: false });
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
    const handler = createMqttCommandHandler({ runtime, client, executor, requireSignedCommands: false });
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
    const handler = createMqttCommandHandler({ runtime, client, requireSignedCommands: false });
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
    const handler = createMqttCommandHandler({ runtime, client, requireSignedCommands: false });
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
    const handler = createMqttCommandHandler({ runtime, client, requireSignedCommands: false });
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
    const handler = createMqttCommandHandler({ runtime, client, requireSignedCommands: false });
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
    const handler = createMqttCommandHandler({ runtime, client, requireSignedCommands: false });
    const result = await handler.handleCommand({
      topic: 'totem/gw/commands',
      payload: 'not-json',
      receivedAt: Date.now(),
    });
    expect(result.ok).toBe(false);
  });
});

function makeSignedMessage(payload: unknown, commandId = 'signed-cmd-1'): MqttMessage {
  const now = Date.now();
  const envelope = {
    commandId,
    command: 'ping',
    payloadHash: toHex(sha3_256(new TextEncoder().encode(canonicalJson(payload)))),
    issuedAt: now,
    expiresAt: now + 60_000,
    nonce: `nonce-${commandId}`,
    issuerIdentity: 'agent-signed',
    signature: 'ab'.repeat(32),
  };
  return {
    topic: 'totem/gw/commands',
    payload: JSON.stringify({ envelope, payload }),
    receivedAt: now,
  };
}

function makeAllowedRuntime(deviceId: string) {
  return createEdgeRuntime({
    deviceId,
    capabilities: createCapabilitySet([]),
    ports: {
      policy: {
        async check() { return { ok: true, data: { allowed: true } }; },
      },
    },
  });
}

describe('command-handler.test — signed envelope enforcement (AUD-030 / AUD-031)', () => {
  it('rejects unsigned commands by default (requireSignedCommands defaults true)', async () => {
    const { client, published } = makeMockClient();
    const handler = createMqttCommandHandler({ runtime: makeAllowedRuntime('signed-a'), client });
    const result = await handler.handleCommand(makeMsg('ping'));
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
    expect(result.error).toMatch(/signed command envelope required/i);
    expect(published.some((p) => p.payload.toString().includes('rejected'))).toBe(true);
  });

  it('executes a signed command when payload hash matches and signature verifies', async () => {
    const { client } = makeMockClient();
    let receivedPayload: unknown;
    const handler = createMqttCommandHandler({
      runtime: makeAllowedRuntime('signed-b'),
      client,
      verifyCommandSignature: async () => true,
      executor: {
        async execute(command) {
          receivedPayload = command.payload;
          return { ok: true };
        },
      },
    });
    const result = await handler.handleCommand(makeSignedMessage({ action: 'run' }));
    expect(result.ok).toBe(true);
    expect(receivedPayload).toEqual({ action: 'run' });
  });

  it('rejects a signed envelope when the outer payload does not match payloadHash', async () => {
    const { client } = makeMockClient();
    let executed = false;
    const handler = createMqttCommandHandler({
      runtime: makeAllowedRuntime('signed-c'),
      client,
      verifyCommandSignature: async () => true,
      executor: {
        async execute() { executed = true; return { ok: true }; },
      },
    });
    const message = makeSignedMessage({ action: 'run' });
    const body = JSON.parse(message.payload as string) as Record<string, unknown>;
    body.payload = { action: 'tampered' };
    message.payload = JSON.stringify(body);

    const result = await handler.handleCommand(message);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
    expect(result.error).toMatch(/payload hash mismatch/i);
    expect(executed).toBe(false);
  });

  it('rejects a malformed envelope by default rather than falling back to unsigned parsing', async () => {
    const { client } = makeMockClient();
    const handler = createMqttCommandHandler({ runtime: makeAllowedRuntime('signed-d'), client });
    const result = await handler.handleCommand({
      topic: 'totem/gw/commands',
      payload: JSON.stringify({
        commandId: 'malformed-1',
        command: 'ping',
        createdAt: Date.now(),
        envelope: { commandId: 'malformed-1' },
      }),
      receivedAt: Date.now(),
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_POLICY_REJECTED');
  });
});

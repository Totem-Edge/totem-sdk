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

describe('RFC-020 H5: signed-envelope verification order', () => {
  it('fails closed when a signed envelope is present but no verifier is configured', async () => {
    const { client } = makeMockClient();
    const handler = createMqttCommandHandler({ runtime: makeAllowedRuntime('h5-a'), client });
    const result = await handler.handleCommand(makeSignedMessage({ action: 'run' }));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no verifyCommandSignature/i);
  });

  it('does not poison the replay slot when verification fails', async () => {
    const { client } = makeMockClient();
    let allow = false;
    const handler = createMqttCommandHandler({
      runtime: makeAllowedRuntime('h5-b'),
      client,
      verifyCommandSignature: async () => allow,
      executor: { async execute() { return { ok: true }; } },
    });
    const first = await handler.handleCommand(makeSignedMessage({ action: 'run' }, 'replay-1'));
    expect(first.ok).toBe(false);
    allow = true;
    const second = await handler.handleCommand(makeSignedMessage({ action: 'run' }, 'replay-1'));
    expect(second.ok).toBe(true);
  });
});

describe('RFC-074: bounded command validity', () => {
  const now = 1_800_000_000_000;
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
  afterEach(() => { jest.useRealTimers(); });

  it.each([
    ['future issue', now + 1, now + 60_000],
    ['expired', now - 1, now],
    ['reversed lifetime', now, now - 1],
    ['empty lifetime', now, now],
    ['excessive lifetime', now, now + 60_001],
    ['stale issue', now - 60_001, now + 1],
    ['fractional issue', now - 0.5, now + 1],
    ['invalid issue', null, now + 1],
    ['fractional expiry', now, now + 0.5],
    ['unsafe expiry', now, Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s before verification, policy or execution', async (_label, issuedAt, expiresAt) => {
    const { client } = makeMockClient();
    const runtime = makeAllowedRuntime('validity');
    const check = jest.spyOn(runtime.ports.policy!, 'check');
    const verify = jest.fn(async () => true);
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler({ runtime, client, verifyCommandSignature: verify, executor: { execute } });
    const message = makeSignedMessage({ action: 'run' });
    const body = JSON.parse(message.payload as string);
    Object.assign(body.envelope, { issuedAt, expiresAt });
    message.payload = JSON.stringify(body);
    expect((await handler.handleCommand(message)).ok).toBe(false);
    expect(verify).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([now + 1, now - 60_001, -1, 0, now - 0.5])('rejects invalid legacy createdAt=%s', async (createdAt) => {
    const { client } = makeMockClient();
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler({
      runtime: makeAllowedRuntime('legacy-time'), client, requireSignedCommands: false, executor: { execute },
    });
    expect((await handler.handleCommand(makeMsg('ping', { createdAt }))).ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a command that expires while signature verification is pending', async () => {
    const { client } = makeMockClient();
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler({
      runtime: makeAllowedRuntime('slow-verify'), client, executor: { execute },
      async verifyCommandSignature() { jest.setSystemTime(now + 60_000); return true; },
    });
    expect((await handler.handleCommand(makeSignedMessage({}))).error).toMatch(/expired/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a command that expires while policy is pending', async () => {
    const { client } = makeMockClient();
    const runtime = makeAllowedRuntime('slow-policy');
    runtime.ports.policy!.check = async () => {
      jest.setSystemTime(now + 60_000);
      return { ok: true, data: { allowed: true } };
    };
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler({
      runtime, client, executor: { execute }, verifyCommandSignature: async () => true,
    });
    expect((await handler.handleCommand(makeSignedMessage({}))).error).toMatch(/expired/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a successful policy response without an explicit allowed decision', async () => {
    const { client } = makeMockClient();
    const runtime = makeAllowedRuntime('empty-policy');
    runtime.ports.policy!.check = async () => ({ ok: true });
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler({ runtime, client, executor: { execute }, requireSignedCommands: false });
    expect((await handler.handleCommand(makeMsg('ping'))).ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps a replay claim through the inclusive maximum-age boundary', async () => {
    const { client } = makeMockClient();
    const execute = jest.fn(async () => ({ ok: true }));
    const handler = createMqttCommandHandler({
      runtime: makeAllowedRuntime('boundary'), client, executor: { execute }, requireSignedCommands: false,
    });
    const message = makeMsg('ping');
    expect((await handler.handleCommand(message)).ok).toBe(true);
    jest.setSystemTime(now + 60_000);
    expect((await handler.handleCommand(message)).error).toMatch(/duplicate/);
    jest.setSystemTime(now + 60_001);
    expect((await handler.handleCommand(message)).error).toMatch(/too old/);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid max age %s', (maxCommandAgeMs) => {
    const { client } = makeMockClient();
    expect(() => createMqttCommandHandler({
      runtime: makeAllowedRuntime('config'), client, maxCommandAgeMs,
    })).toThrow(/positive safe integer/);
  });

  it.each(['null', '[]', '42'])('rejects non-object JSON %s', async (payload) => {
    const { client } = makeMockClient();
    const handler = createMqttCommandHandler({ runtime: makeAllowedRuntime('json'), client });
    expect((await handler.handleCommand({ topic: 'commands', payload, receivedAt: now })).ok).toBe(false);
  });
});

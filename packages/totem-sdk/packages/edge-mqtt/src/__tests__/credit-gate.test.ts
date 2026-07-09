import { createMqttCreditGate } from '../credit-gate.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import type { MqttClientPort } from '../client-port.js';

function makeMockClient() {
  const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  const client: MqttClientPort = {
    async subscribe(topic) { return { topic, async unsubscribe() {} }; },
    async publish(topic, payload) { published.push({ topic, payload }); },
    onMessage() { return () => {}; },
  };
  return { client, published };
}

function makeRuntime() {
  return createEdgeRuntime({
    deviceId: 'gate-test',
    capabilities: createCapabilitySet([]),
    ports: {},
  });
}

describe('credit-gate.test — recordUsage + threshold enforcement, no payment probe', () => {
  it('allows publish when no limit is set', async () => {
    const { client } = makeMockClient();
    const gate = createMqttCreditGate({ runtime: makeRuntime(), deviceId: 'gate-test', client, mode: 'block' });
    const result = await gate.gatePublish('test/topic', 'hello');
    expect(result.ok).toBe(true);
  });

  it('allows publish when usage is below limit', async () => {
    const { client } = makeMockClient();
    const gate = createMqttCreditGate({
      runtime: makeRuntime(), deviceId: 'gate-test', client,
      unpaidLimit: '100', mode: 'block',
    });
    gate.recordUsage('50');
    const result = await gate.gatePublish('test/topic', 'hello');
    expect(result.ok).toBe(true);
  });

  it('blocks publish when accumulated usage exceeds limit', async () => {
    const { client } = makeMockClient();
    const gate = createMqttCreditGate({
      runtime: makeRuntime(), deviceId: 'gate-test', client,
      unpaidLimit: '100', mode: 'block',
    });
    gate.recordUsage('101');
    const decision = await gate.checkCredit();
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('101');

    const result = await gate.gatePublish('test/topic', 'blocked');
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MQTT_CREDIT_EXCEEDED');
  });

  it('recordUsage accumulates correctly', async () => {
    const { client } = makeMockClient();
    const gate = createMqttCreditGate({
      runtime: makeRuntime(), deviceId: 'gate-test', client,
      unpaidLimit: '10', mode: 'block',
    });
    gate.recordUsage('4');
    gate.recordUsage('3');
    expect(gate.getUnpaidUsage()).toBe('7');
    gate.recordUsage('4');
    const decision = await gate.checkCredit();
    expect(decision.allowed).toBe(false);
  });

  it('reads usage from external getUsage hook', async () => {
    const { client } = makeMockClient();
    let externalUsage = '0';
    const gate = createMqttCreditGate({
      runtime: makeRuntime(), deviceId: 'gate-test', client,
      unpaidLimit: '50', mode: 'block',
      getUsage: () => externalUsage,
    });

    const before = await gate.checkCredit();
    expect(before.allowed).toBe(true);

    externalUsage = '75';
    const after = await gate.checkCredit();
    expect(after.allowed).toBe(false);
    expect(after.reason).toContain('75');
  });

  it('does not call payment.pay() as a credit probe', async () => {
    let payCalled = false;
    const runtime = createEdgeRuntime({
      deviceId: 'gate-no-probe',
      capabilities: createCapabilitySet([]),
      ports: {
        payment: {
          async pay() {
            payCalled = true;
            return { ok: true, data: {} };
          },
        },
      },
    });
    const { client } = makeMockClient();
    const gate = createMqttCreditGate({
      runtime, deviceId: 'gate-no-probe', client,
      unpaidLimit: '100', mode: 'block',
    });
    gate.recordUsage('10');
    await gate.checkCredit();
    expect(payCalled).toBe(false);
  });

  it('publishShutdownNotice publishes to shutdown topic', async () => {
    const { client, published } = makeMockClient();
    const gate = createMqttCreditGate({
      runtime: makeRuntime(), deviceId: 'gate-test3', client,
      shutdownTopic: 'totem/gate-test3/shutdown', mode: 'shutdown',
    });
    await gate.publishShutdownNotice('test reason');
    expect(published.some((p) => p.topic === 'totem/gate-test3/shutdown')).toBe(true);
  });

  it('shutdown mode publishes shutdown notice when credit exceeded', async () => {
    const { client, published } = makeMockClient();
    const gate = createMqttCreditGate({
      runtime: makeRuntime(), deviceId: 'gate-test4', client,
      unpaidLimit: '10', shutdownTopic: 'totem/gate-test4/shutdown', mode: 'shutdown',
    });
    gate.recordUsage('15');
    await gate.gatePublish('test/topic', 'data');
    expect(published.some((p) => p.topic === 'totem/gate-test4/shutdown')).toBe(true);
  });
});

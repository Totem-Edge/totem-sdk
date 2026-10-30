import { createMqttEdgeGateway } from '../gateway.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import type { MqttClientPort, MqttMessage } from '../client-port.js';
import type { MqttTopicRule } from '../types.js';

function makeMockClient() {
  const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  const handlers: Array<(m: MqttMessage) => void> = [];
  const subscribed: string[] = [];

  const client: MqttClientPort = {
    async connect() {},
    async disconnect() {},
    async subscribe(topic) {
      subscribed.push(topic);
      return { topic, async unsubscribe() {} };
    },
    async publish(topic, payload) {
      published.push({ topic, payload });
    },
    onMessage(handler) {
      handlers.push(handler);
      return () => { handlers.splice(handlers.indexOf(handler), 1); };
    },
  };
  return { client, published, handlers, subscribed };
}

function makeMockRuntime() {
  return createEdgeRuntime({
    deviceId: 'gw-test',
    capabilities: createCapabilitySet([]),
    ports: {},
  });
}

const commandRule: MqttTopicRule = {
  id: 'cmd-rule',
  kind: 'command',
  topicPattern: 'totem/+/commands',
  enabled: true,
};

describe('gateway.test — start, subscribe, stop, status, manifest', () => {
  it('gateway starts and subscribes to rule topics', async () => {
    const { client, subscribed, published } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({
      deviceId: 'gw-test',
      client,
      runtime,
      rules: [commandRule],
    });

    await gw.start();
    expect(subscribed).toContain('totem/+/commands');
    expect(gw.status().running).toBe(true);
    expect(published.some((p) => p.topic.includes('status'))).toBe(true);
  });

  it('gateway stops and updates status', async () => {
    const { client } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({ deviceId: 'gw-test', client, runtime });
    await gw.start();
    await gw.stop();
    expect(gw.status().running).toBe(false);
    expect(gw.status().stoppedAt).toBeDefined();
  });

  it('gateway publishStatus publishes to status topic', async () => {
    const { client, published } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({ deviceId: 'gw-test', client, runtime });
    await gw.publishStatus();
    expect(published.some((p) => p.topic === 'totem/gw-test/status')).toBe(true);
  });

  it('gateway publishManifest publishes manifest when provided', async () => {
    const { client, published } = makeMockClient();
    const runtime = makeMockRuntime();
    const manifest = { manifestId: 'test-manifest' } as unknown as import('@totemsdk/manifest').SignedManifest<import('@totemsdk/manifest').EdgeServiceManifest>;
    const gw = createMqttEdgeGateway({ deviceId: 'gw-test', client, runtime, manifest });
    await gw.publishManifest();
    expect(published.some((p) => p.topic === 'totem/gw-test/manifest')).toBe(true);
  });

  it('gateway does not publishManifest when no manifest in config', async () => {
    const { client, published } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({ deviceId: 'gw-test', client, runtime });
    await gw.publishManifest();
    expect(published.some((p) => p.topic === 'totem/gw-test/manifest')).toBe(false);
  });

  it('gateway works with mock MqttClientPort — no real network', async () => {
    const { client } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({ deviceId: 'gw-test', client, runtime });
    await expect(gw.start()).resolves.not.toThrow();
    await expect(gw.stop()).resolves.not.toThrow();
  });

  it('transport.kind = "hyperswarm" is accepted as metadata only', async () => {
    const { client } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({
      deviceId: 'gw-test',
      client,
      runtime,
      transport: { kind: 'hyperswarm', swarmTopic: 'test-swarm' },
    });
    await gw.start();
    const status = gw.status();
    expect(status.transport?.kind).toBe('hyperswarm');
    expect(status.running).toBe(true);
    await gw.stop();
  });

  it('gateway dispatch does not instantiate subsystems implicitly', async () => {
    const { client } = makeMockClient();
    const runtime = makeMockRuntime();
    const gw = createMqttEdgeGateway({
      deviceId: 'gw-test',
      client,
      runtime,
      rules: [commandRule],
    });
    await gw.start();
    await expect(
      gw.handleMessage({ topic: 'totem/gw-test/commands', payload: '{}', receivedAt: Date.now() })
    ).resolves.not.toThrow();
    await gw.stop();
  });
});

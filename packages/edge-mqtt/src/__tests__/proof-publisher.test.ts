import { createMqttProofPublisher } from '../proof-publisher.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import type { MqttClientPort, MqttMessage } from '../client-port.js';

function makeMockClient() {
  const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  const client: MqttClientPort = {
    async subscribe(topic) { return { topic, async unsubscribe() {} }; },
    async publish(topic, payload) { published.push({ topic, payload }); },
    onMessage() { return () => {}; },
  };
  return { client, published };
}

const msg: MqttMessage = {
  topic: 'sensors/dev/temp/raw',
  payload: JSON.stringify({ temp: 22.5 }),
  receivedAt: Date.now(),
};

describe('proof-publisher.test — edge-port mode, no WOTS lease', () => {
  it('createProofFromMessage returns MqttProofEnvelope', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'pub-test',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const publisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proofs/out',
    });
    const envelope = await publisher.createProofFromMessage(msg);
    expect(envelope.envelopeId).toBeDefined();
    expect(envelope.topic).toBe(msg.topic);
    expect(envelope.message).toBe(msg);
    expect(typeof envelope.createdAt).toBe('number');
  });

  it('publishProof publishes to defaultProofTopic', async () => {
    const { client, published } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'pub-test2',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const publisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proofs/out',
    });
    const envelope = await publisher.createProofFromMessage(msg);
    await publisher.publishProof(envelope);
    expect(published.some((p) => p.topic === 'proofs/out')).toBe(true);
  });

  it('publishProof uses injected proof port in edge-port mode', async () => {
    const { client, published } = makeMockClient();
    let proofPortCalled = false;
    const runtime = createEdgeRuntime({
      deviceId: 'pub-test3',
      capabilities: createCapabilitySet([]),
      ports: {
        proof: {
          async createProof() {
            proofPortCalled = true;
            return { ok: true, data: { proofId: 'test-proof-id', proof: { id: 'test' } } };
          },
          async verifyProof() { return { ok: true, data: { valid: true } }; },
        },
      },
    });
    const publisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proofs/out',
      proofMode: 'edge-port',
    });
    const envelope = await publisher.createProofFromMessage(msg);
    expect(proofPortCalled).toBe(true);
    expect(envelope.proofId).toBe('test-proof-id');
  });

  it('does not manage WOTS lease internally', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'pub-test4',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const publisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proofs/out',
    });
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'proof-publisher.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/reserveKey/);
    expect(src).not.toMatch(/wots-lease/);
    expect(src).not.toMatch(/keyIndex/);
  });
});

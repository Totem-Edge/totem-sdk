import { createMqttProofPublisher } from '../proof-publisher.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import { verifyProofSignature } from '@totemsdk/proof';
import type { SignedProof } from '@totemsdk/proof';
import type { MqttProofPublisherConfig } from '../types.js';
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

  it('rejects signing configuration without a lease provider', () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'pub-test4',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    expect(() => createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proofs/out',
      proofMode: 'proof-package',
      seed: new Uint8Array(32).fill(7),
    })).toThrow(/leaseProvider/);
  });
});

describe('RFC-074: lease-backed MQTT proofs', () => {
  function config(): MqttProofPublisherConfig {
    return {
      runtime: createEdgeRuntime({ deviceId: 'lease-proof', capabilities: createCapabilitySet([]), ports: {} }),
      client: makeMockClient().client,
      defaultProofTopic: 'proofs/out', proofMode: 'proof-package', seed: new Uint8Array(32).fill(8),
    };
  }

  it('reserves and commits distinct keys across concurrent publishers and handler recreation', async () => {
    let nextIndex = 0;
    const committed: string[] = [];
    const leaseProvider: NonNullable<MqttProofPublisherConfig['leaseProvider']> = {
      async reserveKeyUse() {
        const index = nextIndex++;
        return { reservationId: `r-${index}`, indices: { addressIndex: 0, l1: 0, l2: index } };
      },
      async commitKeyUse(id) { committed.push(id); },
      async burnReservation() { throw new Error('unexpected burn'); },
    };
    const options = { ...config(), leaseProvider };
    const publisher = createMqttProofPublisher(options);
    const envelopes = await Promise.all([
      publisher.createProofFromMessage(msg),
      publisher.createProofFromMessage({ ...msg, payload: 'second' }),
      createMqttProofPublisher(options).createProofFromMessage({ ...msg, payload: 'third' }),
    ]);
    const proofs = envelopes.map((envelope) => envelope.proof as SignedProof);
    expect(new Set(proofs.map((proof) => proof.signature.publicKey)).size).toBe(3);
    expect(proofs.every(verifyProofSignature)).toBe(true);
    expect(committed.sort()).toEqual(['r-0', 'r-1', 'r-2']);
  });

  it('fails without returning a proof when reservation fails', async () => {
    const commitKeyUse = jest.fn(async () => {});
    const publisher = createMqttProofPublisher({
      ...config(), leaseProvider: {
        async reserveKeyUse() { throw new Error('lease unavailable'); },
        commitKeyUse, async burnReservation() {},
      },
    });
    await expect(publisher.createProofFromMessage(msg)).rejects.toThrow('lease unavailable');
    expect(commitKeyUse).not.toHaveBeenCalled();
  });

  it('burns a reservation when commit fails and does not return the signature', async () => {
    const burnReservation = jest.fn(async () => {});
    const publisher = createMqttProofPublisher({
      ...config(), leaseProvider: {
        async reserveKeyUse() {
          return { reservationId: 'uncertain', indices: { addressIndex: 0, l1: 1, l2: 0 } };
        },
        async commitKeyUse() { throw new Error('commit uncertain'); },
        burnReservation,
      },
    });
    await expect(publisher.createProofFromMessage(msg)).rejects.toThrow('commit uncertain');
    expect(burnReservation).toHaveBeenCalledWith('uncertain', 'commit uncertain');
  });

  it('can still construct an explicitly unsigned proof without a seed', async () => {
    const publisher = createMqttProofPublisher({ ...config(), seed: undefined });
    const envelope = await publisher.createProofFromMessage(msg);
    expect(envelope.proof).not.toHaveProperty('signature');
  });
});

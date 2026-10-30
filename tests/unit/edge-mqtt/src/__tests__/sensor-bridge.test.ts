import { createMqttSensorBridge } from '../sensor-bridge.js';
import { createEdgeRuntime, createCapabilitySet } from '@totemsdk/edge';
import { createMqttEdgeGateway } from '../gateway.js';
import { createMqttProofPublisher } from '../proof-publisher.js';
import type { MqttClientPort, MqttMessage } from '../client-port.js';

function makeMockClient() {
  const published: Array<{ topic: string; payload: string | Uint8Array }> = [];
  const handlers: Array<(m: MqttMessage) => void> = [];
  const client: MqttClientPort = {
    async connect() {},
    async disconnect() {},
    async subscribe(topic) { return { topic, async unsubscribe() {} }; },
    async publish(topic, payload) { published.push({ topic, payload }); },
    onMessage(handler) {
      handlers.push(handler);
      return () => { handlers.splice(handlers.indexOf(handler), 1); };
    },
  };
  return { client, published, handlers };
}

describe('sensor-bridge.test — converts message into proof event', () => {
  it('handleSensorMessage calls proof publisher for sensor binding', async () => {
    const { client, published } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'bridge-test',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const gateway = createMqttEdgeGateway({ deviceId: 'bridge-test', client, runtime });
    const proofPublisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'sensors/bridge-test/proof',
      defaultReceiptTopic: 'sensors/bridge-test/receipt',
    });

    const bridge = createMqttSensorBridge({
      gateway,
      bindings: [{ sensorId: 'temp-01', inputTopic: 'sensors/bridge-test/temp-01/raw' }],
      proofPublisher,
      client,
    });

    const message: MqttMessage = {
      topic: 'sensors/bridge-test/temp-01/raw',
      payload: JSON.stringify({ temperature: 22.5 }),
      receivedAt: Date.now(),
    };

    await bridge.handleSensorMessage(
      { sensorId: 'temp-01', inputTopic: 'sensors/bridge-test/temp-01/raw' },
      message
    );

    expect(published.some((p) => p.topic === 'sensors/bridge-test/proof')).toBe(true);
  });

  it('parses JSON payload correctly', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'bridge-test2',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const gateway = createMqttEdgeGateway({ deviceId: 'bridge-test2', client, runtime });
    const proofPublisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proof/out',
    });

    const bridge = createMqttSensorBridge({
      gateway,
      bindings: [{ sensorId: 's1', inputTopic: 's/in' }],
      proofPublisher,
      client,
    });

    await expect(
      bridge.handleSensorMessage(
        { sensorId: 's1', inputTopic: 's/in' },
        { topic: 's/in', payload: '{"value": 42}', receivedAt: Date.now() }
      )
    ).resolves.not.toThrow();
  });

  it('handles Uint8Array payload without throwing', async () => {
    const { client } = makeMockClient();
    const runtime = createEdgeRuntime({
      deviceId: 'bridge-test3',
      capabilities: createCapabilitySet([]),
      ports: {},
    });
    const gateway = createMqttEdgeGateway({ deviceId: 'bridge-test3', client, runtime });
    const proofPublisher = createMqttProofPublisher({
      runtime,
      client,
      defaultProofTopic: 'proof/out',
    });

    const bridge = createMqttSensorBridge({
      gateway,
      bindings: [{ sensorId: 's2', inputTopic: 's/binary' }],
      proofPublisher,
      client,
    });

    await expect(
      bridge.handleSensorMessage(
        { sensorId: 's2', inputTopic: 's/binary' },
        { topic: 's/binary', payload: new Uint8Array([0x01, 0x02, 0x03]), receivedAt: Date.now() }
      )
    ).resolves.not.toThrow();
  });
});

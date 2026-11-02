import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRos2Gateway } from '../../../packages/edge-ros2/dist/gateway.js';
import { createRos2SensorBridge } from '../../../packages/edge-ros2/dist/sensor-bridge.js';

class SimulatedRos2 {
  initialized = false;
  shutdownCalled = false;
  subscriptions = [];
  publishers = [];
  clients = [];
  errorHandlers = [];

  async init() { this.initialized = true; }
  async shutdown() { this.shutdownCalled = true; }
  async createPublisher(topic, type) {
    const publisher = { topic, type, published: [], async publish(message) { this.published.push(message); }, async destroy() { this.destroyed = true; } };
    this.publishers.push(publisher);
    return publisher;
  }
  async createSubscription(topic, type, handler) {
    const entry = { topic, type, handler, destroyed: false };
    entry.subscription = { async destroy() { entry.destroyed = true; } };
    this.subscriptions.push(entry);
    return entry.subscription;
  }
  async createClient(service, type) {
    const client = {
      service, type, calls: [], destroyed: false,
      async call(request) { this.calls.push(request); if (service === '/slow') return new Promise(() => {}); return { data: Uint8Array.of(9), type, receivedAt: Date.now() }; },
      async destroy() { this.destroyed = true; },
    };
    this.clients.push(client);
    return client;
  }
  async createService() { return { async destroy() {} }; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emit(topic, message) { for (const entry of this.subscriptions) if (entry.topic === topic) entry.handler(message); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'ros2-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

test('ROS 2 gateway and bridge exercise topics, services, errors and teardown', async () => {
  const transport = new SimulatedRos2();
  const proofs = [];
  const gateway = createRos2Gateway({
    runtime: runtime(proofs),
    transport,
    nodeName: 'edge-node',
    subscriptions: [{ topic: '/scan', messageType: 'sensor_msgs/msg/LaserScan', sensorId: 'lidar' }],
  });

  await gateway.start();
  assert.equal(transport.initialized, true);
  assert.equal(transport.subscriptions.length, 1);
  assert.equal(gateway.status, 'running');

  transport.emit('/scan', { data: Uint8Array.of(1, 2), type: 'sensor_msgs/msg/LaserScan', sourceNode: '/lidar', receivedAt: 1000 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:lidar' && proof.claims[0].data[0] === 1));

  const publisher = await gateway.createPublisher('/cmd', 'std_msgs/msg/String');
  await publisher.publish({ data: Uint8Array.of(3), type: 'std_msgs/msg/String', receivedAt: 1 });
  assert.equal(transport.publishers[0].published.length, 1);

  const received = [];
  const subscription = await gateway.createSubscription('/custom', 'std_msgs/msg/String', (message) => received.push(message));
  transport.emit('/custom', { data: Uint8Array.of(4), type: 'std_msgs/msg/String', receivedAt: 2 });
  assert.equal(received.length, 1);
  await subscription.destroy();

  const service = await gateway.callService('/echo', 'std_srvs/srv/Trigger', { data: Uint8Array.of(1), type: 'std_srvs/srv/Trigger', receivedAt: 0 });
  assert.equal(service.ok, true);
  assert.deepEqual([...service.data.response.data], [9]);
  assert.equal(transport.clients[0].destroyed, true);

  const slow = await gateway.callService('/slow', 'std_srvs/srv/Trigger', { data: new Uint8Array(0), type: 'std_srvs/srv/Trigger', receivedAt: 0 }, 20);
  assert.equal(slow.ok, false);
  assert.match(slow.error, /timed out/);
  assert.equal(transport.clients[1].destroyed, true, 'timed-out client must be destroyed');

  const bridge = createRos2SensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'chatter', topic: '/chatter', messageType: 'std_msgs/msg/String', fieldExtractor: (message) => message.data[0] }],
  });
  await bridge.start();
  transport.emit('/chatter', { data: Uint8Array.of(5), type: 'std_msgs/msg/String', receivedAt: 3 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:chatter' && proof.claims[0].value === 5));
  await bridge.stop();

  transport.emitError(new Error('DDS domain lost'));
  assert.equal(gateway.status, 'error');

  await gateway.stop();
  assert.equal(transport.shutdownCalled, true);
  assert.equal(transport.subscriptions[0].destroyed, true);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});

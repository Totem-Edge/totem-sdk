import { createRos2Gateway } from '../gateway.js';
import { createRos2SensorBridge } from '../sensor-bridge.js';
import type { Ros2TransportPort, Ros2Message, Ros2Publisher, Ros2Subscription, Ros2Client } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

function makeMsg(overrides: Partial<Ros2Message> = {}): Ros2Message {
  return {
    data: new Uint8Array([1, 2, 3]),
    type: 'std_msgs/msg/String',
    sourceNode: 'sensor_node',
    receivedAt: Date.now(),
    ...overrides,
  };
}

class MockRos2Client implements Ros2Client {
  destroyed = false;
  response: Ros2Message = makeMsg();
  failCall = false;
  call() { if (this.failCall) return Promise.reject(new Error('call failed')); return Promise.resolve(this.response); }
  destroy() { this.destroyed = true; return Promise.resolve(); }
}

class MockRos2Transport implements Ros2TransportPort {
  initCalled = false;
  shutdownCalled = false;
  failInit = false;
  publishers: MockPublisher[] = [];
  subHandlers: Array<{ topic: string; handler: (msg: Ros2Message) => void; destroyed: boolean }> = [];
  clients: MockRos2Client[] = [];
  errorHandlers: Array<(err: Error) => void> = [];
  failShutdown = false;
  failClientCall = false;

  init() { this.initCalled = true; if (this.failInit) return Promise.reject(new Error('init failed')); return Promise.resolve(); }
  shutdown() { this.shutdownCalled = true; if (this.failShutdown) return Promise.reject(new Error('shutdown failed')); return Promise.resolve(); }
  createPublisher(topic: string, messageType: string) {
    const p = new MockPublisher();
    this.publishers.push(p);
    return Promise.resolve(p);
  }
  createSubscription(topic: string, messageType: string, handler: (msg: Ros2Message) => void) {
    const entry = { topic, handler, destroyed: false };
    this.subHandlers.push(entry);
    const sub: Ros2Subscription = { destroy: async () => { entry.destroyed = true; } };
    return Promise.resolve(sub);
  }
  createClient() { const c = new MockRos2Client(); c.failCall = this.failClientCall; this.clients.push(c); return Promise.resolve(c); }
  createService() { return Promise.resolve({ destroy: async () => {} }); }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); }; }
  emitError(err: Error) { this.errorHandlers.forEach((h) => h(err)); }
  emitOnTopic(topic: string, msg: Ros2Message) { this.subHandlers.filter((s) => s.topic === topic).forEach((s) => s.handler(msg)); }
}

class MockPublisher implements Ros2Publisher {
  readonly published: Ros2Message[] = [];
  destroyed = false;
  failPublish = false;
  publish(message: Ros2Message) { if (this.failPublish) return Promise.reject(new Error('publish failed')); this.published.push(message); return Promise.resolve(); }
  destroy() { this.destroyed = true; return Promise.resolve(); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  const createProof = jest.fn(async (params: { subject: string; claims: unknown[] }) =>
    ({ ok: true, data: { proofId: 'p1', proof: {} } }),
  );
  return { createProof };
}

describe('edge-ros2 gateway', () => {
  it('start inits transport and reports running status', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.initCalled).toBe(true);
    expect(gw.status).toBe('running');
  });

  it('start propagates init errors', async () => {
    const transport = new MockRos2Transport();
    transport.failInit = true;
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    await expect(gw.start()).rejects.toThrow('init failed');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    await gw.start();
    await gw.start();
    expect(transport.subHandlers).toHaveLength(0);
  });

  it('subscribes to configured topics and emits proofs for messages', async () => {
    const transport = new MockRos2Transport();
    const proof = makeProof();
    const gw = createRos2Gateway({
      runtime: makeRuntime(proof),
      transport,
      nodeName: 'totem_node',
      subscriptions: [{ topic: '/sensors/temp', messageType: 'sensor_msgs/msg/Temperature', sensorId: 'temp1' }],
    });
    await gw.start();
    expect(transport.subHandlers).toHaveLength(1);
    transport.emitOnTopic('/sensors/temp', makeMsg());
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', topic: '/sensors/temp', data: [1, 2, 3] })],
    }));
    await gw.stop();
  });

  it('does not emit proofs for subscriptions without a sensorId', async () => {
    const transport = new MockRos2Transport();
    const proof = makeProof();
    const gw = createRos2Gateway({
      runtime: makeRuntime(proof),
      transport,
      nodeName: 'totem_node',
      subscriptions: [{ topic: '/raw', messageType: 'std_msgs/msg/Bool' }],
    });
    await gw.start();
    transport.emitOnTopic('/raw', makeMsg());
    expect(proof.createProof).not.toHaveBeenCalled();
    await gw.stop();
  });

  it('stop destroys subscriptions and shuts down transport', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({
      runtime: makeRuntime(),
      transport,
      nodeName: 'totem_node',
      subscriptions: [{ topic: '/sensors/temp', messageType: 'sensor_msgs/msg/Temperature', sensorId: 'temp1' }],
    });
    await gw.start();
    await gw.stop();
    expect(transport.subHandlers[0].destroyed).toBe(true);
    expect(transport.shutdownCalled).toBe(true);
    expect(gw.status).toBe('stopped');
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    await gw.start();
    transport.emitError(new Error('dds down'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('createPublisher returns a working publisher', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    const pub = await gw.createPublisher('/cmd', 'geometry_msgs/msg/Twist');
    const msg = makeMsg();
    await pub.publish(msg);
    expect(transport.publishers[0].published).toEqual([msg]);
  });

  it('createSubscription delivers messages to handler', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    const seen: Ros2Message[] = [];
    await gw.createSubscription('/topic', 'std_msgs/msg/String', (m) => seen.push(m));
    transport.emitOnTopic('/topic', makeMsg());
    expect(seen).toHaveLength(1);
  });

  it('callService returns response on success', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    const res = await gw.callService('/add_two_ints', 'example_interfaces/srv/AddTwoInts', makeMsg());
    expect(res.ok).toBe(true);
    expect(transport.clients).toHaveLength(1);
    expect(transport.clients[0].destroyed).toBe(true);
  });

  it('callService maps failures to an error result', async () => {
    const transport = new MockRos2Transport();
    const gw = createRos2Gateway({ runtime: makeRuntime(), transport, nodeName: 'totem_node' });
    transport.failClientCall = true;
    const res = await gw.callService('/add_two_ints', 'example_interfaces/srv/AddTwoInts', makeMsg());
    expect(res).toEqual({ ok: false, error: 'Error: call failed' });
  });
});

describe('edge-ros2 sensor bridge', () => {
  it('start subscribes and creates proofs for messages', async () => {
    const transport = new MockRos2Transport();
    const proof = makeProof();
    const bridge = createRos2SensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', topic: '/sensors/temp', messageType: 'sensor_msgs/msg/Temperature', unit: 'degC' }],
    });
    await bridge.start();
    transport.emitOnTopic('/sensors/temp', makeMsg());
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', value: [1, 2, 3], unit: 'degC' })],
    }));
    await bridge.stop();
  });

  it('uses fieldExtractor when provided', async () => {
    const transport = new MockRos2Transport();
    const proof = makeProof();
    const bridge = createRos2SensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{
        sensorId: 'temp1',
        topic: '/sensors/temp',
        messageType: 'sensor_msgs/msg/Temperature',
        fieldExtractor: () => 42.5,
      }],
    });
    await bridge.start();
    transport.emitOnTopic('/sensors/temp', makeMsg());
    expect((proof.createProof.mock.calls[0][0] as unknown as { claims: Array<{ value: unknown }> }).claims[0]).toMatchObject({ value: 42.5 });
    await bridge.stop();
  });

  it('stop destroys subscriptions', async () => {
    const transport = new MockRos2Transport();
    const bridge = createRos2SensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 'temp1', topic: '/sensors/temp', messageType: 'sensor_msgs/msg/Temperature' }],
    });
    await bridge.start();
    expect(transport.subHandlers).toHaveLength(1);
    await bridge.stop();
    expect(transport.subHandlers[0].destroyed).toBe(true);
  });
});
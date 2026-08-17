import { createMatterGateway } from '../gateway.js';
import { createMatterSensorBridge } from '../sensor-bridge.js';
import type { MatterTransportPort, MatterNode, MatterAttributeValue, MatterSubscription } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockSubscription implements MatterSubscription {
  cancelled = false;
  readonly changeHandlers: Array<(reports: MatterAttributeValue[]) => void> = [];
  onChange(handler: (reports: MatterAttributeValue[]) => void) {
    this.changeHandlers.push(handler);
    return () => { const i = this.changeHandlers.indexOf(handler); if (i >= 0) this.changeHandlers.splice(i, 1); };
  }
  cancel() { this.cancelled = true; return Promise.resolve(); }
  emitChange(reports: MatterAttributeValue[]) { this.changeHandlers.forEach((h) => h(reports)); }
}

class MockMatterTransport implements MatterTransportPort {
  initArgs: Array<{ vendorId: number; productId: number }> = [];
  shutdownCalled = false;
  failInit = false;
  failCommission = false;
  failRead = false;
  failWrite = false;
  failInvoke = false;
  nodes: MatterNode[] = [];
  attributeValue: MatterAttributeValue = {
    nodeId: 'n1', endpointId: 1, clusterId: 6, attributeId: 0, value: 21.5, dataType: 'int16', receivedAt: Date.now(),
  };
  commissionedHandlers: Array<(node: MatterNode) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];
  readonly subscriptions: MockSubscription[] = [];

  init(vendorId: number, productId: number) {
    this.initArgs.push({ vendorId, productId });
    if (this.failInit) return Promise.reject(new Error('init failed'));
    return Promise.resolve();
  }
  shutdown() { this.shutdownCalled = true; return Promise.resolve(); }
  commission(_device: { discriminator: number }, _setupCode: string) {
    if (this.failCommission) return Promise.reject(new Error('commission failed'));
    const node: MatterNode = { nodeId: 'n1', vendorId: 65521, productId: 1, endpoints: [] };
    return Promise.resolve(node);
  }
  decommission() { return Promise.resolve(); }
  readAttribute(_nodeId: string, _endpointId: number, _clusterId: number, _attributeId: number) {
    if (this.failRead) return Promise.reject(new Error('read failed'));
    return Promise.resolve(this.attributeValue);
  }
  writeAttribute() { if (this.failWrite) return Promise.reject(new Error('write failed')); return Promise.resolve(); }
  subscribe(_nodeId: string, _endpointId: number, _clusterId: number, _attributeIds: number[], _min: number, _max: number) {
    const sub = new MockSubscription();
    this.subscriptions.push(sub);
    return Promise.resolve(sub);
  }
  invokeCommand() { if (this.failInvoke) return Promise.reject(new Error('invoke failed')); return Promise.resolve({ status: 0 }); }
  onCommissioned(handler: (node: MatterNode) => void) {
    this.commissionedHandlers.push(handler);
    return () => { this.commissionedHandlers = this.commissionedHandlers.filter((h) => h !== handler); };
  }
  onError(handler: (err: Error) => void) {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); };
  }
  emitCommissioned(node: MatterNode) { this.commissionedHandlers.forEach((h) => h(node)); }
  emitError(err: Error) { this.errorHandlers.forEach((h) => h(err)); }
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

const NODE: MatterNode = { nodeId: 'n1', vendorId: 65521, productId: 1, vendorName: 'Acme', productName: 'Sensor', endpoints: [] };

describe('edge-matter gateway', () => {
  it('start inits transport and reports running status', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.initArgs).toEqual([{ vendorId: 65521, productId: 2 }]);
    expect(gw.status).toBe('running');
  });

  it('start is a no-op when already running', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    await gw.start();
    await gw.start();
    expect(transport.initArgs).toHaveLength(1);
  });

  it('start propagates init errors', async () => {
    const transport = new MockMatterTransport();
    transport.failInit = true;
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    await expect(gw.start()).rejects.toThrow('init failed');
  });

  it('stop cancels subscriptions and shuts down transport', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({
      runtime: makeRuntime(),
      transport,
      vendorId: 65521,
      productId: 2,
      subscriptions: [{ nodeId: 'n1', endpointId: 1, clusterId: 6, attributeIds: [0], sensorId: 's1', minInterval: 1, maxInterval: 60 }],
    });
    await gw.start();
    expect(transport.subscriptions).toHaveLength(1);
    await gw.stop();
    expect(transport.subscriptions[0].cancelled).toBe(true);
    expect(transport.shutdownCalled).toBe(true);
    expect(gw.status).toBe('stopped');
  });

  it('emits a proof when a device is commissioned', async () => {
    const transport = new MockMatterTransport();
    const proof = makeProof();
    const gw = createMatterGateway({ runtime: makeRuntime(proof), transport, vendorId: 65521, productId: 2 });
    await gw.start();
    transport.emitCommissioned(NODE);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'matter:commissioned',
      claims: [expect.objectContaining({ nodeId: 'n1', vendorName: 'Acme', productName: 'Sensor' })],
    }));
    await gw.stop();
  });

  it('emits a sensor proof on attribute change report', async () => {
    const transport = new MockMatterTransport();
    const proof = makeProof();
    const gw = createMatterGateway({
      runtime: makeRuntime(proof),
      transport,
      vendorId: 65521,
      productId: 2,
      subscriptions: [{ nodeId: 'n1', endpointId: 1, clusterId: 6, attributeIds: [0], sensorId: 'temp1', minInterval: 1, maxInterval: 60 }],
    });
    await gw.start();
    const sub = transport.subscriptions[0];
    sub.emitChange([{ nodeId: 'n1', endpointId: 1, clusterId: 6, attributeId: 0, value: 22.1, dataType: 'int16', receivedAt: Date.now() }]);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', value: 22.1 })],
    }));
    await gw.stop();
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    await gw.start();
    transport.emitError(new Error('sync fail'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });

  it('commission returns node on success', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    const res = await gw.commission(3840, '1234-5678');
    expect(res.ok).toBe(true);
    expect((res as { data: { node: MatterNode } }).data.node.nodeId).toBe('n1');
  });

  it('commission maps failures to an error result', async () => {
    const transport = new MockMatterTransport();
    transport.failCommission = true;
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    const res = await gw.commission(3840, '1234-5678');
    expect(res).toEqual({ ok: false, error: 'Error: commission failed' });
  });

  it('readAttribute returns value on success', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    const res = await gw.readAttribute('n1', 1, 6, 0);
    expect(res.ok).toBe(true);
    expect((res as { data: { value: MatterAttributeValue } }).data.value.value).toBe(21.5);
  });

  it('readAttribute maps failures to an error result', async () => {
    const transport = new MockMatterTransport();
    transport.failRead = true;
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    const res = await gw.readAttribute('n1', 1, 6, 0);
    expect(res).toEqual({ ok: false, error: 'Error: read failed' });
  });

  it('writeAttribute returns ok on success and forwards errors', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    expect(await gw.writeAttribute('n1', 1, 6, 1, 42)).toEqual({ ok: true });

    const failing = new MockMatterTransport();
    failing.failWrite = true;
    const gwFail = createMatterGateway({ runtime: makeRuntime(), transport: failing, vendorId: 65521, productId: 2 });
    expect(await gwFail.writeAttribute('n1', 1, 6, 1, 42)).toEqual({ ok: false, error: 'Error: write failed' });
  });

  it('invokeCommand returns result on success and forwards errors', async () => {
    const transport = new MockMatterTransport();
    const gw = createMatterGateway({ runtime: makeRuntime(), transport, vendorId: 65521, productId: 2 });
    const res = await gw.invokeCommand('n1', 1, 6, 2, {});
    expect(res.ok).toBe(true);
    expect((res as { data: { result: unknown } }).data.result).toEqual({ status: 0 });

    const failing = new MockMatterTransport();
    failing.failInvoke = true;
    const gwFail = createMatterGateway({ runtime: makeRuntime(), transport: failing, vendorId: 65521, productId: 2 });
    expect(await gwFail.invokeCommand('n1', 1, 6, 2, {})).toEqual({ ok: false, error: 'Error: invoke failed' });
  });
});

describe('edge-matter sensor bridge', () => {
  it('poll reads attribute and creates a proof with sensor claims', async () => {
    const transport = new MockMatterTransport();
    const proof = makeProof();
    const bridge = createMatterSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', nodeId: 'n1', endpointId: 1, clusterId: 6, attributeId: 0, intervalMs: 30_000, unit: 'degC' }],
    });
    await bridge.poll();
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', value: 21.5, dataType: 'int16', unit: 'degC' })],
    }));
  });

  it('poll swallows transport failures', async () => {
    const transport = new MockMatterTransport();
    transport.failRead = true;
    const bridge = createMatterSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 't', nodeId: 'n1', endpointId: 1, clusterId: 6, attributeId: 0, intervalMs: 30_000 }],
    });
    await expect(bridge.poll()).resolves.not.toThrow();
  });

  it('start runs an initial poll then stop clears timers', async () => {
    const transport = new MockMatterTransport();
    const proof = makeProof();
    const bridge = createMatterSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 't', nodeId: 'n1', endpointId: 1, clusterId: 6, attributeId: 0, intervalMs: 10_000 }],
    });
    await bridge.start();
    expect(proof.createProof).toHaveBeenCalled();
    await bridge.stop();
  });

  it('start is idempotent', async () => {
    const transport = new MockMatterTransport();
    const bridge = createMatterSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 't', nodeId: 'n1', endpointId: 1, clusterId: 6, attributeId: 0, intervalMs: 10_000 }],
    });
    await bridge.start();
    await bridge.start();
    await bridge.stop();
  });
});
import { createOpcuaGateway } from '../gateway.js';
import { createOpcuaSensorBridge } from '../sensor-bridge.js';
import type { OpcuaTransportPort, OpcuaValue, OpcuaValueChange, OpcuaSubscription, OpcuaNode } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockSubscription implements OpcuaSubscription {
  added: string[][] = [];
  removed: string[][] = [];
  destroyed = false;
  changeHandlers: Array<(events: OpcuaValueChange[]) => void> = [];

  async addNodes(nodeIds: string[]) { this.added.push(nodeIds); }
  async removeNodes(nodeIds: string[]) { this.removed.push(nodeIds); }
  onChange(handler: (events: OpcuaValueChange[]) => void) { this.changeHandlers.push(handler); return () => { this.changeHandlers = this.changeHandlers.filter(h => h !== handler); }; }
  async destroy() { this.destroyed = true; }
  emit(events: OpcuaValueChange[]) { for (const h of this.changeHandlers) h(events); }
}

class MockOpcuaTransport implements OpcuaTransportPort {
  endpoints: string[] = [];
  disconnectCalls = 0;
  subscribed: Array<{ nodeIds: string[]; samplingInterval: number }> = [];
  subscription = new MockSubscription();
  failConnect = false;
  failRead = false;
  failBrowse = false;
  failWrite = false;
  failCall = false;
  errorHandlers: Array<(err: Error) => void> = [];
  browseResult: OpcuaNode[] = [];
  readResult: OpcuaValue = { value: 21.5, dataType: 'Double' };
  callResult: OpcuaValue[] = [{ value: true, dataType: 'Boolean' }];

  async connect(endpointUrl: string) { if (this.failConnect) throw new Error('connect failed'); this.endpoints.push(endpointUrl); }
  async disconnect() { this.disconnectCalls++; }
  async browse() { if (this.failBrowse) throw new Error('browse failed'); return this.browseResult; }
  async read() { if (this.failRead) throw new Error('read failed'); return this.readResult; }
  async write() { if (this.failWrite) throw new Error('write failed'); }
  async subscribe(nodeIds: string[], samplingInterval: number) { this.subscribed.push({ nodeIds, samplingInterval }); return this.subscription; }
  async call() { if (this.failCall) throw new Error('call failed'); return this.callResult; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== handler); }; }
  emitError(err: Error) { for (const h of this.errorHandlers) h(err); }
}

function makeRuntime(proof?: { createProof: jest.Mock }) {
  return { deviceId: 'd1', capabilities: {}, ports: { proof } } as unknown as EdgeRuntime;
}

function makeProof() {
  return { createProof: jest.fn(async () => ({ ok: true, data: { proofId: 'p1', proof: {} } })) };
}

describe('edge-opcua gateway', () => {
  it('start connects and subscribes to configured nodes', async () => {
    const transport = new MockOpcuaTransport();
    const gw = createOpcuaGateway({
      runtime: makeRuntime(),
      transport,
      endpointUrl: 'opc.tcp://plc1:4840',
      subscriptions: [{ nodeId: 'ns=2;s=Temp', sensorId: 'temp1', samplingInterval: 500 }],
    });
    expect(gw.status).toBe('stopped');
    await gw.start();
    expect(transport.endpoints).toEqual(['opc.tcp://plc1:4840']);
    expect(transport.subscribed).toEqual([{ nodeIds: ['ns=2;s=Temp'], samplingInterval: 500 }]);
    expect(gw.status).toBe('running');
    await gw.stop();
    expect(transport.subscription.destroyed).toBe(true);
    expect(transport.disconnectCalls).toBe(1);
    expect(gw.status).toBe('stopped');
  });

  it('start skips subscription when none configured', async () => {
    const transport = new MockOpcuaTransport();
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    await gw.start();
    expect(transport.subscribed).toHaveLength(0);
    await gw.stop();
  });

  it('start propagates connect failures', async () => {
    const transport = new MockOpcuaTransport();
    transport.failConnect = true;
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    await expect(gw.start()).rejects.toThrow('connect failed');
  });

  it('maps subscription changes to sensor proofs for matching bindings', async () => {
    const transport = new MockOpcuaTransport();
    const proof = makeProof();
    const gw = createOpcuaGateway({
      runtime: makeRuntime(proof),
      transport,
      endpointUrl: 'opc.tcp://plc1:4840',
      subscriptions: [
        { nodeId: 'ns=2;s=Temp', sensorId: 'temp1', samplingInterval: 500 },
        { nodeId: 'ns=2;s=Other', sensorId: 'other', samplingInterval: 500 },
      ],
    });
    await gw.start();
    transport.subscription.emit([
      { nodeId: 'ns=2;s=Temp', value: { value: 24.4, dataType: 'Double', sourceTimestamp: 1000 }, receivedAt: 2000 },
    ]);
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', nodeId: 'ns=2;s=Temp', value: 24.4, dataType: 'Double', sourceTimestamp: 1000 })],
    }));
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await gw.stop();
  });

  it('ignores subscription changes for nodes without a sensor binding', async () => {
    const transport = new MockOpcuaTransport();
    const proof = makeProof();
    const gw = createOpcuaGateway({
      runtime: makeRuntime(proof),
      transport,
      endpointUrl: 'opc.tcp://plc1:4840',
      subscriptions: [{ nodeId: 'ns=2;s=A', sensorId: 'a1', samplingInterval: 500 }],
    });
    await gw.start();
    transport.subscription.emit([
      { nodeId: 'ns=2;s=Unbound', value: { value: 1, dataType: 'Int32' }, receivedAt: 1 },
    ]);
    expect(proof.createProof).not.toHaveBeenCalled();
    await gw.stop();
  });

  it('browse returns nodes on success and maps failures', async () => {
    const transport = new MockOpcuaTransport();
    transport.browseResult = [{ nodeId: 'ns=0;i=85', browseName: 'Objects', displayName: 'Objects', nodeClass: 'Object' }];
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    const ok = await gw.browse('ns=0;i=85');
    expect(ok).toEqual({ ok: true, data: { nodes: transport.browseResult } });

    const failing = new MockOpcuaTransport();
    failing.failBrowse = true;
    const gwFail = createOpcuaGateway({ runtime: makeRuntime(), transport: failing, endpointUrl: 'opc.tcp://plc1:4840' });
    expect(await gwFail.browse('ns=0;i=85')).toEqual({ ok: false, error: 'Error: browse failed' });
  });

  it('read returns the value and maps failures', async () => {
    const transport = new MockOpcuaTransport();
    transport.readResult = { value: 99, dataType: 'Double' };
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    expect(await gw.read('ns=2;s=Temp')).toEqual({ ok: true, data: { value: { value: 99, dataType: 'Double' } } });

    const failing = new MockOpcuaTransport();
    failing.failRead = true;
    const gwFail = createOpcuaGateway({ runtime: makeRuntime(), transport: failing, endpointUrl: 'opc.tcp://plc1:4840' });
    expect(await gwFail.read('ns=2;s=Temp')).toEqual({ ok: false, error: 'Error: read failed' });
  });

  it('write maps success and failures', async () => {
    const transport = new MockOpcuaTransport();
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    expect(await gw.write('ns=2;s=Valve', { value: true, dataType: 'Boolean' })).toEqual({ ok: true });

    const failing = new MockOpcuaTransport();
    failing.failWrite = true;
    const gwFail = createOpcuaGateway({ runtime: makeRuntime(), transport: failing, endpointUrl: 'opc.tcp://plc1:4840' });
    expect(await gwFail.write('ns=2;s=Valve', { value: true, dataType: 'Boolean' })).toEqual({ ok: false, error: 'Error: write failed' });
  });

  it('call returns method results and maps failures', async () => {
    const transport = new MockOpcuaTransport();
    transport.callResult = [{ value: 42, dataType: 'Int32' }];
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    const res = await gw.call('ns=2;s=Ctrl', 'ns=2;s=Reset', [{ value: 1, dataType: 'Int32' }]);
    expect(res).toEqual({ ok: true, data: { results: [{ value: 42, dataType: 'Int32' }] } });

    const failing = new MockOpcuaTransport();
    failing.failCall = true;
    const gwFail = createOpcuaGateway({ runtime: makeRuntime(), transport: failing, endpointUrl: 'opc.tcp://plc1:4840' });
    expect(await gwFail.call('ns=2;s=Ctrl', 'ns=2;s=Reset', [])).toEqual({ ok: false, error: 'Error: call failed' });
  });

  it('transport errors flip status to error', async () => {
    const transport = new MockOpcuaTransport();
    const gw = createOpcuaGateway({ runtime: makeRuntime(), transport, endpointUrl: 'opc.tcp://plc1:4840' });
    await gw.start();
    transport.emitError(new Error('session lost'));
    expect(gw.status).toBe('error');
    await gw.stop();
  });
});

describe('edge-opcua sensor bridge', () => {
  it('poll reads nodes and creates proofs', async () => {
    const transport = new MockOpcuaTransport();
    transport.readResult = { value: 18.2, dataType: 'Double', sourceTimestamp: 1234 };
    const proof = makeProof();
    const bridge = createOpcuaSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', nodeId: 'ns=2;s=Temp', intervalMs: 5000, dataType: 'Double', unit: 'degC' }],
    });
    await bridge.poll();
    expect(proof.createProof).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'sensor:temp1',
      claims: [expect.objectContaining({ sensorId: 'temp1', nodeId: 'ns=2;s=Temp', value: 18.2, dataType: 'Double', unit: 'degC', sourceTimestamp: 1234 })],
    }));
  });

  it('poll is non-fatal when the read fails', async () => {
    const transport = new MockOpcuaTransport();
    transport.failRead = true;
    const bridge = createOpcuaSensorBridge({
      runtime: makeRuntime(),
      transport,
      bindings: [{ sensorId: 'temp1', nodeId: 'ns=2;s=Temp', intervalMs: 5000, dataType: 'Double' }],
    });
    await expect(bridge.poll()).resolves.toBeUndefined();
  });

  it('start schedules periodic polls and stop clears them', async () => {
    jest.useFakeTimers();
    const transport = new MockOpcuaTransport();
    const proof = makeProof();
    const bridge = createOpcuaSensorBridge({
      runtime: makeRuntime(proof),
      transport,
      bindings: [{ sensorId: 'temp1', nodeId: 'ns=2;s=Temp', intervalMs: 1000, dataType: 'Double' }],
    });
    const startPromise = bridge.start();
    await jest.advanceTimersByTimeAsync(0);
    await startPromise;
    expect(proof.createProof).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(proof.createProof).toHaveBeenCalledTimes(2);
    await bridge.stop();
    jest.useRealTimers();
  });
});
import { createOcppGateway } from '../gateway.js';
import { createOcppSensorBridge } from '../sensor-bridge.js';
import { encodeCall, encodeCallError, encodeCallResult, OcppError, parseOcppFrame } from '../ocpp.js';
import type { OcppTransportPort } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockOcppTransport implements OcppTransportPort {
  sent: string[] = [];
  handlers: Array<(message: string) => void> = [];
  closeHandlers: Array<() => void> = [];
  errorHandlers: Array<(error: Error) => void> = [];
  state: 'closed' | 'connecting' | 'open' = 'closed';

  async connect() { this.state = 'open'; }
  async close() { this.state = 'closed'; }
  async send(message: string) { this.sent.push(message); }
  onMessage(handler: (message: string) => void) { this.handlers.push(handler); return () => {}; }
  onClose(handler: () => void) { this.closeHandlers.push(handler); return () => {}; }
  onError(handler: (error: Error) => void) { this.errorHandlers.push(handler); return () => {}; }
  emit(message: string) { for (const handler of this.handlers) handler(message); }
}

function makeRuntime(proofs: Array<Record<string, unknown>> = []) {
  return {
    deviceId: 'ocpp-1',
    capabilities: {},
    ports: { proof: { async createProof(proof: Record<string, unknown>) { proofs.push(proof); return { ok: true }; } } },
  } as unknown as EdgeRuntime;
}

describe('OCPP gateway', () => {
  it('connects, boots, correlates calls and stops', async () => {
    const transport = new MockOcppTransport();
    const gateway = createOcppGateway({
      runtime: makeRuntime(), transport, url: 'ws://csms', chargePointId: 'CP1',
      heartbeatIntervalMs: 0,
    });
    const started = gateway.start();
    await Promise.resolve();
    const boot = parseOcppFrame(transport.sent[0]);
    expect(boot.type).toBe(2);
    if (boot.type !== 2) throw new Error('expected CALL');
    expect(boot.action).toBe('BootNotification');
    transport.emit(encodeCallResult(boot.messageId, { status: 'Accepted' }));
    await started;
    expect(gateway.status).toBe('running');

    const pending = gateway.call('Authorize', { idTag: 'tag-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const call = parseOcppFrame(transport.sent[1]);
    if (call.type !== 2) throw new Error('expected CALL');
    transport.emit(encodeCallResult(call.messageId, { idTagInfo: { status: 'Accepted' } }));
    const result = await pending;
    expect(result.ok).toBe(true);

    await gateway.stop();
    expect(transport.state).toBe('closed');
    expect(gateway.status).toBe('stopped');
  });

  it('maps CALLERROR to an error result with the OCPP code', async () => {
    const transport = new MockOcppTransport();
    const gateway = createOcppGateway({
      runtime: makeRuntime(), transport, url: 'ws://csms', chargePointId: 'CP1',
      bootOnStart: false, heartbeatIntervalMs: 0,
    });
    await gateway.start();
    const pending = gateway.call('RemoteStartTransaction', { idTag: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const call = parseOcppFrame(transport.sent[0]);
    if (call.type !== 2) throw new Error('expected CALL');
    transport.emit(encodeCallError(call.messageId, 'SecurityError', 'denied', { reason: 'auth' }));
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('SecurityError');
    await gateway.stop();
  });

  it('dispatches inbound calls and returns NotSupported without a handler', async () => {
    const transport = new MockOcppTransport();
    const gateway = createOcppGateway({
      runtime: makeRuntime(), transport, url: 'ws://csms', chargePointId: 'CP1',
      bootOnStart: false, heartbeatIntervalMs: 0,
    });
    await gateway.start();

    const unsubscribe = gateway.onCall('RemoteStartTransaction', async (payload) => {
      if (payload.idTag !== 'valid') throw new OcppError('SecurityError', 'unknown tag');
      return { status: 'Accepted' };
    });
    transport.emit(encodeCall('csms-1', 'RemoteStartTransaction', { idTag: 'valid' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const accepted = parseOcppFrame(transport.sent[0]);
    expect(accepted.type).toBe(3);

    transport.emit(encodeCall('csms-2', 'RemoteStartTransaction', { idTag: 'bad' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const rejected = parseOcppFrame(transport.sent[1]);
    expect(rejected.type).toBe(4);
    if (rejected.type === 4) expect(rejected.errorCode).toBe('SecurityError');

    transport.emit(encodeCall('csms-3', 'Reset', { type: 'Soft' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const notSupported = parseOcppFrame(transport.sent[2]);
    expect(notSupported.type).toBe(4);
    if (notSupported.type === 4) expect(notSupported.errorCode).toBe('NotSupported');

    unsubscribe();
    await gateway.stop();
  });

  it('times out an unanswered call', async () => {
    const transport = new MockOcppTransport();
    const gateway = createOcppGateway({
      runtime: makeRuntime(), transport, url: 'ws://csms', chargePointId: 'CP1',
      bootOnStart: false, heartbeatIntervalMs: 0, callTimeoutMs: 10,
    });
    await gateway.start();
    const result = await gateway.call('Heartbeat', {});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out/);
    await gateway.stop();
  });

  it('rejects boot failures and marks the gateway error', async () => {
    const transport = new MockOcppTransport();
    const gateway = createOcppGateway({
      runtime: makeRuntime(), transport, url: 'ws://csms', chargePointId: 'CP1',
      heartbeatIntervalMs: 0,
    });
    const started = gateway.start();
    await Promise.resolve();
    const boot = parseOcppFrame(transport.sent[0]);
    if (boot.type !== 2) throw new Error('expected CALL');
    transport.emit(encodeCallResult(boot.messageId, { status: 'Rejected' }));
    await expect(started).rejects.toThrow(/boot rejected/);
    expect(gateway.status).toBe('error');
  });
});

describe('OCPP sensor bridge', () => {
  it('publishes meter values and creates proofs', async () => {
    const proofs: Array<Record<string, unknown>> = [];
    const gateway = { call: jest.fn(async () => ({ ok: true, data: { payload: {} } })) };
    const bridge = createOcppSensorBridge({
      runtime: makeRuntime(proofs),
      gateway: gateway as never,
      bindings: [{
        sensorId: 'meter-1', connectorId: 1, intervalMs: 60_000,
        read: async () => [{ value: 12.5, unit: 'kWh', measurand: 'Energy.Active.Import.Register', transactionId: 7 }],
      }],
    });
    await bridge.poll();
    expect(proofs[0].subject).toBe('sensor:meter-1');
    const claim = (proofs[0].claims as Array<Record<string, unknown>>)[0];
    expect(claim.value).toBe(12.5);
    expect(claim.connectorId).toBe(1);
    expect(gateway.call).toHaveBeenCalledWith('MeterValues', expect.objectContaining({
      connectorId: 1, transactionId: 7,
    }));
    await bridge.stop();
  });
});

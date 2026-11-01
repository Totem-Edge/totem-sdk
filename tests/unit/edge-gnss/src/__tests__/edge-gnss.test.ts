import { createGnssGateway } from '../gateway.js';
import { createGnssSensorBridge } from '../sensor-bridge.js';
import type { GnssFix, GnssTransportPort } from '../transport.js';
import type { EdgeRuntime } from '@totemsdk/edge';

class MockGnssTransport implements GnssTransportPort {
  started = 0;
  stopped = 0;
  fixes: GnssFix[] = [];
  fixHandlers: Array<(fix: GnssFix) => void> = [];
  errorHandlers: Array<(err: Error) => void> = [];

  async start() { this.started++; }
  async stop() { this.stopped++; }
  async getFix() { return this.fixes[0] ?? null; }
  onFix(handler: (fix: GnssFix) => void) { this.fixHandlers.push(handler); return () => { this.fixHandlers = this.fixHandlers.filter((h) => h !== handler); }; }
  onError(handler: (err: Error) => void) { this.errorHandlers.push(handler); return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); }; }
  emit(fix: GnssFix) { for (const handler of this.fixHandlers) handler(fix); }
  emitError(err: Error) { for (const handler of this.errorHandlers) handler(err); }
}

function fix(overrides: Partial<GnssFix> = {}): GnssFix {
  return {
    lat: 48.1173,
    lon: 11.5167,
    altitudeM: 545.4,
    speedMps: 11.5,
    headingDeg: 84.4,
    hdop: 0.9,
    satellitesUsed: 8,
    fixType: '3d',
    source: 'gps',
    observedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeRuntime(proofs: Array<Record<string, unknown>>) {
  return {
    deviceId: 'gnss-1',
    capabilities: {},
    ports: { proof: { async createProof(proof: Record<string, unknown>) { proofs.push(proof); return { ok: true }; } } },
  } as unknown as EdgeRuntime;
}

describe('GNSS gateway', () => {
  it('starts, signs valid fixes and stops idempotently', async () => {
    const transport = new MockGnssTransport();
    const proofs: Array<Record<string, unknown>> = [];
    const gateway = createGnssGateway({ runtime: makeRuntime(proofs), transport });
    await gateway.start();
    expect(transport.started).toBe(1);
    expect(gateway.status).toBe('running');

    transport.emit(fix());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(proofs[0]).toMatchObject({ subject: 'gnss:gps' });
    const claim = (proofs[0].claims as Array<Record<string, unknown>>)[0];
    expect(claim.lat).toBe(48.1173);
    expect(claim.timestamp).toBe(1_700_000_000_000);
    expect(claim.raw).toBeUndefined();

    await gateway.stop();
    expect(transport.stopped).toBe(1);
    expect(gateway.status).toBe('stopped');
    await gateway.stop();
  });

  it('never signs invalid or no-fix observations', async () => {
    const transport = new MockGnssTransport();
    const proofs: Array<Record<string, unknown>> = [];
    const gateway = createGnssGateway({ runtime: makeRuntime(proofs), transport });
    await gateway.start();
    transport.emit(fix({ lat: 100 }));
    transport.emit(fix({ lon: -200 }));
    transport.emit(fix({ fixType: 'none' }));
    transport.emit(fix({ observedAt: Number.NaN }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(proofs).toHaveLength(0);
    await gateway.stop();
  });

  it('returns valid fixes and explicit failures', async () => {
    const transport = new MockGnssTransport();
    const gateway = createGnssGateway({ runtime: makeRuntime([]), transport });
    const missing = await gateway.getFix();
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/no GNSS fix/);

    transport.fixes.push(fix());
    const valid = await gateway.getFix();
    expect(valid.ok).toBe(true);
    expect((valid as { data: { fix: GnssFix } }).data.fix.lat).toBe(48.1173);

    transport.fixes[0] = fix({ lat: 200 });
    const invalid = await gateway.getFix();
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toMatch(/invalid GNSS fix/);
  });

  it('flips status on receiver errors and recovers on the next valid fix', async () => {
    const transport = new MockGnssTransport();
    const proofs: Array<Record<string, unknown>> = [];
    const gateway = createGnssGateway({ runtime: makeRuntime(proofs), transport });
    await gateway.start();
    transport.emitError(new Error('receiver unplugged'));
    expect(gateway.status).toBe('error');
    transport.emit(fix());
    expect(gateway.status).toBe('running');
    await gateway.stop();
  });
});

describe('GNSS sensor bridge', () => {
  it('polls fixes into sensor proofs and ignores missing fixes', async () => {
    const transport = new MockGnssTransport();
    const proofs: Array<Record<string, unknown>> = [];
    const bridge = createGnssSensorBridge({
      runtime: makeRuntime(proofs),
      transport,
      bindings: [{ sensorId: 'rover', intervalMs: 1000, dataType: 'position', unit: 'wgs84' }],
    });

    await bridge.poll();
    expect(proofs).toHaveLength(0);

    transport.fixes.push(fix());
    await bridge.poll();
    expect(proofs).toHaveLength(1);
    expect(proofs[0].subject).toBe('sensor:rover');
    const claim = (proofs[0].claims as Array<Record<string, unknown>>)[0];
    expect(claim.lat).toBe(48.1173);
    expect(claim.unit).toBe('wgs84');
  });
});

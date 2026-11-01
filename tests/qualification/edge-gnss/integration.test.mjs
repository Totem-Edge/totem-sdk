import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGnssGateway } from '../../../packages/edge-gnss/dist/gateway.js';
import { createGnssSensorBridge } from '../../../packages/edge-gnss/dist/sensor-bridge.js';
import { parseNmeaFix } from '../../../packages/edge-gnss/dist/nmea.js';

class SimulatedGnss {
  started = 0;
  stopped = 0;
  fix;
  fixHandlers = [];
  errorHandlers = [];

  async start() { this.started++; }
  async stop() { this.stopped++; }
  async getFix() { return this.fix ?? null; }
  onFix(handler) { this.fixHandlers.push(handler); return () => {}; }
  onError(handler) { this.errorHandlers.push(handler); return () => {}; }
  emit(fix) { for (const handler of this.fixHandlers) handler(fix); }
  emitError(error) { for (const handler of this.errorHandlers) handler(error); }
}

function runtime(proofs) {
  return {
    deviceId: 'gnss-integration',
    capabilities: {},
    ports: { proof: { async createProof(proof) { proofs.push(proof); return { ok: true }; } } },
  };
}

const GGA = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
const RMC = '$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A';
const GSA = '$GPGSA,A,3,04,05,,09,12,,,24,,,,,2.5,1.3,2.1*39';

test('GNSS gateway and bridge sign NMEA-derived fixes and reject invalid observations', async () => {
  const transport = new SimulatedGnss();
  const proofs = [];
  const gateway = createGnssGateway({ runtime: runtime(proofs), transport });

  await gateway.start();
  assert.equal(transport.started, 1);
  assert.equal(gateway.status, 'running');

  const fix = parseNmeaFix([GGA, RMC, GSA], { source: 'rtk', now: 1_700_000_000_000 });
  assert.ok(fix);
  transport.emit(fix);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const gnssProof = proofs.find((proof) => proof.subject === 'gnss:rtk');
  assert.ok(gnssProof);
  assert.equal(gnssProof.claims[0].fixType, '3d');
  assert.equal(gnssProof.claims[0].satellitesUsed, 8);

  transport.emit({ ...fix, lat: 200 });
  transport.emit({ ...fix, fixType: 'none' });
  transport.emit({ ...fix, observedAt: Number.NaN });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(proofs.filter((proof) => proof.subject === 'gnss:rtk').length, 1);

  transport.fix = fix;
  const current = await gateway.getFix();
  assert.equal(current.ok, true);
  assert.equal(current.data.fix.lat, fix.lat);

  const bridge = createGnssSensorBridge({
    runtime: runtime(proofs),
    transport,
    bindings: [{ sensorId: 'rover', intervalMs: 60_000, dataType: 'position' }],
  });
  await bridge.poll();
  assert.ok(proofs.some((proof) => proof.subject === 'sensor:rover' && proof.claims[0].lat === fix.lat));
  await bridge.stop();

  transport.emitError(new Error('antenna disconnected'));
  assert.equal(gateway.status, 'error');
  transport.emit(fix);
  assert.equal(gateway.status, 'running');

  await gateway.stop();
  assert.equal(transport.stopped, 1);
  assert.equal(gateway.status, 'stopped');
  await gateway.stop();
});

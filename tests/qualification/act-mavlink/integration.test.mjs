import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMavlinkDefinitions } from '../../../packages/act-mavlink/dist/adapter.js';
import { runMavlinkConformance } from '../../../packages/act-mavlink/dist/conformance.js';
import { envelopeDigest, validateMissionEnvelope } from '../../../packages/act-mavlink/dist/envelope.js';
import { createMavlinkProfile } from '../../../packages/act-mavlink/dist/profile.js';
import { runProfileConformance } from '../../../packages/act-core/dist/index.js';
import { readFileSync } from 'node:fs';
import { init } from '../../../packages/core/dist/index.js';

// hashCanonical uses the async WASM kernel in the ESM build; initialize it
// before hashing (same pattern as the MQTT signing qualification).
const coreGlue = new URL('../../../packages/core-wasm/pkg-web/totemsdk_core_wasm.js', import.meta.url);
await init({
  module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', coreGlue)),
});

const vehicle = {
  vehicleId: 'DRONE-1',
  maxSpeedMetresPerSecond: '15',
  maxAltitudeMetres: '120',
  maxDurationSeconds: '1800',
  systemId: 1,
  componentId: 1,
};

const envelope = {
  envelopeId: 'survey-1',
  vehicle: 'DRONE-1',
  waypoints: [
    { latitudeDeg: 51.5, longitudeDeg: -0.12, altitudeMetres: 30 },
    { latitudeDeg: 51.501, longitudeDeg: -0.121, altitudeMetres: 40 },
  ],
  maxAltitudeMetres: '120',
  maxSpeedMetresPerSecond: '12',
  maxDurationSeconds: '900',
  geofence: { latitudeDeg: 51.5, longitudeDeg: -0.12, radiusMetres: 1000 },
};

class SimulatedAutopilot {
  missionId = 'mission-1';
  uploadedDigest;
  started = [];
  holds = 0;
  returns = 0;
  landings = 0;
  telemetry = {
    timestamp: '2026-11-02T10:00:00.000Z',
    latitudeDeg: 51.49,
    longitudeDeg: -0.13,
    altitudeMetres: 0,
    groundspeedMetresPerSecond: 8,
    armed: true,
  };

  async uploadMission(request) {
    this.uploadedDigest = request.envelopeDigest;
    return { missionId: this.missionId };
  }

  async startMission(request) {
    if (request.envelopeDigest !== this.uploadedDigest) {
      throw new Error('start does not match the uploaded plan');
    }
    this.started.push(request);
  }

  async hold() {
    this.holds += 1;
    this.telemetry = { ...this.telemetry, groundspeedMetresPerSecond: 0 };
  }

  async returnToLaunch() {
    this.returns += 1;
  }

  async land() {
    this.landings += 1;
    this.telemetry = { ...this.telemetry, armed: false };
  }

  async readTelemetry() {
    return this.telemetry;
  }
}

function paramsFor(target) {
  return {
    envelopeId: target.envelopeId,
    vehicle: target.vehicle,
    waypoints: target.waypoints,
    maxAltitudeMetres: { value: Number(target.maxAltitudeMetres), unit: 'm' },
    maxSpeedMetresPerSecond: { value: Number(target.maxSpeedMetresPerSecond), unit: 'm/s' },
    maxDurationSeconds: { value: Number(target.maxDurationSeconds), unit: 's' },
    geofenceLatitudeDeg: target.geofence.latitudeDeg,
    geofenceLongitudeDeg: target.geofence.longitudeDeg,
    geofenceRadiusMetres: target.geofence.radiusMetres,
  };
}

async function prepared(def, params) {
  const operation = await def.prepare(params, {});
  return {
    kind: def.kind,
    ...operation,
    definitionVersion: 1,
    schemaHash: 'schema',
    preparedCommandHash: 'hash',
    parameters: params,
    context: {},
    commitmentHash: 'commitment',
    operationId: 'op-integration',
  };
}

test('mission upload -> start -> accepted -> observed arrival', async () => {
  const transport = new SimulatedAutopilot();
  const defs = createMavlinkDefinitions({ transport, site: 'site-1', vehicles: [vehicle] });
  const upload = defs.find((def) => def.kind === 'flight:uploadMission');
  const start = defs.find((def) => def.kind === 'flight:startMission');
  assert.ok(upload && start);

  const uploaded = await upload.actuate(await prepared(upload, paramsFor(envelope)));
  assert.equal(uploaded.ok, true);
  assert.equal(uploaded.data.missionId, 'mission-1');
  assert.equal(uploaded.data.envelopeDigest, envelopeDigest(envelope));

  const op = await prepared(start, {
    ...paramsFor(envelope),
    missionId: 'mission-1',
    envelopeDigest: envelopeDigest(envelope),
  });
  assert.equal((await start.actuate(op)).ok, true);
  assert.equal(start.async.confirmation, 'accepted');

  const enRoute = await start.async.reconcile(op, {
    operationId: op.operationId,
    status: 'accepted',
    attempts: 1,
    updatedAt: Date.now(),
  });
  assert.equal(enRoute.status, 'running');

  const final = envelope.waypoints.at(-1);
  transport.telemetry = {
    ...transport.telemetry,
    latitudeDeg: final.latitudeDeg,
    longitudeDeg: final.longitudeDeg,
    altitudeMetres: final.altitudeMetres,
    groundspeedMetresPerSecond: 0,
  };
  const arrived = await start.async.reconcile(op, {
    operationId: op.operationId,
    status: 'running',
    attempts: 1,
    updatedAt: Date.now(),
  });
  assert.equal(arrived.status, 'confirmed');
});

test('a start that references a different plan fails closed', async () => {
  const transport = new SimulatedAutopilot();
  const start = createMavlinkDefinitions({ transport, site: 'site-1', vehicles: [vehicle] })
    .find((def) => def.kind === 'flight:startMission');
  await assert.rejects(
    start.prepare(
      { ...paramsFor(envelope), missionId: 'mission-1', envelopeDigest: 'tampered' },
      {},
    ),
    /digest mismatch/,
  );
});

test('the mission envelope rejects out-of-geofence and over-ceiling plans', () => {
  const outside = validateMissionEnvelope({
    ...envelope,
    waypoints: [{ latitudeDeg: 52.5, longitudeDeg: -0.12, altitudeMetres: 30 }],
  });
  assert.ok(outside.some((issue) => issue.includes('geofence')));

  const tooHigh = validateMissionEnvelope({
    ...envelope,
    waypoints: [{ latitudeDeg: 51.5, longitudeDeg: -0.12, altitudeMetres: 150 }],
  });
  assert.ok(tooHigh.some((issue) => issue.includes('ceiling')));
});

test('cancel holds and returns to launch', async () => {
  const transport = new SimulatedAutopilot();
  const start = createMavlinkDefinitions({ transport, site: 'site-1', vehicles: [vehicle] })
    .find((def) => def.kind === 'flight:startMission');
  await start.async.cancel(
    await prepared(start, {
      ...paramsFor(envelope),
      missionId: 'mission-1',
      envelopeDigest: envelopeDigest(envelope),
    }),
    { operationId: 'op', status: 'accepted', attempts: 1, updatedAt: Date.now() },
  );
  assert.equal(transport.holds, 1);
  assert.equal(transport.returns, 1);
});

test('profile conformance and autopilot conformance pass', async () => {
  const profile = createMavlinkProfile({ site: 'site-1', vehicles: [vehicle] });
  assert.deepEqual(runProfileConformance(profile).issues, []);

  const report = await runMavlinkConformance(new SimulatedAutopilot(), {
    site: 'site-1',
    vehicles: [vehicle],
    envelope,
  });
  assert.deepEqual(report.checks.filter((check) => !check.ok), []);
  assert.equal(report.ok, true);
});

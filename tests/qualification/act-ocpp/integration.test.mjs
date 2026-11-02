import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOcppDefinitions } from '../../../packages/act-ocpp/dist/adapter.js';
import { createOcppProfile } from '../../../packages/act-ocpp/dist/profile.js';
import { negotiateOcppCapabilities } from '../../../packages/act-ocpp/dist/capabilities.js';
import { runProfileConformance } from '../../../packages/act-core/dist/index.js';
import { readFileSync } from 'node:fs';
import { init } from '../../../packages/core/dist/index.js';

// hashCanonical uses the async WASM kernel in the ESM build; initialize it
// before hashing (same pattern as the MQTT signing qualification).
const coreGlue = new URL('../../../packages/core-wasm/pkg-web/totemsdk_core_wasm.js', import.meta.url);
await init({
  module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', coreGlue)),
});

const connector = {
  connectorId: 1,
  maxPowerWatts: '11000',
  maxEnergyWattHours: '22000',
  maxSessionSeconds: '7200',
  phases: 3,
  connectorType: 'Type2',
};

class SimulatedCsms {
  calls = [];
  transactionId = 42;
  state = { status: 'active', energyWattHours: '0' };
  meter = [];

  async remoteStartTransaction(request) {
    this.calls.push({ action: 'RemoteStartTransaction', request });
    return { status: 'Accepted', payload: { transactionId: this.transactionId } };
  }

  async remoteStopTransaction(request) {
    this.calls.push({ action: 'RemoteStopTransaction', request });
    this.state = { status: 'ended', energyWattHours: '6120' };
    return { status: 'Accepted' };
  }

  async setChargingProfile(request) {
    this.calls.push({ action: 'SetChargingProfile', request });
    return { status: 'Accepted' };
  }

  async clearChargingProfile(request) {
    this.calls.push({ action: 'ClearChargingProfile', request });
    return { status: 'Accepted' };
  }

  async reserveNow(request) {
    this.calls.push({ action: 'ReserveNow', request });
    return { status: 'Accepted' };
  }

  async readMeterValues() {
    return this.meter;
  }

  async readTransactionState() {
    return this.state;
  }

  async stopConnector() {
    this.state = { status: 'ended', energyWattHours: '0' };
    return { status: 'Accepted' };
  }
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

test('charging session runs the accepted -> running -> confirmed lifecycle', async () => {
  const transport = new SimulatedCsms();
  const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
  const start = defs.find((def) => def.kind === 'charging:startSession');
  assert.ok(start);

  const op = await prepared(start, {
    connectorId: 1,
    idTag: 'TAG-42',
    maxPowerWatts: { value: 11, unit: 'kW' },
    maxEnergyWattHours: { value: 22, unit: 'kWh' },
  });
  const accepted = await start.actuate(op);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.data.transactionId, 42);

  const running = await start.async.reconcile(op, {
    operationId: op.operationId,
    status: 'accepted',
    attempts: 1,
    updatedAt: Date.now(),
    result: accepted.data,
  });
  assert.equal(running.status, 'running');

  transport.meter = [
    {
      transactionId: 42,
      connectorId: 1,
      timestamp: '2026-11-02T10:00:00.000Z',
      energyWattHours: '6120',
      measurand: 'Energy.Active.Import.Register',
    },
  ];
  transport.state = { status: 'ended', energyWattHours: '6120' };

  const confirmed = await start.async.reconcile(op, {
    operationId: op.operationId,
    status: 'running',
    attempts: 1,
    updatedAt: Date.now(),
    result: accepted.data,
  });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.result.energyWattHours, '6120');
  assert.match(confirmed.result.digest, /^[0-9a-f]+$/);
});

test('governed start prepares canonical units and derives bounded effects', async () => {
  const transport = new SimulatedCsms();
  const start = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] })
    .find((def) => def.kind === 'charging:startSession');
  const op = await prepared(start, {
    connectorId: 1,
    idTag: 'TAG-42',
    maxPowerWatts: { value: 7.4, unit: 'kW' },
    maxEnergyWattHours: { value: 15, unit: 'kWh' },
    maxSessionSeconds: { value: 45, unit: 'min' },
  });
  assert.equal(op.command.maxPowerWatts, '7400');
  assert.equal(op.command.maxEnergyWattHours, '15000');
  assert.equal(op.command.maxSessionSeconds, '2700');

  const effects = start.deriveEffects(op);
  assert.deepEqual(effects.physical.power, [
    { resource: 'site-1/charging/EVSE-1/connector', watts: '7400' },
  ]);
  assert.equal(effects.physical.energy[0].wattHours, '15000');
  assert.equal(effects.physical.duration[0].seconds, '2700');
  assert.ok(effects.physical.envelopes[0].envelopeDigest);
});

test('profile conformance passes and capabilities gate the negotiated version', () => {
  const profile = createOcppProfile({ site: 'site-1', connectors: [connector] });
  const report = runProfileConformance(profile);
  assert.deepEqual(report.issues, []);

  const capabilities = negotiateOcppCapabilities({ offered: ['1.6J', '2.0.1'] });
  assert.equal(capabilities.version, '2.0.1');
  assert.ok(capabilities.profiles.includes('charging:reserveConnector'));
});

test('reservation and readback are governed operations', async () => {
  const transport = new SimulatedCsms();
  const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
  const reserve = defs.find((def) => def.kind === 'charging:reserveConnector');
  const read = defs.find((def) => def.kind === 'charging:readMeter');

  const reservation = await prepared(reserve, {
    connectorId: 1,
    idTag: 'TAG-42',
    reservationId: 9,
    expiresInSeconds: { value: 10, unit: 'min' },
  });
  assert.equal(reservation.command.expiresInSeconds, '600');
  assert.equal((await reserve.actuate(reservation)).ok, true);

  transport.meter = [
    {
      transactionId: 42,
      connectorId: 1,
      timestamp: '2026-11-02T10:00:00.000Z',
      energyWattHours: '900',
    },
  ];
  const readback = await read.actuate(await prepared(read, { connectorId: 1 }));
  assert.equal(readback.data.readings.length, 1);
  assert.equal(readback.data.readings[0].energyWattHours, '900');
});

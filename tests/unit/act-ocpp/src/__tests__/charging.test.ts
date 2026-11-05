/**
 * RFC-024 — governed OCPP charging profile.
 */

import {
  createInterlockRegistry,
  runProfileConformance,
  toEdgeActionDefinition,
  type IndustrialActionDefinition,
  type PreparedDeviceOp,
} from '@totemsdk/act-core';
import { createAgentEdgeRuntime, createCapabilitySet, createEdgeActionRegistry } from '@totemsdk/edge';
import type { GrantBoundAutonomyPolicy } from '@totemsdk/agent-policy';

import { createOcppDefinitions } from '../adapter.js';
import { negotiateOcppCapabilities, supportsOcppProfile } from '../capabilities.js';
import { deriveChargingEffects } from '../effects.js';
import { meterEvidenceDigest, reconcileChargingSession } from '../meter.js';
import { createOcppProfile, type ChargingConnector } from '../profile.js';
import type {
  OcppMeterValue,
  OcppResponse,
  OcppTransportPort,
  OcppTransactionState,
} from '../transport.js';

const connector: ChargingConnector = {
  connectorId: 1,
  maxPowerWatts: '11000',
  maxEnergyWattHours: '22000',
  maxSessionSeconds: '7200',
  phases: 3,
  connectorType: 'Type2',
};

class SimulatedCharger implements OcppTransportPort {
  calls: Array<{ action: string; request: unknown }> = [];
  transactionId = 7;
  ended = false;
  meter: OcppMeterValue[] = [];
  stopConnectorCalls: number[] = [];
  state: OcppTransactionState = { status: 'active', energyWattHours: '1500' };

  private record(action: string, request: unknown): void {
    this.calls.push({ action, request });
  }

  async remoteStartTransaction(request: Parameters<OcppTransportPort['remoteStartTransaction']>[0]): Promise<OcppResponse> {
    this.record('RemoteStartTransaction', request);
    return { status: 'Accepted', payload: { transactionId: this.transactionId } };
  }

  async remoteStopTransaction(request: Parameters<OcppTransportPort['remoteStopTransaction']>[0]): Promise<OcppResponse> {
    this.record('RemoteStopTransaction', request);
    this.state = { status: 'ended', energyWattHours: '4200' };
    return { status: 'Accepted' };
  }

  async setChargingProfile(request: Parameters<OcppTransportPort['setChargingProfile']>[0]): Promise<OcppResponse> {
    this.record('SetChargingProfile', request);
    return { status: 'Accepted' };
  }

  async clearChargingProfile(request: Parameters<OcppTransportPort['clearChargingProfile']>[0]): Promise<OcppResponse> {
    this.record('ClearChargingProfile', request);
    return { status: 'Accepted' };
  }

  async reserveNow(request: Parameters<OcppTransportPort['reserveNow']>[0]): Promise<OcppResponse> {
    this.record('ReserveNow', request);
    return { status: 'Accepted' };
  }

  async readMeterValues(): Promise<OcppMeterValue[]> {
    return this.meter;
  }

  async readTransactionState(): Promise<OcppTransactionState> {
    return this.state;
  }

  async stopConnector(connectorId: number): Promise<OcppResponse> {
    this.stopConnectorCalls.push(connectorId);
    this.state = { status: 'ended', energyWattHours: '0' };
    return { status: 'Accepted' };
  }
}

async function prepared(
  def: IndustrialActionDefinition,
  params: Record<string, unknown>,
): Promise<PreparedDeviceOp> {
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
    operationId: 'op-1',
  } as PreparedDeviceOp;
}

describe('OCPP capabilities (RFC-024 §5.8)', () => {
  it('negotiates the newest mutually supported version', () => {
    expect(negotiateOcppCapabilities({ offered: ['1.6J', '2.0.1', '2.1'] }).version).toBe('2.0.1');
    expect(negotiateOcppCapabilities({ offered: ['1.6J', '2.1'], supported: ['2.1'] }).version).toBe('2.1');
  });

  it('fails closed when nothing is mutually supported', () => {
    expect(() => negotiateOcppCapabilities({ offered: ['2.1'] })).toThrow(/no mutually supported OCPP version/);
  });

  it('gates an unnegotiated profile', () => {
    const capabilities = negotiateOcppCapabilities({ offered: ['1.6J'] });
    expect(supportsOcppProfile(capabilities, 'charging:startSession')).toBe(true);
    expect(supportsOcppProfile(capabilities, 'charging:bidirectional')).toBe(false);
  });
});

describe('OCPP profile (RFC-024 §5.4)', () => {
  it('passes profile conformance and declares a connector safe state', () => {
    const profile = createOcppProfile({ site: 'site-1', connectors: [connector] });
    const report = runProfileConformance(profile);
    expect(report.issues).toEqual([]);
    expect(profile.resources?.[0]?.safeState?.command).toEqual({
      action: 'charging:stopSession',
      connectorId: 1,
    });
  });

  it('rejects a request above the connector power ceiling', async () => {
    const profile = createOcppProfile({ site: 'site-1', connectors: [connector] });
    const interlocks = createInterlockRegistry();
    for (const interlock of profile.interlocks ?? []) interlocks.register(interlock);
    const failures = await interlocks.evaluate({
      parameters: { maxPowerWatts: 22000 },
      context: {},
      now: Date.now(),
      resourceId: { site: 'site-1', area: 'charging', asset: 'EVSE-1', point: 'connector' },
    });
    expect(failures.map((failure) => failure.interlockId)).toContain('ocpp:power-ceiling:1');
  });
});

describe('charging effects (RFC-024 §5.5)', () => {
  it('derives power, energy, duration and the profile envelope', () => {
    const effects = deriveChargingEffects({
      resource: 'site-1/charging/EVSE-1/connector',
      maxPowerWatts: '11000',
      maxEnergyWattHours: '22000',
      maxSessionSeconds: '7200',
      profileId: 'profile-1',
      profileDigest: 'digest',
    });
    expect(effects.physical?.power).toEqual([
      { resource: 'site-1/charging/EVSE-1/connector', watts: '11000' },
    ]);
    expect(effects.physical?.energy?.[0]?.wattHours).toBe('22000');
    expect(effects.physical?.duration?.[0]?.seconds).toBe('7200');
    expect(effects.physical?.envelopes).toEqual([
      { envelopeId: 'profile-1', envelopeDigest: 'digest' },
    ]);
  });
});

describe('governed operations (RFC-024 §5.3/§5.6)', () => {
  it('reports an accepted session start as dispatched and non-terminal', async () => {
    const transport = new SimulatedCharger();
    const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
    const start = defs.find((def) => def.kind === 'charging:startSession')!;
    const edge = toEdgeActionDefinition(start);

    expect(edge.executionMode).toBe('asynchronous');
    const op = await edge.prepare({
      action: 'charging:startSession',
      subject: 'site-1/charging/EVSE-1/connector',
      payload: {
        connectorId: 1,
        idTag: 'TAG-1',
        maxPowerWatts: { value: 11000, unit: 'W' },
      },
      context: {},
    });
    const result = await edge.execute(op);

    expect(result.ok).toBe(true);
    expect(result.dispatchState).toBe('dispatched');
    expect(result.phase).toBe('accepted');
    expect(result.terminalOutcome).toBeUndefined();
  });

  it('holds the accepted session start in AgentEdgeRuntime', async () => {
    const transport = new SimulatedCharger();
    const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
    const start = defs.find((def) => def.kind === 'charging:startSession')!;

    const commit = jest.fn();
    const abort = jest.fn();
    const policy = {
      authorizeAndReserve: async () => ({
        outcome: 'approved' as const,
        reservationId: 'res-1',
        actionDigest: 'digest-1',
        decisionIds: [],
        mandateIds: ['mandate-1'],
        usageDeltas: [],
        reservedAt: 1000,
        expiresAt: 2000,
      }),
      commit,
      abort,
    } as unknown as GrantBoundAutonomyPolicy;

    const registry = createEdgeActionRegistry();
    registry.register(toEdgeActionDefinition(start), 'charging:startSession');
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['industrial:action']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'principal-1',
      agentId: 'agent-1',
    });

    const result = await runtime.executeAction({
      action: 'charging:startSession',
      subject: 'site-1/charging/EVSE-1/connector',
      payload: {
        connectorId: 1,
        idTag: 'TAG-1',
        maxPowerWatts: { value: 11000, unit: 'W' },
      },
      context: {},
    });

    expect(result.ok).toBe(true);
    expect(result.dispatchState).toBe('dispatched');
    expect(result.phase).toBe('accepted');
    expect(commit).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });

  it('prepares a canonical start command and confirms only from the charger', async () => {
    const transport = new SimulatedCharger();
    const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
    const start = defs.find((def) => def.kind === 'charging:startSession')!;

    const op = await prepared(start, {
      connectorId: 1,
      idTag: 'TAG-1',
      maxPowerWatts: { value: 11, unit: 'kW' },
      maxEnergyWattHours: { value: 22, unit: 'kWh' },
      maxSessionSeconds: { value: 120, unit: 'min' },
    });
    expect(op.command).toMatchObject({
      action: 'RemoteStartTransaction',
      connectorId: 1,
      maxPowerWatts: '11000',
      maxEnergyWattHours: '22000',
      maxSessionSeconds: '7200',
    });
    expect(op.resourceId).toBe('site-1/charging/EVSE-1/connector');

    const effects = start.deriveEffects(op);
    expect(effects.physical?.power?.[0]?.watts).toBe('11000');

    const result = await start.actuate(op);
    expect(result.ok).toBe(true);
    expect((result.data as { transactionId: number }).transactionId).toBe(7);
    expect(start.async?.confirmation).toBe('accepted');

    const running = await start.async!.reconcile!(op, {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
      result: result.data,
    });
    expect(running.status).toBe('running');

    transport.state = { status: 'ended', energyWattHours: '4200' };
    transport.meter = [
      {
        transactionId: 7,
        connectorId: 1,
        timestamp: '2026-11-02T10:00:00.000Z',
        energyWattHours: '4200',
        measurand: 'Energy.Active.Import.Register',
      },
    ];
    const confirmed = await start.async!.reconcile!(op, {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
      result: result.data,
    });
    expect(confirmed.status).toBe('confirmed');
    expect((confirmed.result as { energyWattHours: string }).energyWattHours).toBe('4200');
  });

  it('stays unknown when the charger cannot be read', async () => {
    const transport = new SimulatedCharger();
    transport.state = { status: 'unknown' };
    const result = await reconcileChargingSession(transport, {
      operationId: 'op-2',
      connectorId: 1,
      transactionId: 99,
    });
    expect(result.status).toBe('unknown');
    expect(result.evidence).toBeUndefined();
  });

  it('cancels an accepted session by stopping the transaction', async () => {
    const transport = new SimulatedCharger();
    const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
    const start = defs.find((def) => def.kind === 'charging:startSession')!;
    const op = await prepared(start, {
      connectorId: 1,
      idTag: 'TAG-1',
      maxPowerWatts: { value: 11, unit: 'kW' },
    });
    const result = await start.actuate(op);
    await start.async!.cancel!(op, {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
      result: result.data,
    });
    expect(transport.calls.map((call) => call.action)).toContain('RemoteStopTransaction');
  });

  it('registers reservations with a bounded window', async () => {
    const transport = new SimulatedCharger();
    const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
    const reserve = defs.find((def) => def.kind === 'charging:reserveConnector')!;
    const op = await prepared(reserve, {
      connectorId: 1,
      idTag: 'TAG-1',
      reservationId: 5,
      expiresInSeconds: { value: 15, unit: 'min' },
    });
    expect(op.command).toMatchObject({ action: 'ReserveNow', expiresInSeconds: '900' });
    expect(reserve.deriveEffects(op).physical?.duration?.[0]?.seconds).toBe('900');
    expect(await reserve.actuate(op)).toMatchObject({ ok: true });
  });

  it('reads meter values as a governed read', async () => {
    const transport = new SimulatedCharger();
    transport.meter = [
      {
        transactionId: 7,
        connectorId: 1,
        timestamp: '2026-11-02T10:00:00.000Z',
        energyWattHours: '1234',
      },
    ];
    const defs = createOcppDefinitions({ transport, site: 'site-1', connectors: [connector] });
    const read = defs.find((def) => def.kind === 'charging:readMeter')!;
    const op = await prepared(read, { connectorId: 1 });
    const result = await read.actuate(op);
    expect((result.data as { readings: OcppMeterValue[] }).readings[0].energyWattHours).toBe('1234');
  });
});

describe('meter evidence (RFC-024 §5.7)', () => {
  it('digests readings independently of arrival order', () => {
    const base = {
      operationId: 'op-1',
      connectorId: 1,
      transactionId: 7,
      energyWattHours: '4200',
    };
    const first = {
      transactionId: 7,
      connectorId: 1,
      timestamp: '2026-11-02T10:00:00.000Z',
      energyWattHours: '1000',
    };
    const second = {
      transactionId: 7,
      connectorId: 1,
      timestamp: '2026-11-02T10:05:00.000Z',
      energyWattHours: '4200',
    };
    expect(meterEvidenceDigest({ ...base, readings: [first, second] })).toBe(
      meterEvidenceDigest({ ...base, readings: [second, first] }),
    );
  });
});

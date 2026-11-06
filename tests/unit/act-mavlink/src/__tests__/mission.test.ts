/**
 * RFC-025 — governed MAVLink mission profile.
 */

import { runProfileConformance, toEdgeActionDefinition, type IndustrialActionDefinition, type PreparedDeviceOp } from '@totemsdk/act-core';
import { createAgentEdgeRuntime, createCapabilitySet, createEdgeActionRegistry } from '@totemsdk/edge';
import type { GrantBoundAutonomyPolicy } from '@totemsdk/agent-policy';

import { createMavlinkDefinitions } from '../adapter.js';
import { runMavlinkConformance } from '../conformance.js';
import {
  distanceMetres,
  envelopeDigest,
  validateMissionEnvelope,
  type MissionEnvelope,
} from '../envelope.js';
import { createMavlinkProfile, type FlightVehicle } from '../profile.js';
import {
  MavlinkTransportError,
  type MavlinkTransportPort,
  type TelemetrySnapshot,
} from '../transport.js';

const vehicle: FlightVehicle = {
  vehicleId: 'DRONE-1',
  maxSpeedMetresPerSecond: '15',
  maxAltitudeMetres: '120',
  maxDurationSeconds: '1800',
  systemId: 1,
  componentId: 1,
};

const envelope: MissionEnvelope = {
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

class SimulatedAutopilot implements MavlinkTransportPort {
  missionId = 'mission-1';
  uploadedDigest?: string;
  started: Array<{ missionId: string; envelopeDigest: string }> = [];
  holds = 0;
  returns = 0;
  landings = 0;
  telemetry: TelemetrySnapshot = {
    timestamp: '2026-11-02T10:00:00.000Z',
    latitudeDeg: 51.49,
    longitudeDeg: -0.13,
    altitudeMetres: 0,
    groundspeedMetresPerSecond: 8,
    armed: true,
  };

  async uploadMission(request: { envelopeDigest: string }): Promise<{ missionId: string }> {
    this.uploadedDigest = request.envelopeDigest;
    return { missionId: this.missionId };
  }

  async startMission(request: { missionId: string; envelopeDigest: string }): Promise<void> {
    if (request.envelopeDigest !== this.uploadedDigest) {
      throw new MavlinkTransportError('EnvelopeMismatch', 'start does not match the uploaded plan');
    }
    this.started.push(request);
  }

  async hold(): Promise<void> {
    this.holds += 1;
    this.telemetry = { ...this.telemetry, groundspeedMetresPerSecond: 0 };
  }

  async returnToLaunch(): Promise<void> {
    this.returns += 1;
  }

  async land(): Promise<void> {
    this.landings += 1;
    this.telemetry = { ...this.telemetry, armed: false };
  }

  async readTelemetry(): Promise<TelemetrySnapshot> {
    return this.telemetry;
  }
}

function paramsFor(target: MissionEnvelope): Record<string, unknown> {
  return {
    envelopeId: target.envelopeId,
    vehicle: target.vehicle,
    waypoints: target.waypoints,
    maxAltitudeMetres: { value: Number(target.maxAltitudeMetres), unit: 'm' },
    maxSpeedMetresPerSecond: { value: Number(target.maxSpeedMetresPerSecond), unit: 'm/s' },
    maxDurationSeconds: { value: Number(target.maxDurationSeconds), unit: 's' },
    ...(target.geofence
      ? {
          geofenceLatitudeDeg: target.geofence.latitudeDeg,
          geofenceLongitudeDeg: target.geofence.longitudeDeg,
          geofenceRadiusMetres: target.geofence.radiusMetres,
        }
      : {}),
  };
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

function definitions(transport: SimulatedAutopilot): IndustrialActionDefinition[] {
  return createMavlinkDefinitions({ transport, site: 'site-1', vehicles: [vehicle] });
}

describe('mission envelope (RFC-025 §5.5)', () => {
  it('digests the plan deterministically and changes with the plan', () => {
    const digest = envelopeDigest(envelope);
    expect(envelopeDigest(envelope)).toBe(digest);
    expect(
      envelopeDigest({
        ...envelope,
        waypoints: [{ ...envelope.waypoints[0], altitudeMetres: 31 }],
      }),
    ).not.toBe(digest);
  });

  it('rejects an altitude above the envelope ceiling', () => {
    const issues = validateMissionEnvelope({
      ...envelope,
      waypoints: [{ latitudeDeg: 51.5, longitudeDeg: -0.12, altitudeMetres: 150 }],
    });
    expect(issues.join(' ')).toMatch(/exceeds the envelope ceiling/);
  });

  it('rejects a waypoint outside the geofence', () => {
    const issues = validateMissionEnvelope({
      ...envelope,
      waypoints: [{ latitudeDeg: 52.5, longitudeDeg: -0.12, altitudeMetres: 30 }],
    });
    expect(issues.join(' ')).toMatch(/from the geofence centre/);
  });

  it('measures distance approximately', () => {
    const metres = distanceMetres(
      { latitudeDeg: 51.5, longitudeDeg: -0.12, altitudeMetres: 0 },
      { latitudeDeg: 51.501, longitudeDeg: -0.12, altitudeMetres: 0 },
    );
    expect(metres).toBeGreaterThan(100);
    expect(metres).toBeLessThan(120);
  });
});

describe('flight profile (RFC-025 §5.4/§5.9)', () => {
  it('passes profile conformance with a return-to-launch safe state', () => {
    const profile = createMavlinkProfile({ site: 'site-1', vehicles: [vehicle] });
    expect(runProfileConformance(profile).issues).toEqual([]);
    expect(profile.resources?.[0]?.safeState?.command).toEqual({ action: 'flight:returnToLaunch' });
    expect(profile.resources?.[0]?.addresses[0]?.endpoint).toBe('system:1/component:1');
  });
});

describe('governed operations (RFC-025 §5.3/§5.6)', () => {
  it('uploads a mission and binds the authorized digest', async () => {
    const transport = new SimulatedAutopilot();
    const upload = definitions(transport).find((def) => def.kind === 'flight:uploadMission')!;
    const op = await prepared(upload, paramsFor(envelope));
    const result = await upload.actuate(op);
    expect(result.ok).toBe(true);
    expect((result.data as { missionId: string }).missionId).toBe('mission-1');
    expect(transport.uploadedDigest).toBe(envelopeDigest(envelope));
  });

  it('refuses a start whose envelope digest does not match', async () => {
    const transport = new SimulatedAutopilot();
    const start = definitions(transport).find((def) => def.kind === 'flight:startMission')!;
    await expect(
      start.prepare(
        { ...paramsFor(envelope), missionId: 'mission-1', envelopeDigest: 'not-the-digest' },
        {},
      ),
    ).rejects.toThrow(MavlinkTransportError);
  });

  it('reports an accepted flight start as dispatched and non-terminal', async () => {
    const transport = new SimulatedAutopilot();
    const defs = definitions(transport);
    const upload = defs.find((def) => def.kind === 'flight:uploadMission')!;
    const start = defs.find((def) => def.kind === 'flight:startMission')!;
    const uploadEdge = toEdgeActionDefinition(upload);
    const startEdge = toEdgeActionDefinition(start);

    expect(startEdge.executionMode).toBe('asynchronous');
    const uploadOp = await uploadEdge.prepare({
      action: 'flight:uploadMission',
      subject: 'DRONE-1',
      payload: paramsFor(envelope),
      context: {},
    });
    await uploadEdge.execute(uploadOp);

    const startOp = await startEdge.prepare({
      action: 'flight:startMission',
      subject: 'DRONE-1',
      payload: {
        ...paramsFor(envelope),
        missionId: 'mission-1',
        envelopeDigest: envelopeDigest(envelope),
      },
      context: {},
    });
    const result = await startEdge.execute(startOp);
    expect(result.ok).toBe(true);
    expect(result.dispatchState).toBe('dispatched');
    expect(result.phase).toBe('accepted');
    expect(result.terminalOutcome).toBeUndefined();
  });

  it('holds the accepted flight start in AgentEdgeRuntime', async () => {
    const transport = new SimulatedAutopilot();
    const defs = definitions(transport);
    const upload = defs.find((def) => def.kind === 'flight:uploadMission')!;
    const start = defs.find((def) => def.kind === 'flight:startMission')!;

    const uploadEdge = toEdgeActionDefinition(upload);
    await uploadEdge.execute(await uploadEdge.prepare({
      action: 'flight:uploadMission',
      subject: 'DRONE-1',
      payload: paramsFor(envelope),
      context: {},
    }));

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
    registry.register(toEdgeActionDefinition(start), 'flight:startMission');
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
      action: 'flight:startMission',
      subject: 'DRONE-1',
      payload: {
        ...paramsFor(envelope),
        missionId: 'mission-1',
        envelopeDigest: envelopeDigest(envelope),
      },
      context: {},
    });

    expect(result.ok).toBe(true);
    expect(result.dispatchState).toBe('dispatched');
    expect(result.phase).toBe('accepted');
    expect(commit).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });

  it('does not treat acceptance as completion', async () => {
    const transport = new SimulatedAutopilot();
    const defs = definitions(transport);
    const upload = defs.find((def) => def.kind === 'flight:uploadMission')!;
    const start = defs.find((def) => def.kind === 'flight:startMission')!;

    await upload.actuate(await prepared(upload, paramsFor(envelope)));
    const op = await prepared(start, {
      ...paramsFor(envelope),
      missionId: 'mission-1',
      envelopeDigest: envelopeDigest(envelope),
    });
    expect(await start.actuate(op)).toMatchObject({ ok: true });
    expect(start.async?.confirmation).toBe('accepted');

    const enRoute = await start.async!.reconcile!(op, {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
    });
    expect(enRoute.status).toBe('running');

    const final = envelope.waypoints.at(-1)!;
    transport.telemetry = {
      ...transport.telemetry,
      latitudeDeg: final.latitudeDeg,
      longitudeDeg: final.longitudeDeg,
      altitudeMetres: final.altitudeMetres,
      groundspeedMetresPerSecond: 0,
    };
    const arrived = await start.async!.reconcile!(op, {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
    });
    expect(arrived.status).toBe('confirmed');
  });

  it('cancels a mission with hold then return-to-launch', async () => {
    const transport = new SimulatedAutopilot();
    const start = definitions(transport).find((def) => def.kind === 'flight:startMission')!;
    await start.async!.cancel!(
      await prepared(start, {
        ...paramsFor(envelope),
        missionId: 'mission-1',
        envelopeDigest: envelopeDigest(envelope),
      }),
      { operationId: 'op-1', status: 'accepted', attempts: 1, updatedAt: Date.now() },
    );
    expect(transport.holds).toBe(1);
    expect(transport.returns).toBe(1);
  });

  it('confirms hold, return and land from telemetry', async () => {
    const transport = new SimulatedAutopilot();
    const defs = definitions(transport);
    const hold = defs.find((def) => def.kind === 'flight:hold')!;
    const rtl = defs.find((def) => def.kind === 'flight:returnToLaunch')!;
    const land = defs.find((def) => def.kind === 'flight:land')!;

    await hold.actuate(await prepared(hold, {}));
    expect((await hold.async!.reconcile!(await prepared(hold, {}), {
      operationId: 'op-1', status: 'accepted', attempts: 1, updatedAt: Date.now(),
    })).status).toBe('confirmed');

    await rtl.actuate(await prepared(rtl, {}));
    transport.telemetry = { ...transport.telemetry, missionFinished: true, groundspeedMetresPerSecond: 0 };
    expect((await rtl.async!.reconcile!(await prepared(rtl, {}), {
      operationId: 'op-1', status: 'accepted', attempts: 1, updatedAt: Date.now(),
    })).status).toBe('confirmed');

    await land.actuate(await prepared(land, {}));
    expect((await land.async!.reconcile!(await prepared(land, {}), {
      operationId: 'op-1', status: 'accepted', attempts: 1, updatedAt: Date.now(),
    })).status).toBe('confirmed');
  });
});

describe('autopilot conformance (RFC-025 §5.8)', () => {
  it('passes the harness against a conforming simulator', async () => {
    const transport = new SimulatedAutopilot();
    const report = await runMavlinkConformance(transport, {
      site: 'site-1',
      vehicles: [vehicle],
      envelope,
    });
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

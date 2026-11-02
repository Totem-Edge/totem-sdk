/**
 * RFC-025 §5.3 — governed MAVLink operations.
 *
 * `startMission` carries the authorized envelope digest; a start whose
 * recomputed digest differs from the authorized one fails closed before
 * dispatch. Acceptance is never completion: `startMission` reconciles through
 * vehicle telemetry and only reports `confirmed` on observed arrival.
 */

import {
  defaultUnitRegistry,
  resourceIdKey,
  type IndustrialActionDefinition,
  type ParameterSchema,
  type UnitRegistry,
} from '@totemsdk/act-core';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type { StepEffects } from '@totemsdk/agent-policy';

import { deriveFlightEffects } from './effects.js';
import {
  assertValidMissionEnvelope,
  distanceMetres,
  envelopeDigest,
  type MissionEnvelope,
  type Waypoint,
} from './envelope.js';
import {
  MAVLINK_PROTOCOL,
  mavlinkErrorTaxonomy,
  vehicleResourceId,
  type FlightVehicle,
} from './profile.js';
import {
  assertEnvelopeBinding,
  MavlinkTransportError,
  type MavlinkTransportPort,
  type TelemetrySnapshot,
} from './transport.js';

export interface MavlinkAdapterOptions {
  transport: MavlinkTransportPort;
  site: string;
  vehicles: readonly FlightVehicle[];
  units?: UnitRegistry;
  /** Metres from the final waypoint that count as observed arrival. */
  arrivalToleranceMetres?: number;
}

function decimal(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(9)));
}

function quantityValue(value: unknown, unit: string, units: UnitRegistry): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object' && 'value' in value && 'unit' in value) {
    return units.convert(value as { value: number; unit: string }, unit).value;
  }
  return undefined;
}

function numberParameter(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new MavlinkTransportError('Invalid', `expected a number, got '${String(value)}'`);
}

function stringParameter(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new MavlinkTransportError('Invalid', `expected a non-empty string, got '${String(value)}'`);
}

function waypointIssues(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return 'at least one waypoint is required';
  if (value.length > 100) return 'mission exceeds the 100-waypoint limit';
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== 'object') return `waypoint ${index} must be an object`;
    const waypoint = entry as Record<string, unknown>;
    if (typeof waypoint.latitudeDeg !== 'number') return `waypoint ${index} latitudeDeg must be a number`;
    if (typeof waypoint.longitudeDeg !== 'number') return `waypoint ${index} longitudeDeg must be a number`;
    if (typeof waypoint.altitudeMetres !== 'number') return `waypoint ${index} altitudeMetres must be a number`;
  }
  return null;
}

export function createMavlinkDefinitions(
  options: MavlinkAdapterOptions,
): IndustrialActionDefinition[] {
  const units = options.units ?? defaultUnitRegistry();
  const taxonomy = mavlinkErrorTaxonomy();
  const transport = options.transport;
  const arrivalTolerance = options.arrivalToleranceMetres ?? 15;

  function vehicleOf(vehicleId: string): FlightVehicle {
    const vehicle = options.vehicles.find((candidate) => candidate.vehicleId === vehicleId);
    if (!vehicle) {
      throw new MavlinkTransportError('Invalid', `vehicle '${vehicleId}' is not registered`);
    }
    return vehicle;
  }

  function resourceFor(vehicleId: string): string {
    return resourceIdKey(vehicleResourceId(options.site, vehicleId));
  }

  function envelopeFrom(params: Record<string, unknown>): MissionEnvelope {
    const vehicleId = stringParameter(params.vehicle);
    vehicleOf(vehicleId);
    const altitude = quantityValue(params.maxAltitudeMetres, 'm', units);
    const speed = quantityValue(params.maxSpeedMetresPerSecond, 'm/s', units);
    const duration = quantityValue(params.maxDurationSeconds, 's', units);
    if (altitude === undefined) throw new MavlinkTransportError('Invalid', 'maxAltitudeMetres is required');
    if (speed === undefined) throw new MavlinkTransportError('Invalid', 'maxSpeedMetresPerSecond is required');
    if (duration === undefined) throw new MavlinkTransportError('Invalid', 'maxDurationSeconds is required');

    const geofenceLatitude = params.geofenceLatitudeDeg;
    const geofenceLongitude = params.geofenceLongitudeDeg;
    const geofenceRadius = params.geofenceRadiusMetres;
    const hasGeofence = geofenceLatitude !== undefined || geofenceLongitude !== undefined || geofenceRadius !== undefined;
    if (hasGeofence && (geofenceLatitude === undefined || geofenceLongitude === undefined || geofenceRadius === undefined)) {
      throw new MavlinkTransportError('Invalid', 'geofence requires latitude, longitude and radius');
    }

    const envelope: MissionEnvelope = {
      envelopeId: stringParameter(params.envelopeId),
      vehicle: vehicleId,
      waypoints: params.waypoints as Waypoint[],
      maxAltitudeMetres: decimal(altitude),
      maxSpeedMetresPerSecond: decimal(speed),
      maxDurationSeconds: decimal(duration),
      ...(hasGeofence
        ? {
            geofence: {
              latitudeDeg: numberParameter(geofenceLatitude),
              longitudeDeg: numberParameter(geofenceLongitude),
              radiusMetres: numberParameter(geofenceRadius),
            },
          }
        : {}),
    };
    assertValidMissionEnvelope(envelope);
    return envelope;
  }

  function envelopeParameters(): ParameterSchema[] {
    return [
      { name: 'envelopeId', type: 'string', required: true, description: 'Authorized plan id.' },
      { name: 'vehicle', type: 'string', required: true, description: 'Vehicle id.' },
      {
        name: 'waypoints', type: 'array', required: true,
        description: 'Ordered WGS-84 waypoints (latitudeDeg, longitudeDeg, altitudeMetres).',
        validation: waypointIssues,
      },
      {
        name: 'maxAltitudeMetres', type: 'quantity', required: true,
        dimension: 'length', unit: 'm', description: 'Altitude ceiling.',
      },
      {
        name: 'maxSpeedMetresPerSecond', type: 'quantity', required: true,
        dimension: 'linearSpeed', unit: 'm/s', description: 'Ground-speed ceiling.',
      },
      {
        name: 'maxDurationSeconds', type: 'quantity', required: true,
        dimension: 'time', unit: 's', description: 'Mission duration ceiling.',
      },
      { name: 'geofenceLatitudeDeg', type: 'number', required: false },
      { name: 'geofenceLongitudeDeg', type: 'number', required: false },
      { name: 'geofenceRadiusMetres', type: 'number', required: false },
    ];
  }

  function telemetryConfirmed(
    telemetry: TelemetrySnapshot,
    check: (snapshot: TelemetrySnapshot) => boolean,
  ): boolean {
    return check(telemetry);
  }

  const definitions: IndustrialActionDefinition[] = [
    {
      kind: 'flight:uploadMission',
      description: 'Upload an authorized mission plan to the autopilot (no dispatch of motion).',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: MAVLINK_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: { parameters: envelopeParameters(), context: [] },
      // Uploading a plan moves nothing; a failed upload is simply aborted.
      policy: { failureMode: 'abort', timeoutMs: 30_000 },
      async prepare(params) {
        const envelope = envelopeFrom(params);
        const digest = envelopeDigest(envelope);
        return {
          resourceId: resourceFor(envelope.vehicle),
          command: { action: 'uploadMission', envelope, envelopeDigest: digest },
        };
      },
      deriveEffects(op): StepEffects {
        const command = op.command as { envelope: MissionEnvelope; envelopeDigest: string };
        return deriveFlightEffects({
          resource: resourceFor(command.envelope.vehicle),
          maxSpeedMetresPerSecond: command.envelope.maxSpeedMetresPerSecond,
          maxDurationSeconds: command.envelope.maxDurationSeconds,
          envelopeId: command.envelope.envelopeId,
          envelopeDigest: command.envelopeDigest,
        });
      },
      async actuate(op) {
        const command = op.command as { envelope: MissionEnvelope; envelopeDigest: string };
        const result = await transport.uploadMission({
          envelopeId: command.envelope.envelopeId,
          envelopeDigest: command.envelopeDigest,
          waypoints: command.envelope.waypoints,
        });
        return {
          ok: true,
          data: { missionId: result.missionId, envelopeDigest: command.envelopeDigest },
        };
      },
      async: { confirmation: 'completed' },
    },
    {
      kind: 'flight:startMission',
      description: 'Start an uploaded mission that matches the authorized envelope digest.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: MAVLINK_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: {
        parameters: [
          { name: 'missionId', type: 'string', required: true, description: 'Autopilot mission id.' },
          { name: 'envelopeDigest', type: 'string', required: true, description: 'Authorized envelope digest.' },
          ...envelopeParameters(),
        ],
        context: [],
      },
      policy: { failureMode: 'fail-safe', timeoutMs: 30_000 },
      safeState: async () => {
        await transport.returnToLaunch();
        return { ok: true };
      },
      async prepare(params) {
        const envelope = envelopeFrom(params);
        const digest = envelopeDigest(envelope);
        assertEnvelopeBinding(envelope, stringParameter(params.envelopeDigest));
        return {
          resourceId: resourceFor(envelope.vehicle),
          command: {
            action: 'startMission',
            missionId: stringParameter(params.missionId),
            envelopeDigest: digest,
            envelope,
          },
        };
      },
      deriveEffects(op): StepEffects {
        const command = op.command as {
          envelope: MissionEnvelope;
          envelopeDigest: string;
          missionId: string;
        };
        return deriveFlightEffects({
          resource: resourceFor(command.envelope.vehicle),
          maxSpeedMetresPerSecond: command.envelope.maxSpeedMetresPerSecond,
          maxDurationSeconds: command.envelope.maxDurationSeconds,
          envelopeId: command.envelope.envelopeId,
          envelopeDigest: command.envelopeDigest,
        });
      },
      async actuate(op) {
        const command = op.command as { missionId: string; envelopeDigest: string };
        await transport.startMission({
          missionId: command.missionId,
          envelopeDigest: command.envelopeDigest,
        });
        return { ok: true, data: { missionId: command.missionId, envelopeDigest: command.envelopeDigest } };
      },
      async: {
        confirmation: 'accepted',
        async reconcile(op) {
          const command = op.command as { envelope: MissionEnvelope; missionId: string };
          const telemetry = await transport.readTelemetry();
          const final = command.envelope.waypoints.at(-1);
          const handle = { missionId: command.missionId };
          if (final && distanceMetres(
            { latitudeDeg: telemetry.latitudeDeg, longitudeDeg: telemetry.longitudeDeg, altitudeMetres: telemetry.altitudeMetres },
            final,
          ) <= arrivalTolerance) {
            return {
              status: 'confirmed',
              handle,
              progress: { fraction: 1, detail: 'arrived at final waypoint', at: Date.now() },
              result: { telemetry },
            };
          }
          const fraction = typeof telemetry.waypointIndex === 'number' && command.envelope.waypoints.length > 0
            ? Math.min(1, telemetry.waypointIndex / command.envelope.waypoints.length)
            : undefined;
          return {
            status: 'running',
            handle,
            progress: {
              ...(fraction !== undefined ? { fraction } : {}),
              detail: `en route${typeof telemetry.waypointIndex === 'number' ? ` (waypoint ${telemetry.waypointIndex})` : ''}`,
              at: Date.now(),
            },
          };
        },
        async cancel() {
          await transport.hold();
          await transport.returnToLaunch();
        },
      },
    },
    {
      kind: 'flight:hold',
      description: 'Hold position; the autopilot remains in control.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: MAVLINK_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: { parameters: [], context: [] },
      policy: { failureMode: 'fail-safe', timeoutMs: 15_000 },
      safeState: async () => {
        await transport.returnToLaunch();
        return { ok: true };
      },
      async prepare() {
        return { command: { action: 'hold' } };
      },
      deriveEffects(): StepEffects {
        return { spends: [], physical: { speed: [] } };
      },
      async actuate() {
        await transport.hold();
        return { ok: true };
      },
      async: {
        confirmation: 'accepted',
        async reconcile() {
          const telemetry = await transport.readTelemetry();
          const stopped = telemetryConfirmed(telemetry, (snapshot) => snapshot.groundspeedMetresPerSecond <= 0.2);
          return stopped
            ? { status: 'confirmed', progress: { fraction: 1, detail: 'vehicle holding', at: Date.now() } }
            : { status: 'running', progress: { detail: 'slowing to hold', at: Date.now() } };
        },
        async cancel() {
          await transport.returnToLaunch();
        },
      },
    },
    {
      kind: 'flight:returnToLaunch',
      description: 'Return to launch; completion is observed from telemetry.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: MAVLINK_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: { parameters: [], context: [] },
      policy: { failureMode: 'fail-safe', timeoutMs: 15_000 },
      safeState: async () => {
        await transport.land();
        return { ok: true };
      },
      async prepare() {
        return { command: { action: 'returnToLaunch' } };
      },
      deriveEffects(): StepEffects {
        return { spends: [] };
      },
      async actuate() {
        await transport.returnToLaunch();
        return { ok: true };
      },
      async: {
        confirmation: 'accepted',
        async reconcile() {
          const telemetry = await transport.readTelemetry();
          const home = telemetry.missionFinished === true && telemetry.groundspeedMetresPerSecond <= 0.5;
          return home
            ? { status: 'confirmed', progress: { fraction: 1, detail: 'returned to launch', at: Date.now() } }
            : { status: 'running', progress: { detail: 'returning to launch', at: Date.now() } };
        },
        async cancel() {
          await transport.land();
        },
      },
    },
    {
      kind: 'flight:land',
      description: 'Land at the current position.',
      version: 1,
      capability: 'industrial:action',
      effect: 'write',
      protocol: MAVLINK_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: { parameters: [], context: [] },
      policy: { failureMode: 'fail-safe', timeoutMs: 15_000 },
      safeState: async () => {
        await transport.land();
        return { ok: true };
      },
      async prepare() {
        return { command: { action: 'land' } };
      },
      deriveEffects(): StepEffects {
        return { spends: [] };
      },
      async actuate() {
        await transport.land();
        return { ok: true };
      },
      async: {
        confirmation: 'accepted',
        async reconcile() {
          const telemetry = await transport.readTelemetry();
          return telemetry.armed === false
            ? { status: 'confirmed', progress: { fraction: 1, detail: 'landed and disarmed', at: Date.now() } }
            : { status: 'running', progress: { detail: 'landing', at: Date.now() } };
        },
        async cancel() {
          throw new MavlinkTransportError('Unsupported', 'a landing cannot be cancelled; command return-to-launch from the operator console');
        },
      },
    },
    {
      kind: 'flight:readTelemetry',
      description: 'Read the vehicle telemetry snapshot used for reconciliation.',
      version: 1,
      capability: 'industrial:read',
      effect: 'read',
      protocol: MAVLINK_PROTOCOL,
      errorTaxonomy: taxonomy,
      schema: { parameters: [], context: [] },
      async prepare() {
        return { command: { action: 'readTelemetry' } };
      },
      deriveEffects(): StepEffects {
        return { spends: [] };
      },
      async actuate(): Promise<EdgeOperationResult> {
        return { ok: true, data: await transport.readTelemetry() };
      },
    },
  ];

  return definitions;
}

export type { MissionEnvelope };

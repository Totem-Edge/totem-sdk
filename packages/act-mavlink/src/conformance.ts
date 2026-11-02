/**
 * RFC-025 §5.8 — autopilot conformance harness.
 *
 * Each supported autopilot (and each simulator) must pass these checks before
 * it is offered in the catalogue. A second autopilot is added as a separate,
 * tested profile — never by loosening the first.
 */

import type { PreparedDeviceOp } from '@totemsdk/act-core';

import { createMavlinkDefinitions } from './adapter.js';
import {
  distanceMetres,
  envelopeDigest,
  validateMissionEnvelope,
  type MissionEnvelope,
} from './envelope.js';
import type { FlightVehicle } from './profile.js';
import type { MavlinkTransportPort } from './transport.js';

export interface MavlinkConformanceCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface MavlinkConformanceReport {
  vehicle: string;
  ok: boolean;
  checks: MavlinkConformanceCheck[];
}

export interface MavlinkConformanceOptions {
  site: string;
  vehicles: readonly FlightVehicle[];
  envelope: MissionEnvelope;
  /** Distance from the final waypoint that counts as arrival. */
  arrivalToleranceMetres?: number;
}

export async function runMavlinkConformance(
  transport: MavlinkTransportPort,
  options: MavlinkConformanceOptions,
): Promise<MavlinkConformanceReport> {
  const checks: MavlinkConformanceCheck[] = [];
  const push = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, ...(detail !== undefined ? { detail } : {}) });
  };

  const structural = validateMissionEnvelope(options.envelope);
  push('envelope-valid', structural.length === 0, structural.join('; ') || undefined);

  const outside = options.envelope.geofence
    ? validateMissionEnvelope({
        ...options.envelope,
        waypoints: [
          {
            latitudeDeg: options.envelope.geofence.latitudeDeg + 1,
            longitudeDeg: options.envelope.geofence.longitudeDeg,
            altitudeMetres: 0,
          },
        ],
      })
    : ['no geofence declared'];
  push('geofence-rejection', outside.length > 0, outside.join('; ') || undefined);

  const definitions = createMavlinkDefinitions({
    transport,
    site: options.site,
    vehicles: options.vehicles,
    ...(options.arrivalToleranceMetres !== undefined
      ? { arrivalToleranceMetres: options.arrivalToleranceMetres }
      : {}),
  });
  const upload = definitions.find((def) => def.kind === 'flight:uploadMission');
  const start = definitions.find((def) => def.kind === 'flight:startMission');

  if (!upload || !start) {
    push('definitions-present', false, 'upload/start definitions missing');
    return { vehicle: options.envelope.vehicle, ok: false, checks };
  }

  const uploadParams = paramsFromEnvelope(options.envelope);
  const preparedUpload = await upload.prepare(uploadParams, {});
  const uploaded = await upload.actuate(asPrepared(preparedUpload));
  const missionId = (uploaded.data as { missionId?: string } | undefined)?.missionId;
  push('mission-upload', uploaded.ok && typeof missionId === 'string', missionId ?? uploaded.error);

  const digest = envelopeDigest(options.envelope);
  push(
    'envelope-binding',
    (uploaded.data as { envelopeDigest?: string } | undefined)?.envelopeDigest === digest,
    'upload data must carry the authorized digest',
  );

  if (typeof missionId !== 'string') {
    return { vehicle: options.envelope.vehicle, ok: checks.every((check) => check.ok), checks };
  }

  const preparedStart = await start.prepare(
    { ...uploadParams, missionId, envelopeDigest: digest },
    {},
  );
  const started = await start.actuate(asPrepared(preparedStart));
  push('mission-start', started.ok, started.error);

  const telemetry = await transport.readTelemetry();
  push(
    'telemetry-shape',
    Number.isFinite(telemetry.latitudeDeg) &&
      Number.isFinite(telemetry.longitudeDeg) &&
      Number.isFinite(telemetry.altitudeMetres) &&
      Number.isFinite(telemetry.groundspeedMetresPerSecond) &&
      typeof telemetry.timestamp === 'string',
    telemetry.timestamp,
  );

  // Acceptance is not completion: unless the vehicle is already at the final
  // waypoint, reconciliation must not report `confirmed`.
  if (start.async?.reconcile) {
    const progress = await start.async.reconcile(asPrepared(preparedStart), {
      operationId: 'conformance',
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
      result: started.data,
    });
    const final = options.envelope.waypoints.at(-1);
    const arrived = final
      ? distanceMetres(
          {
            latitudeDeg: telemetry.latitudeDeg,
            longitudeDeg: telemetry.longitudeDeg,
            altitudeMetres: telemetry.altitudeMetres,
          },
          final,
        ) <= (options.arrivalToleranceMetres ?? 15)
      : false;
    push(
      'acceptance-is-not-completion',
      arrived ? progress.status === 'confirmed' : progress.status !== 'confirmed',
      `telemetry arrival=${arrived}, reconcile=${progress.status}`,
    );
  }

  push(
    'safe-state-available',
    transport.returnToLaunch instanceof Function,
    'return-to-launch must be available for fail-safe',
  );

  return { vehicle: options.envelope.vehicle, ok: checks.every((check) => check.ok), checks };
}

function asPrepared(prepared: { resourceId?: string; command?: unknown }): PreparedDeviceOp {
  return {
    kind: 'conformance',
    resourceId: prepared.resourceId,
    command: prepared.command,
    definitionVersion: 1,
    schemaHash: 'conformance',
    preparedCommandHash: 'conformance',
    parameters: {},
    context: {},
    commitmentHash: 'conformance',
    operationId: 'conformance',
  };
}

function paramsFromEnvelope(envelope: MissionEnvelope): Record<string, unknown> {
  return {
    envelopeId: envelope.envelopeId,
    vehicle: envelope.vehicle,
    waypoints: envelope.waypoints,
    maxAltitudeMetres: { value: Number(envelope.maxAltitudeMetres), unit: 'm' },
    maxSpeedMetresPerSecond: {
      value: Number(envelope.maxSpeedMetresPerSecond),
      unit: 'm/s',
    },
    maxDurationSeconds: { value: Number(envelope.maxDurationSeconds), unit: 's' },
    ...(envelope.geofence
      ? {
          geofenceLatitudeDeg: envelope.geofence.latitudeDeg,
          geofenceLongitudeDeg: envelope.geofence.longitudeDeg,
          geofenceRadiusMetres: envelope.geofence.radiusMetres,
        }
      : {}),
  };
}

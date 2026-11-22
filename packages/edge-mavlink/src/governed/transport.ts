/**
 * RFC-025 §5.2 — MAVLink transport port.
 *
 * The caller injects a MAVLink client (SDK, bridge, or simulator). This package
 * owns mission authority, bounded execution and evidence; the autopilot owns
 * stabilization, failsafes and the real-time loop.
 *
 * `startMission` carries the authorized envelope digest so a transport can
 * refuse to start a mission that differs from the one that was authorized.
 */

import { envelopeDigest, type MissionEnvelope, type Waypoint } from './envelope.js';

export interface MissionUploadRequest {
  envelopeId: string;
  envelopeDigest: string;
  waypoints: readonly Waypoint[];
}

export interface MissionUploadResult {
  /** Autopilot-assigned mission id (the reconciliation handle). */
  missionId: string;
}

export interface MissionStartRequest {
  missionId: string;
  envelopeDigest: string;
}

export interface TelemetrySnapshot {
  /** ISO-8601 timestamp from the autopilot. */
  timestamp: string;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeMetres: number;
  groundspeedMetresPerSecond: number;
  batteryPercent?: number;
  waypointIndex?: number;
  missionFinished?: boolean;
  armed?: boolean;
}

export interface MavlinkTransportPort {
  uploadMission(request: MissionUploadRequest): Promise<MissionUploadResult>;
  startMission(request: MissionStartRequest): Promise<void>;
  hold(): Promise<void>;
  returnToLaunch(): Promise<void>;
  land(): Promise<void>;
  /** Telemetry readback used for reconciliation; must originate from the vehicle. */
  readTelemetry(): Promise<TelemetrySnapshot>;
  /** Optional push path for telemetry. */
  onTelemetry?(handler: (telemetry: TelemetrySnapshot) => void): () => void;
}

export class MavlinkTransportError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MavlinkTransportError';
    this.code = code;
  }
}

/**
 * A start must reference the exact plan that was authorized. A digest that does
 * not match the envelope fails closed before dispatch.
 */
export function assertEnvelopeBinding(
  envelope: MissionEnvelope,
  digest: string,
): void {
  const expected = envelopeDigest(envelope);
  if (digest !== expected) {
    throw new MavlinkTransportError(
      'EnvelopeMismatch',
      `envelope digest mismatch for '${envelope.envelopeId}' (authorized ${digest}, prepared ${expected})`,
    );
  }
}

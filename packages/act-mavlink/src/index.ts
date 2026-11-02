/**
 * RFC-025 — governed MAVLink / autonomous flight profile.
 *
 * `@totemsdk/act-mavlink` authorizes a bounded mission envelope; the connector
 * (`@totemsdk/edge-mavlink`) carries the wire frames and the autopilot owns
 * stabilization, failsafes and the real-time loop.
 */

export {
  MavlinkTransportError,
  assertEnvelopeBinding,
} from './transport.js';
export type {
  MavlinkTransportPort,
  MissionStartRequest,
  MissionUploadRequest,
  MissionUploadResult,
  TelemetrySnapshot,
} from './transport.js';

export {
  assertValidMissionEnvelope,
  distanceMetres,
  envelopeDigest,
  validateMissionEnvelope,
} from './envelope.js';
export type { Geofence, MissionEnvelope, Waypoint } from './envelope.js';

export { deriveFlightEffects } from './effects.js';
export type { FlightLimits } from './effects.js';

export {
  MAVLINK_PROTOCOL,
  createMavlinkProfile,
  mavlinkErrorTaxonomy,
  vehicleInterlocks,
  vehicleResource,
  vehicleResourceId,
} from './profile.js';
export type { FlightVehicle, MavlinkProfileOptions } from './profile.js';

export { createMavlinkDefinitions } from './adapter.js';
export type { MavlinkAdapterOptions } from './adapter.js';

export { runMavlinkConformance } from './conformance.js';
export type {
  MavlinkConformanceCheck,
  MavlinkConformanceOptions,
  MavlinkConformanceReport,
} from './conformance.js';

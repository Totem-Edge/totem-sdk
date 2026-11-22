/**
 * RFC-025 §5.4 / §5.9 — MAVLink flight profile.
 *
 * The vehicle is an asset addressed at its autopilot. Safe state is
 * return-to-launch (a `fail-safe` in flight must never command a de-energize
 * analogue). Interlocks enforce the vehicle's declared ceilings before
 * authorization; safety-coded errors require the safe state and never retry.
 */

import {
  createDeviceErrorTaxonomy,
  type DeviceErrorTaxonomy,
  type IndustrialProfile,
  type Interlock,
  type Resource,
  type ResourceId,
} from '@totemsdk/act-core';

import { distanceMetres, type MissionEnvelope, type Waypoint } from './envelope.js';

export const MAVLINK_PROTOCOL = 'mavlink';

export interface FlightVehicle {
  vehicleId: string;
  /** Ground-speed ceiling, in m/s (decimal string). */
  maxSpeedMetresPerSecond: string;
  /** Altitude ceiling, in metres (decimal string). */
  maxAltitudeMetres: string;
  /** Mission duration ceiling, in seconds (decimal string). */
  maxDurationSeconds: string;
  /** MAVLink addressing. */
  systemId?: number;
  componentId?: number;
}

export function vehicleResourceId(site: string, vehicleId: string): ResourceId {
  return { site, area: 'flight', asset: vehicleId, point: 'autopilot' };
}

export function vehicleResource(site: string, vehicle: FlightVehicle): Resource {
  const id = vehicleResourceId(site, vehicle.vehicleId);
  return {
    id,
    kind: 'controller',
    addresses: [
      {
        protocol: MAVLINK_PROTOCOL,
        endpoint: `system:${vehicle.systemId ?? 1}/component:${vehicle.componentId ?? 1}`,
      },
    ],
    // Hold/land/return are deployment policy; return-to-launch is the default
    // safe state. Never de-energize an airborne vehicle.
    safeState: {
      resourceId: id,
      command: { action: 'flight:returnToLaunch' },
    },
    metadata: {
      vehicleId: vehicle.vehicleId,
      maxSpeedMetresPerSecond: vehicle.maxSpeedMetresPerSecond,
      maxAltitudeMetres: vehicle.maxAltitudeMetres,
      maxDurationSeconds: vehicle.maxDurationSeconds,
    },
  };
}

function numeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (value && typeof value === 'object' && 'value' in value) {
    return numeric((value as { value: unknown }).value);
  }
  return undefined;
}

function ceilingInterlock(
  site: string,
  vehicle: FlightVehicle,
  id: string,
  parameter: string,
  ceiling: string,
  unit: string,
): Interlock {
  const resourceId = vehicleResourceId(site, vehicle.vehicleId);
  return {
    id,
    kind: 'precondition',
    resources: [resourceId],
    safeState: { resourceId, command: { action: 'flight:returnToLaunch' } },
    evaluate({ parameters }) {
      const requested = numeric(parameters[parameter]);
      if (requested === undefined) return { satisfied: true };
      return requested <= Number(ceiling)
        ? { satisfied: true }
        : { satisfied: false, reason: `requested ${requested} ${unit} exceeds vehicle ceiling ${ceiling} ${unit}` };
    },
  };
}

/** Interlocks enforcing the vehicle's declared envelope ceilings. */
export function vehicleInterlocks(site: string, vehicle: FlightVehicle): Interlock[] {
  const resourceId = vehicleResourceId(site, vehicle.vehicleId);
  const interlocks = [
    ceilingInterlock(site, vehicle, `mavlink:speed-ceiling:${vehicle.vehicleId}`, 'maxSpeedMetresPerSecond', vehicle.maxSpeedMetresPerSecond, 'm/s'),
    ceilingInterlock(site, vehicle, `mavlink:altitude-ceiling:${vehicle.vehicleId}`, 'maxAltitudeMetres', vehicle.maxAltitudeMetres, 'm'),
    ceilingInterlock(site, vehicle, `mavlink:duration-ceiling:${vehicle.vehicleId}`, 'maxDurationSeconds', vehicle.maxDurationSeconds, 's'),
  ];

  // Geofence containment is dynamic: it depends on the waypoints in the
  // prepared request, not only on scalar ceilings.
  interlocks.push({
    id: `mavlink:geofence:${vehicle.vehicleId}`,
    kind: 'precondition',
    resources: [resourceId],
    safeState: { resourceId, command: { action: 'flight:returnToLaunch' } },
    evaluate({ parameters }) {
      const latitude = numeric(parameters.geofenceLatitudeDeg);
      const longitude = numeric(parameters.geofenceLongitudeDeg);
      const radius = numeric(parameters.geofenceRadiusMetres);
      if (latitude === undefined || longitude === undefined || radius === undefined) {
        return { satisfied: true };
      }
      const waypoints = parameters.waypoints;
      if (!Array.isArray(waypoints)) return { satisfied: true };
      for (const [index, waypoint] of waypoints.entries()) {
        const candidate = waypoint as Waypoint;
        const distance = distanceMetres(
          { latitudeDeg: latitude, longitudeDeg: longitude, altitudeMetres: 0 },
          candidate,
        );
        if (distance > radius) {
          return {
            satisfied: false,
            reason: `waypoint ${index} is ${Math.round(distance)} m from the geofence centre (limit ${radius} m)`,
          };
        }
      }
      return { satisfied: true };
    },
  });

  return interlocks;
}

/** MAVLink result codes → device error classification (RFC-011 §4.7). */
export function mavlinkErrorTaxonomy(): DeviceErrorTaxonomy {
  const taxonomy = createDeviceErrorTaxonomy();
  const classes: Record<string, 'transient' | 'permanent' | 'safety' | 'auth'> = {
    // Failsafe/geofence conditions require the safe state and never retry.
    GEOFENCE_BREACH: 'safety',
    FAILSAFE_TRIGGERED: 'safety',
    BATTERY_LOW: 'safety',
    CRITICAL_BATTERY: 'safety',
    // Mission/protocol rejection — retrying the same plan cannot succeed.
    MAV_MISSION_ERROR: 'permanent',
    MAV_MISSION_UNSUPPORTED: 'permanent',
    MAV_MISSION_UNSUPPORTED_FRAME: 'permanent',
    MAV_MISSION_NO_SPACE: 'permanent',
    MAV_MISSION_INVALID: 'permanent',
    MAV_MISSION_INVALID_PARAM1: 'permanent',
    MAV_MISSION_INVALID_PARAM2: 'permanent',
    MAV_MISSION_INVALID_PARAM3: 'permanent',
    MAV_MISSION_INVALID_PARAM4: 'permanent',
    MAV_MISSION_INVALID_PARAM5_X: 'permanent',
    MAV_MISSION_INVALID_PARAM6_Y: 'permanent',
    MAV_MISSION_INVALID_PARAM7: 'permanent',
    MAV_MISSION_DENIED: 'auth',
    MAV_RESULT_UNSUPPORTED: 'permanent',
    MAV_RESULT_FAILED: 'permanent',
    MAV_RESULT_CANCELLED: 'permanent',
    // Link/transport — retry under the same operation id is safe.
    LINK_TIMEOUT: 'transient',
    MAV_RESULT_IN_PROGRESS: 'transient',
    TIMEOUT: 'transient',
    // Authorization.
    AUTHORIZATION_DENIED: 'auth',
    ENVELOPE_MISMATCH: 'auth',
  };
  for (const [code, classification] of Object.entries(classes)) {
    taxonomy.register(MAVLINK_PROTOCOL, code, classification);
  }
  return taxonomy;
}

export interface MavlinkProfileOptions {
  site: string;
  vehicles: readonly FlightVehicle[];
}

/** Data-only flight profile (definitions are supplied by the adapter). */
export function createMavlinkProfile(options: MavlinkProfileOptions): IndustrialProfile {
  return {
    id: 'mavlink',
    version: 1,
    resources: options.vehicles.map((vehicle) => vehicleResource(options.site, vehicle)),
    interlocks: options.vehicles.flatMap((vehicle) => vehicleInterlocks(options.site, vehicle)),
    errorTaxonomy: mavlinkErrorTaxonomy(),
    capabilities: ['industrial:action', 'industrial:read', 'transport:mavlink'],
    recipes: [],
    definitions: [],
  };
}

export type { MissionEnvelope };

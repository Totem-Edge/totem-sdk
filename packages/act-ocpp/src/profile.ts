/**
 * RFC-024 §5.4 / §5.9 — OCPP charging profile.
 *
 * Connectors are resources; the safe state is `stop session` (never leave an
 * active transaction). Interlocks enforce the connector's declared physical
 * ceiling before authorization, and the error taxonomy classifies OCPP status
 * codes so a safety error is never retried.
 */

import {
  createDeviceErrorTaxonomy,
  type DeviceErrorTaxonomy,
  type IndustrialProfile,
  type Interlock,
  type Resource,
  type ResourceId,
} from '@totemsdk/act-core';

import type { OcppCapabilitySet } from './capabilities.js';
import { OCPP_CORE_PROFILES } from './capabilities.js';

export const OCPP_PROTOCOL = 'ocpp';

export interface ChargingConnector {
  connectorId: number;
  /** Physical ceiling at this connector, in W (decimal string). */
  maxPowerWatts: string;
  /** Contract/session energy ceiling, in Wh. */
  maxEnergyWattHours?: string;
  /** Maximum session duration, in seconds. */
  maxSessionSeconds?: string;
  phases?: 1 | 3;
  connectorType?: string;
}

export function chargingResourceId(
  site: string,
  connectorId: number,
  asset = `EVSE-${connectorId}`,
): ResourceId {
  return { site, area: 'charging', asset, point: 'connector' };
}

export function chargingResource(site: string, connector: ChargingConnector): Resource {
  const id = chargingResourceId(site, connector.connectorId);
  return {
    id,
    kind: 'actuator',
    addresses: [{ protocol: OCPP_PROTOCOL, endpoint: `connector:${connector.connectorId}` }],
    // Never leave an active transaction: the safe state stops the session.
    safeState: {
      resourceId: id,
      command: { action: 'charging:stopSession', connectorId: connector.connectorId },
    },
    metadata: {
      connectorId: connector.connectorId,
      maxPowerWatts: connector.maxPowerWatts,
      ...(connector.maxEnergyWattHours !== undefined
        ? { maxEnergyWattHours: connector.maxEnergyWattHours }
        : {}),
      ...(connector.maxSessionSeconds !== undefined
        ? { maxSessionSeconds: connector.maxSessionSeconds }
        : {}),
      ...(connector.phases !== undefined ? { phases: connector.phases } : {}),
      ...(connector.connectorType !== undefined ? { connectorType: connector.connectorType } : {}),
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

/** Interlocks that enforce a connector's declared ceiling before authorization. */
export function chargingInterlocks(site: string, connector: ChargingConnector): Interlock[] {
  const id = chargingResourceId(site, connector.connectorId);
  const safeState = {
    resourceId: id,
    command: { action: 'charging:stopSession', connectorId: connector.connectorId },
  };
  const interlocks: Interlock[] = [
    {
      id: `ocpp:power-ceiling:${connector.connectorId}`,
      kind: 'precondition',
      resources: [id],
      safeState,
      evaluate({ parameters }) {
        const requested = numeric(parameters.maxPowerWatts);
        if (requested === undefined) return { satisfied: true };
        const ceiling = Number(connector.maxPowerWatts);
        return requested <= ceiling
          ? { satisfied: true }
          : { satisfied: false, reason: `requested ${requested} W exceeds connector ceiling ${ceiling} W` };
      },
    },
  ];

  if (connector.maxEnergyWattHours !== undefined) {
    interlocks.push({
      id: `ocpp:energy-ceiling:${connector.connectorId}`,
      kind: 'precondition',
      resources: [id],
      safeState,
      evaluate({ parameters }) {
        const requested = numeric(parameters.maxEnergyWattHours);
        if (requested === undefined) return { satisfied: true };
        const ceiling = Number(connector.maxEnergyWattHours);
        return requested <= ceiling
          ? { satisfied: true }
          : { satisfied: false, reason: `requested ${requested} Wh exceeds connector ceiling ${ceiling} Wh` };
      },
    });
  }

  if (connector.maxSessionSeconds !== undefined) {
    interlocks.push({
      id: `ocpp:duration-ceiling:${connector.connectorId}`,
      kind: 'precondition',
      resources: [id],
      safeState,
      evaluate({ parameters }) {
        const requested = numeric(parameters.maxSessionSeconds);
        if (requested === undefined) return { satisfied: true };
        const ceiling = Number(connector.maxSessionSeconds);
        return requested <= ceiling
          ? { satisfied: true }
          : { satisfied: false, reason: `requested ${requested} s exceeds connector ceiling ${ceiling} s` };
      },
    });
  }

  return interlocks;
}

/**
 * OCPP status → device error classification (RFC-011 §4.7).
 * Safety codes require a safe state and are never retried.
 */
export function ocppErrorTaxonomy(): DeviceErrorTaxonomy {
  const taxonomy = createDeviceErrorTaxonomy();
  const classes: Record<string, 'transient' | 'permanent' | 'safety' | 'auth'> = {
    // Charger/connector protection — never retry.
    ConnectorLockFailure: 'safety',
    EVCommunicationError: 'safety',
    GroundFailure: 'safety',
    HighTemperature: 'safety',
    InternalError: 'safety',
    OverCurrentFailure: 'safety',
    OverVoltage: 'safety',
    PowerMeterFailure: 'safety',
    PowerSwitchFailure: 'safety',
    ResetFailure: 'safety',
    UnderVoltage: 'safety',
    Faulted: 'safety',
    // Occupancy/state — retrying the same command cannot succeed.
    Occupied: 'permanent',
    Reserved: 'permanent',
    Unavailable: 'permanent',
    NotSupported: 'permanent',
    Rejected: 'permanent',
    Invalid: 'permanent',
    // Link/availability — a retry with the same operation id is safe.
    Offline: 'transient',
    Timeout: 'transient',
    WeakSignal: 'transient',
    // Identity — never retry without a new authorization.
    InvalidIdTag: 'auth',
    UnknownIdTag: 'auth',
    AuthorizationFailed: 'auth',
  };
  for (const [code, classification] of Object.entries(classes)) {
    taxonomy.register(OCPP_PROTOCOL, code, classification);
  }
  return taxonomy;
}

export interface OcppProfileOptions {
  site: string;
  connectors: readonly ChargingConnector[];
  capabilities?: OcppCapabilitySet;
}

/** Data-only charger profile (definitions are supplied by the adapter). */
export function createOcppProfile(options: OcppProfileOptions): IndustrialProfile {
  const resources = options.connectors.map((connector) => chargingResource(options.site, connector));
  const interlocks = options.connectors.flatMap((connector) =>
    chargingInterlocks(options.site, connector),
  );
  return {
    id: 'ocpp',
    version: 1,
    resources,
    interlocks,
    errorTaxonomy: ocppErrorTaxonomy(),
    capabilities: ['industrial:action', 'industrial:read', 'transport:ocpp'],
    recipes: [],
    definitions: [],
  };
}

export { OCPP_CORE_PROFILES };

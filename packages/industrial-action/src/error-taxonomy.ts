/**
 * RFC-011 §4.7 — device error taxonomy.
 *
 * Normalizes protocol errors (Modbus exception codes, OPC-UA status codes,
 * BACnet errors, transport failures) into a retry/abort classification so the
 * execution policy is protocol-aware: transient errors may retry, safety errors
 * never do and require a safe state.
 */

import type { ResourceProtocol } from './resources.js';

export type DeviceErrorClass = 'transient' | 'permanent' | 'safety' | 'auth' | 'unknown';

export interface DeviceErrorClassification {
  class: DeviceErrorClass;
  /** Normalized, protocol-qualified code, e.g. `MODBUS:ILLEGAL_DATA_ADDRESS`. */
  code: string;
  retryable: boolean;
  safeStateRequired: boolean;
}

export interface DeviceErrorTaxonomy {
  /** Register/override a classification for a protocol + raw code. */
  register(protocol: ResourceProtocol | '*', rawCode: string, classification: DeviceErrorClass): void;
  classify(protocol: ResourceProtocol | undefined, raw: unknown): DeviceErrorClassification;
}

function defaultFlags(kind: DeviceErrorClass): { retryable: boolean; safeStateRequired: boolean } {
  switch (kind) {
    case 'transient':
      return { retryable: true, safeStateRequired: false };
    case 'safety':
      return { retryable: false, safeStateRequired: true };
    default:
      return { retryable: false, safeStateRequired: false };
  }
}

/** Extract a comparable code string from a raw error. */
function normalizeRaw(raw: unknown): string {
  if (typeof raw === 'number') return String(raw);
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.errorCode === 'string') return obj.errorCode;
    if (typeof obj.code === 'string' || typeof obj.code === 'number') return String(obj.code);
  }
  return 'unknown';
}

// Modbus exception codes (RFC/MODBUS Application Protocol).
const MODBUS_EXCEPTIONS: Record<string, DeviceErrorClass> = {
  '1': 'permanent', // ILLEGAL_FUNCTION
  '2': 'permanent', // ILLEGAL_DATA_ADDRESS
  '3': 'permanent', // ILLEGAL_DATA_VALUE
  '4': 'transient', // SERVER_DEVICE_FAILURE
  '5': 'transient', // ACKNOWLEDGE
  '6': 'transient', // SERVER_DEVICE_BUSY
  '8': 'permanent', // MEMORY_PARITY_ERROR
  '10': 'transient', // GATEWAY_PATH_UNAVAILABLE
  '11': 'transient', // GATEWAY_TARGET_NO_RESPONSE
};

// OPC-UA status codes (Bad*).
const OPCUA_STATUS: Record<string, DeviceErrorClass> = {
  BadTimeout: 'transient',
  BadServerNotConnected: 'transient',
  BadConnectionClosed: 'transient',
  BadServerHalted: 'transient',
  BadResourceUnavailable: 'transient',
  BadNodeIdUnknown: 'permanent',
  BadAttributeIdInvalid: 'permanent',
  BadTypeMismatch: 'permanent',
  BadUserAccessDenied: 'auth',
  BadSecurityChecksFailed: 'auth',
  BadIdentityTokenInvalid: 'auth',
  BadIdentityTokenRejected: 'auth',
  BadOutOfService: 'safety',
  BadDeviceFailure: 'safety',
};

// Generic transport/execution errors (from the adapter/edge runtime).
const GENERIC: Record<string, DeviceErrorClass> = {
  EXECUTION_TIMEOUT: 'transient',
  TRANSPORT_ERROR: 'transient',
  ECONNRESET: 'transient',
  ETIMEDOUT: 'transient',
  ECONNREFUSED: 'transient',
  EXECUTION_FAILED: 'permanent',
  EXECUTION_ERROR: 'unknown',
  NOT_ATTEMPTED: 'unknown',
  SAFETY_TRIP: 'safety',
};

export function createDeviceErrorTaxonomy(): DeviceErrorTaxonomy {
  // protocol -> rawCode -> class; '*' is the fallback table.
  const tables = new Map<string, Map<string, DeviceErrorClass>>();
  const put = (protocol: string, code: string, kind: DeviceErrorClass): void => {
    let table = tables.get(protocol);
    if (!table) {
      table = new Map();
      tables.set(protocol, table);
    }
    table.set(code, kind);
  };

  for (const [code, kind] of Object.entries(MODBUS_EXCEPTIONS)) put('modbus', code, kind);
  for (const [code, kind] of Object.entries(OPCUA_STATUS)) put('opcua', code, kind);
  for (const [code, kind] of Object.entries(GENERIC)) put('*', code, kind);

  function lookup(protocol: string | undefined, rawCode: string): DeviceErrorClass | undefined {
    if (protocol) {
      const direct = tables.get(protocol)?.get(rawCode);
      if (direct) return direct;
    }
    return tables.get('*')?.get(rawCode);
  }

  return {
    register(protocol, rawCode, classification) {
      put(protocol, rawCode, classification);
    },
    classify(protocol, raw) {
      const rawCode = normalizeRaw(raw);
      const kind = lookup(protocol, rawCode) ?? 'unknown';
      const flags = defaultFlags(kind);
      const qualified = protocol ? `${String(protocol).toUpperCase()}:${rawCode}` : rawCode;
      return { class: kind, code: qualified, ...flags };
    },
  };
}

let _default: DeviceErrorTaxonomy | undefined;

/** Process-wide default taxonomy (profiles may construct their own). */
export function defaultDeviceErrorTaxonomy(): DeviceErrorTaxonomy {
  return (_default ??= createDeviceErrorTaxonomy());
}

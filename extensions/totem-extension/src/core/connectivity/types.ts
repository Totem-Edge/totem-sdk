/**
 * AXIA CONNECTION STATUS TYPES
 * Defines connection state machine and health check results
 */

export type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  lastChecked: number;
  lastSuccess: number | null;
  lastError: string | null;
  reason?: string;
  rpcEndpoint?: string;
  bootstrapConfigured: boolean;
  networkAvailable: boolean;
}

export interface HealthCheckResult {
  success: boolean;
  timestamp: number;
  latencyMs?: number;
  error?: string;
  endpoint?: string;
}

export const CONNECTION_STATUS_KEY = 'AXIA_CONNECTION_STATUS';

export const DEFAULT_CONNECTION_STATE: ConnectionState = {
  status: 'offline',
  lastChecked: 0,
  lastSuccess: null,
  lastError: null,
  reason: 'Not initialized',
  bootstrapConfigured: false,
  networkAvailable: true,
};

export const HEALTH_CHECK_INTERVAL_MINUTES = 1;
export const HEALTH_CHECK_TIMEOUT_MS = 10000;
export const MAX_CONSECUTIVE_FAILURES = 2;
export const STATUS_UPDATE_THRESHOLD_MS = 5000;

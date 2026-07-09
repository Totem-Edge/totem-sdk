/**
 * AXIA CONNECTIVITY MODULE
 * Exports connection monitoring types and classes
 */

export { ConnectionMonitor, connectionMonitor } from './ConnectionMonitor';
export type {
  ConnectionStatus,
  ConnectionState,
  HealthCheckResult,
} from './types';
export {
  CONNECTION_STATUS_KEY,
  DEFAULT_CONNECTION_STATE,
  HEALTH_CHECK_INTERVAL_MINUTES,
  HEALTH_CHECK_TIMEOUT_MS,
  MAX_CONSECUTIVE_FAILURES,
  STATUS_UPDATE_THRESHOLD_MS,
} from './types';

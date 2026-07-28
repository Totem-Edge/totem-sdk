/**
 * @module @totemsdk/core/lease
 * WOTS lease lifecycle management
 * 
 * This module provides:
 * - LeaseStore: Persistent storage for lease records with in-memory cache
 * - WatermarkStore: WOTS index tracking with server sync
 * - LeaseMonitor: Expiry monitoring and renewal
 */

export { 
  LeaseStore,
  type StoredLease,
  type LeaseStatus,
  type LeaseStoreConfig,
  type WotsIndices as LeaseWotsIndices,
} from './LeaseStore.js';

export { 
  WatermarkStore,
  type WatermarkState,
  type SyncResult,
  type WatermarkStoreConfig,
} from './WatermarkStore.js';

export type { WotsIndices } from './WatermarkStore.js';

export {
  LeaseMonitor,
  type LeaseExpiryEvent,
  type LeaseExpiryCallback,
  type LeaseMonitorConfig,
} from './LeaseMonitor.js';

export { 
  prepareLease, 
  finalizeLease, 
  flatIndexFromLanes,
  type PrepareArgs,
  type PrepareResp 
} from '../lease-client.js';

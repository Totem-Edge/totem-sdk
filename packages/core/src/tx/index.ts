/**
 * @module @totemsdk/core/tx
 * Transaction service and lifecycle management
 * 
 * This module provides:
 * - TransactionService: WOTS signing flow (prepare → sign → finalize)
 * - TransactionLifecycle: Orchestrates flow with lease/watermark stores
 * - TransactionReceiptStore: Persistent transaction history
 */

export {
  TransactionService,
  type TransactionServiceConfig,
  type WotsSigningDependencies,
} from './TransactionService.js';

export {
  TransactionLifecycle,
  TransactionLifecycleError,
  WatermarkExhaustedError,
  type TransactionLifecycleConfig,
  type WatermarkSyncFunction,
  type PrepareResult,
} from './TransactionLifecycle.js';

export {
  TransactionReceiptStore,
  type TransactionReceiptStoreConfig,
} from './TransactionReceiptStore.js';

export type {
  WotsIndices,
  PrepareRequest,
  PrepareResponse,
  SignRequest,
  SignResult,
  HierarchicalWitnessBundle,
  WitnessBundle,
  FinalizeRequest,
  FinalizeResponse,
  TransactionMetadata,
  TransactionReceipt,
  TransactionError,
} from './types.js';

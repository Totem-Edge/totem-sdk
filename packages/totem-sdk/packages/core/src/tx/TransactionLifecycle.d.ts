/**
 * @module TransactionLifecycle
 * Orchestrates the complete transaction flow with lease and watermark management
 *
 * Integrates:
 * - TransactionService for RPC calls
 * - LeaseStore for lease persistence
 * - WatermarkStore for index tracking
 * - TransactionReceiptStore for history
 */
import type { LoggerAdapter, MetricsAdapter } from '../adapters';
import type { LeaseStore, WatermarkStore } from '../lease';
import type { TransactionService } from './TransactionService';
import type { TransactionReceiptStore } from './TransactionReceiptStore';
import type { PrepareRequest, PrepareResponse, FinalizeResponse, TransactionMetadata, SignResult } from './types';
import type { WotsSigningDependencies } from './TransactionService';
export declare class TransactionLifecycleError extends Error {
    code: number;
    userMessage: string;
    constructor(message: string, code: number, userMessage: string);
}
export declare class WatermarkExhaustedError extends Error {
    constructor();
}
export interface TransactionLifecycleConfig {
    validateWatermarkBeforePrepare?: boolean;
    syncWatermarkBeforePrepare?: boolean;
}
export interface WatermarkSyncFunction {
    (rootPublicKey: string): Promise<{
        updated: boolean;
        multiDeviceConflict: boolean;
    }>;
}
export interface PrepareResult extends PrepareResponse {
    metadata: TransactionMetadata;
}
export declare class TransactionLifecycle {
    private readonly txService;
    private readonly leaseStore;
    private readonly watermarkStore;
    private readonly receiptStore;
    private readonly logger;
    private readonly metrics;
    private readonly config;
    private syncWatermark?;
    constructor(txService: TransactionService, leaseStore: LeaseStore, watermarkStore: WatermarkStore, receiptStore: TransactionReceiptStore, logger?: LoggerAdapter, metrics?: MetricsAdapter, config?: TransactionLifecycleConfig);
    setSyncWatermarkFunction(fn: WatermarkSyncFunction): void;
    prepare(params: PrepareRequest, rootPublicKey: string): Promise<PrepareResult>;
    sign(prepareResult: PrepareResult, seed: Uint8Array, deps: WotsSigningDependencies, paramSetName?: string): Promise<SignResult>;
    finalize(leaseToken: string, signedHex: string, metadata: TransactionMetadata): Promise<FinalizeResponse>;
    cancelLease(leaseToken: string): Promise<void>;
    private validateWatermark;
    private parseAxiaError;
}

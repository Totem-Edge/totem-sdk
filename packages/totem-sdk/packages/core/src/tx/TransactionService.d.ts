/**
 * @module TransactionService
 * Handles WOTS signing flow: prepare → sign → finalize
 *
 * Platform-agnostic implementation using HttpClient adapter.
 */
import type { HttpClient, LoggerAdapter, MetricsAdapter } from '../adapters';
import type { PrepareRequest, PrepareResponse, SignRequest, SignResult, FinalizeRequest, FinalizeResponse } from './types';
export interface TransactionServiceConfig {
    baseUrl: string;
    apiKey: string;
    paramSet?: string;
}
export interface WotsSigningDependencies {
    wotsSign: (seed: Uint8Array, index: number, message: Uint8Array, paramSet: any) => Uint8Array;
    fromHex: (hex: string) => Uint8Array;
    getParamSet: (name: string) => any;
    defaultParamSet: any;
}
export declare class TransactionService {
    private readonly http;
    private readonly logger;
    private readonly metrics;
    private readonly config;
    constructor(http: HttpClient, config: TransactionServiceConfig, logger?: LoggerAdapter, metrics?: MetricsAdapter);
    prepare(params: PrepareRequest, rootPublicKey: string): Promise<PrepareResponse>;
    sign(request: SignRequest, seed: Uint8Array, deps: WotsSigningDependencies, paramSetName?: string): Promise<SignResult>;
    finalize(params: FinalizeRequest): Promise<FinalizeResponse>;
    private serializeWitnessToHex;
    private bytesToHex;
}

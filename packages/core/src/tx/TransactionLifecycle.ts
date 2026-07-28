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

import type { LoggerAdapter, MetricsAdapter } from '../adapters/index.js';
import { NoopLogger, NoopMetrics } from '../adapters/index.js';
import type { LeaseStore, WatermarkStore, WotsIndices } from '../lease/index.js';
import type { TransactionService } from './TransactionService.js';
import type { TransactionReceiptStore } from './TransactionReceiptStore.js';
import type {
  PrepareRequest,
  PrepareResponse,
  FinalizeResponse,
  TransactionMetadata,
  SignRequest,
  SignResult,
} from './types.js';
import type { WotsSigningDependencies } from './TransactionService.js';

export class TransactionLifecycleError extends Error {
  constructor(
    message: string,
    public code: number,
    public userMessage: string
  ) {
    super(message);
    this.name = 'TransactionLifecycleError';
  }
}

export class WatermarkExhaustedError extends Error {
  constructor() {
    super('All WOTS signatures have been used. Please create a new wallet.');
    this.name = 'WatermarkExhaustedError';
  }
}

export interface TransactionLifecycleConfig {
  validateWatermarkBeforePrepare?: boolean;
  syncWatermarkBeforePrepare?: boolean;
}

export interface WatermarkSyncFunction {
  (rootPublicKey: string): Promise<{ updated: boolean; multiDeviceConflict: boolean }>;
}

export interface PrepareResult extends PrepareResponse {
  metadata: TransactionMetadata;
}

export class TransactionLifecycle {
  private readonly txService: TransactionService;
  private readonly leaseStore: LeaseStore;
  private readonly watermarkStore: WatermarkStore;
  private readonly receiptStore: TransactionReceiptStore;
  private readonly logger: LoggerAdapter;
  private readonly metrics: MetricsAdapter;
  private readonly config: Required<TransactionLifecycleConfig>;
  private syncWatermark?: WatermarkSyncFunction;

  constructor(
    txService: TransactionService,
    leaseStore: LeaseStore,
    watermarkStore: WatermarkStore,
    receiptStore: TransactionReceiptStore,
    logger: LoggerAdapter = new NoopLogger(),
    metrics: MetricsAdapter = new NoopMetrics(),
    config: TransactionLifecycleConfig = {}
  ) {
    this.txService = txService;
    this.leaseStore = leaseStore;
    this.watermarkStore = watermarkStore;
    this.receiptStore = receiptStore;
    this.logger = logger;
    this.metrics = metrics;
    this.config = {
      validateWatermarkBeforePrepare: config.validateWatermarkBeforePrepare ?? true,
      syncWatermarkBeforePrepare: config.syncWatermarkBeforePrepare ?? true,
    };
  }

  setSyncWatermarkFunction(fn: WatermarkSyncFunction): void {
    this.syncWatermark = fn;
  }

  async prepare(
    params: PrepareRequest,
    rootPublicKey: string
  ): Promise<PrepareResult> {
    if (this.config.validateWatermarkBeforePrepare) {
      await this.validateWatermark(rootPublicKey);
    }

    try {
      const result = await this.txService.prepare(params, rootPublicKey);

      await this.leaseStore.save({
        leaseId: result.leaseId,
        leaseToken: result.leaseToken,
        indices: { addressIndex: result.addressIndex, l1: result.l1, l2: result.l2 },
        expiresAt: Date.now() + result.leaseTTL,
        status: 'active',
        createdAt: Date.now(),
        txId: result.txId,
        leaseTTL: result.leaseTTL,
      });

      this.logger.debug(`Lease persisted: ${result.leaseId}`);

      return {
        ...result,
        metadata: {
          to: params.to,
          amount: params.amount,
          tokenId: params.tokenId || '0x00',
        },
      };
    } catch (error: any) {
      const parsed = this.parseAxiaError(error);
      throw new TransactionLifecycleError(error.message, parsed.code, parsed.userMessage);
    }
  }

  async sign(
    prepareResult: PrepareResult,
    seed: Uint8Array,
    deps: WotsSigningDependencies,
    paramSetName?: string
  ): Promise<SignResult> {
    const request: SignRequest = {
      addressIndex: prepareResult.addressIndex,
      l1: prepareResult.l1,
      l2: prepareResult.l2,
      digestTx: prepareResult.digestTx,
    };

    return this.txService.sign(request, seed, deps, paramSetName);
  }

  async finalize(
    leaseToken: string,
    signedHex: string,
    metadata: TransactionMetadata
  ): Promise<FinalizeResponse> {
    const lease = this.leaseStore.getByToken(leaseToken);
    if (!lease) {
      throw new TransactionLifecycleError(
        'Lease not found',
        404,
        'Transaction lease not found. Please try again.'
      );
    }

    try {
      const result = await this.txService.finalize({ leaseToken, signedHex });

      await this.watermarkStore.markUsed(lease.indices);
      await this.watermarkStore.advanceWatermark(lease.indices);

      await this.receiptStore.initialize();
      await this.receiptStore.add({
        txpowid: result.txpowid,
        timestamp: Date.now(),
        to: metadata.to,
        amount: metadata.amount,
        tokenId: metadata.tokenId,
        indices: lease.indices,
        status: 'confirmed',
        txId: lease.txId,
        leaseId: lease.leaseId,
      });

      await this.leaseStore.updateStatus(lease.leaseId, 'finalized');
      await this.leaseStore.delete(lease.leaseId);

      this.logger.debug(`Transaction finalized: ${result.txpowid}`);
      this.logger.debug('Watermark advanced and receipt stored');

      return result;
    } catch (error: any) {
      const parsed = this.parseAxiaError(error);
      throw new TransactionLifecycleError(error.message, parsed.code, parsed.userMessage);
    }
  }

  async cancelLease(leaseToken: string): Promise<void> {
    const lease = this.leaseStore.getByToken(leaseToken);
    if (lease) {
      await this.leaseStore.updateStatus(lease.leaseId, 'cancelled');
      await this.leaseStore.delete(lease.leaseId);
      this.logger.debug(`Lease cancelled: ${lease.leaseId}`);
    }
  }

  private async validateWatermark(rootPublicKey: string): Promise<void> {
    if (!this.watermarkStore.isInitialized()) {
      await this.watermarkStore.initialize();
    }

    if (this.watermarkStore.isExhausted()) {
      throw new WatermarkExhaustedError();
    }

    if (this.config.syncWatermarkBeforePrepare && this.syncWatermark) {
      try {
        this.logger.debug('Syncing watermark before transaction prepare...');
        const syncResult = await this.syncWatermark(rootPublicKey);

        if (syncResult.updated) {
          this.logger.debug('Watermark synced before prepare');
        }

        if (syncResult.multiDeviceConflict) {
          this.logger.warn('Multi-device conflict detected before prepare');
        }

        if (this.watermarkStore.isExhausted()) {
          throw new WatermarkExhaustedError();
        }
      } catch (error) {
        if (error instanceof WatermarkExhaustedError) {
          throw error;
        }
        this.logger.warn('Watermark sync failed before prepare:', error);
      }
    }
  }

  private parseAxiaError(error: any): { code: number; userMessage: string } {
    const message = error.message || error.toString();

    if (error?.code === 429) {
      const limit = error.limit ?? 10;
      return {
        code: 429,
        userMessage: `Daily signing limit reached (${limit}/day). Resets at midnight UTC.`,
      };
    }

    if (message.includes('403') || error.code === 403) {
      return {
        code: 403,
        userMessage: 'Access denied. Your project may not have permission for this operation.',
      };
    }

    if (message.includes('409') || error.code === 409) {
      return {
        code: 409,
        userMessage: 'WOTS indices exhausted. Please create a new wallet.',
      };
    }

    if (message.includes('410') || error.code === 410) {
      return {
        code: 410,
        userMessage: 'Transaction lease expired. Please try again.',
      };
    }

    if (message.includes('502') || error.code === 502) {
      return {
        code: 502,
        userMessage: 'Failed to post transaction to network. Please try again.',
      };
    }

    return {
      code: 500,
      userMessage: 'An error occurred. Please try again.',
    };
  }
}

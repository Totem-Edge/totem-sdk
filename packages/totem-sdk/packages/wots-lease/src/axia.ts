/**
 * AxiaLeaseProvider — wraps the Axia API's /v1/wots-hardened endpoints.
 *
 * Callers do NOT need to call /finalize separately — commitKeyUse() does it.
 */

import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger, LeaseStore, type StoredLease } from '@totemsdk/core';
import { prepareLease, finalizeLease } from '@totemsdk/core';
import type {
  WotsLeaseProvider,
  ReserveParams,
  LeaseReservation,
  LeaseCertificate,
  LocalWatermark,
  SyncResult,
  SigningIndices,
} from './types.js';
import { WotsWatermarkStore, flatIndex } from './watermark.js';
import { LeaseJournal } from './journal.js';
import { LeaseNotFoundError } from './errors.js';

export interface AxiaLeaseProviderConfig {
  apiUrl: string;
  apiKey: string;
  rootPublicKey: string;
  storage: StorageAdapter;
  logger?: LoggerAdapter;
}

export class AxiaLeaseProvider implements WotsLeaseProvider {
  private readonly watermark: WotsWatermarkStore;
  private readonly leaseStore: LeaseStore;
  private readonly journal: LeaseJournal;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly rootPublicKey: string;
  private readonly logger: LoggerAdapter;
  private _initialized = false;

  constructor(config: AxiaLeaseProviderConfig) {
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.rootPublicKey = config.rootPublicKey;
    this.logger = config.logger ?? new NoopLogger();
    this.watermark = new WotsWatermarkStore(config.storage, this.logger);
    this.leaseStore = new LeaseStore(config.storage, this.logger);
    this.journal = new LeaseJournal(config.storage, this.logger);
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    await this.watermark.initialize();
    await this.leaseStore.initialize();
    await this.journal.initialize();
    this._initialized = true;
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    if (!this._initialized) await this.initialize();

    const txId = params.payloadHash ?? `tx-${Date.now()}`;
    const resp = await prepareLease(this.apiUrl, this.apiKey, {
      txId,
      rootPublicKey: this.rootPublicKey,
      to: params.treeId,
      amount: params.valueHint ?? '0',
      ttlMs: params.ttlMs ?? 120_000,
    });

    const indices: SigningIndices = resp.lease;
    const expiresAt = Date.now() + (params.ttlMs ?? 120_000);
    const reservationId = resp.txId;

    const lease: StoredLease = {
      leaseId: reservationId,
      leaseToken: resp.leaseToken,
      indices,
      expiresAt,
      status: 'active',
      createdAt: Date.now(),
      leaseTTL: params.ttlMs ?? 120_000,
    };
    await this.leaseStore.save(lease);

    await this.journal.append({
      treeId: params.treeId,
      branchId: params.branchId ?? 'default',
      wotsIndex: flatIndex(indices),
      indices,
      status: 'reserved',
      payloadHash: params.payloadHash,
      timestamp: Date.now(),
      deviceId: params.deviceId ?? 'axia',
    });

    return { reservationId, indices, expiresAt, leaseToken: resp.leaseToken };
  }

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    if (!this._initialized) await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    await finalizeLease(this.apiUrl, this.apiKey, lease.leaseToken, txId);

    const indices: SigningIndices = lease.indices;
    await this.watermark.markUnavailable(
      lease.indices.addressIndex.toString(),
      indices,
      'committed',
    );
    await this.leaseStore.updateStatus(reservationId, 'finalized');

    await this.journal.append({
      treeId: reservationId,
      branchId: 'default',
      wotsIndex: flatIndex(indices),
      indices,
      status: 'committed',
      txId,
      timestamp: Date.now(),
      deviceId: 'axia',
    });
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    if (!this._initialized) await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    const indices: SigningIndices = lease.indices;
    await this.watermark.markUnavailable(
      lease.indices.addressIndex.toString(),
      indices,
      'burned',
    );
    await this.leaseStore.updateStatus(reservationId, 'cancelled');

    this.logger.warn(`[AxiaLeaseProvider] Burning reservation ${reservationId}: ${reason}`);
    await this.journal.append({
      treeId: reservationId,
      branchId: 'default',
      wotsIndex: flatIndex(indices),
      indices,
      status: 'burned',
      timestamp: Date.now(),
      deviceId: 'axia',
    });
  }

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    if (!this._initialized) await this.initialize();
    return this.watermark.getLocalWatermark(treeId);
  }

  async publishWatermark(_treeId: string): Promise<void> {
    // Server maintains its own watermark via the lease API
  }

  async syncLeaseJournal(): Promise<SyncResult> {
    return { synced: true, conflicts: [] };
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (cert === undefined) return true;
    return false;
  }
}

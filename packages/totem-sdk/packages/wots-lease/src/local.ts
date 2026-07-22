/**
 * LocalLeaseProvider — Layer 1: local durable ledger.
 *
 * Single-device, no network coordination.
 * All WOTS safety guaranteed by the local WotsWatermarkStore + LeaseJournal.
 */

import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger } from '@totemsdk/core';
import { LeaseStore, type StoredLease } from '@totemsdk/core';
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
import { LeaseNotFoundError, DeviceRangeViolationError } from './errors.js';

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class LocalLeaseProvider implements WotsLeaseProvider {
  private readonly watermark: WotsWatermarkStore;
  private readonly leaseStore: LeaseStore;
  private readonly journal: LeaseJournal;
  private _initialized = false;
  private readonly deviceId: string;

  constructor(
    storage: StorageAdapter,
    private readonly logger: LoggerAdapter = new NoopLogger(),
    deviceId = 'local',
  ) {
    this.watermark = new WotsWatermarkStore(storage, logger);
    this.leaseStore = new LeaseStore(storage, logger);
    this.journal = new LeaseJournal(storage, logger);
    this.deviceId = deviceId;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    await this.watermark.initialize();
    await this.leaseStore.initialize();
    await this.journal.initialize();
    await this.recoverExpiredReservations();
    await this.burnUnresolvedReservations();
    this._initialized = true;
  }

  /** Burn all active (non-expired) leases that have no matching treeId.
   *  On restart, leases with missing treeId (from before the treeId field was added)
   *  must be burned to prevent index reuse. */
  private async burnUnresolvedReservations(): Promise<void> {
    const now = Date.now();
    for (const lease of this.leaseStore.getAll()) {
      if (lease.status === 'active' && lease.expiresAt >= now && !lease.treeId) {
        this.logger.warn(`[LocalLeaseProvider] Burning unresolved lease ${lease.leaseId} (no treeId)`);
        await this.watermark.markUnavailable('default', lease.indices, 'burned');
        await this.leaseStore.updateStatus(lease.leaseId, 'cancelled');
        await this.journal.append({
          treeId: 'default',
          branchId: 'default',
          wotsIndex: flatIndex(lease.indices),
          indices: lease.indices,
          status: 'burned',
          reservationId: lease.leaseId,
          timestamp: now,
          deviceId: this.deviceId,
        });
      }
    }
  }

  private async recoverExpiredReservations(): Promise<void> {
    const now = Date.now();
    for (const lease of this.leaseStore.getAll()) {
      if (lease.status === 'active' && lease.expiresAt < now) {
        const treeId = lease.treeId ?? 'default';
        await this.watermark.markUnavailable(treeId, lease.indices, 'reserved-expired');
        await this.leaseStore.updateStatus(lease.leaseId, 'expired');
        await this.journal.append({
          treeId,
          branchId: 'default',
          wotsIndex: flatIndex(lease.indices),
          indices: lease.indices,
          status: 'reserved-expired',
          reservationId: lease.leaseId,
          timestamp: now,
          deviceId: this.deviceId,
        });
      }
    }
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    if (!this._initialized) await this.initialize();
    const treeId = params.treeId;
    const ttlMs = params.ttlMs ?? 120_000;

    // Atomically get the next available index AND mark it reserved in the watermark
    const indices = this.watermark.getNextIndices(treeId);

    // Validate device range BEFORE marking unavailable — prevents permanent index loss
    if (params.deviceId) {
      const range = this.getDeviceRange(params.deviceId);
      if (range && (indices.addressIndex < range.start || indices.addressIndex > range.end)) {
        throw new DeviceRangeViolationError(indices.addressIndex, range.start, range.end);
      }
    }

    await this.watermark.markUnavailable(treeId, indices, 'reserved');

    const reservationId = randomId();
    const expiresAt = Date.now() + ttlMs;

    const lease: StoredLease = {
      leaseId: reservationId,
      leaseToken: reservationId,
      treeId,
      indices,
      expiresAt,
      status: 'active',
      createdAt: Date.now(),
      leaseTTL: ttlMs,
    };
    await this.leaseStore.save(lease);

    await this.journal.append({
      treeId,
      branchId: params.branchId ?? 'default',
      wotsIndex: flatIndex(indices),
      indices,
      status: 'reserved',
      reservationId,
      payloadHash: params.payloadHash,
      timestamp: Date.now(),
      deviceId: params.deviceId ?? this.deviceId,
    });

    return { reservationId, indices, expiresAt };
  }

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    if (!this._initialized) await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);
    if (lease.status === 'finalized') return;

    const treeId = lease.treeId ?? 'default';
    const indices: SigningIndices = lease.indices;
    await this.watermark.markUnavailable(treeId, indices, 'committed');
    await this.leaseStore.updateStatus(reservationId, 'finalized');

    await this.journal.append({
      treeId,
      branchId: 'default',
      wotsIndex: flatIndex(indices),
      indices,
      status: 'committed',
      reservationId,
      txId,
      timestamp: Date.now(),
      deviceId: this.deviceId,
    });
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    if (!this._initialized) await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    const treeId = lease.treeId ?? 'default';
    const indices: SigningIndices = lease.indices;
    await this.watermark.markUnavailable(treeId, indices, 'burned');
    await this.leaseStore.updateStatus(reservationId, 'cancelled');

    this.logger.warn(`[LocalLeaseProvider] Burning reservation ${reservationId}: ${reason}`);
    await this.journal.append({
      treeId,
      branchId: 'default',
      wotsIndex: flatIndex(indices),
      indices,
      status: 'burned',
      reservationId,
      timestamp: Date.now(),
      deviceId: this.deviceId,
    });
  }

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    if (!this._initialized) await this.initialize();
    return this.watermark.getLocalWatermark(treeId);
  }

  async publishWatermark(_treeId: string): Promise<void> {
    // Layer 1: no-op
  }

  async syncLeaseJournal(): Promise<SyncResult> {
    // Layer 1: no-op
    return { synced: true, conflicts: [] };
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (cert === undefined) return true;
    return false;
  }

  private getDeviceRange(deviceId: string): { start: number; end: number } | null {
    const match = deviceId.match(/^device-?(\d+)$/i);
    if (!match) return null;
    const slot = parseInt(match[1], 10);
    return { start: slot * 8, end: slot * 8 + 7 };
  }
}

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
import {
  LeaseNotFoundError,
  InvalidLeaseTransitionError,
  DeviceRangeViolationError,
  IndicesUnavailableError,
} from './errors.js';

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
  private initializePromise: Promise<void> | null = null;
  private mutationTail: Promise<void> = Promise.resolve();
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
    if (!this.initializePromise) {
      this.initializePromise = this.initializeOnce().catch((error: unknown) => {
        this.initializePromise = null;
        throw error;
      });
    }
    await this.initializePromise;
  }

  private async initializeOnce(): Promise<void> {
    await this.journal.initialize();
    await this.watermark.initialize();
    await this.leaseStore.initialize();
    await this.reconcileDurableSafetyState();
    await this.recoverExpiredReservations();
    await this.burnUnresolvedReservations();
    this._initialized = true;
  }

  /**
   * Rebuild the no-reuse watermark from immutable journal history and leases.
   * The journal is audit authority; the watermark remains allocation authority.
   */
  private async reconcileDurableSafetyState(): Promise<void> {
    const entries = this.journal.getAll();
    const latestBySlot = new Map<string, typeof entries[number]>();
    const latestByReservation = new Map<string, typeof entries[number]>();
    for (const entry of entries) {
      latestBySlot.set(`${entry.treeId}:${entry.wotsIndex}`, entry);
      if (entry.reservationId) latestByReservation.set(entry.reservationId, entry);
    }
    for (const entry of latestBySlot.values()) {
      await this.watermark.markUnavailable(entry.treeId, entry.indices, entry.status);
    }

    const leases = this.leaseStore.getAll();
    const leaseIds = new Set(leases.map((lease) => lease.leaseId));
    for (const entry of latestByReservation.values()) {
      if (entry.status !== 'reserved' || leaseIds.has(entry.reservationId!)) continue;
      await this.journal.append({
        ...entry,
        status: 'burned',
        timestamp: Date.now(),
      });
      await this.watermark.markUnavailable(entry.treeId, entry.indices, 'burned');
    }

    for (const lease of leases) {
      const treeId = lease.treeId ?? 'default';
      const latest = this.journal.getByReservation(lease.leaseId);
      if (!latest) {
        const status = lease.status === 'finalized'
          ? 'committed'
          : lease.status === 'cancelled'
            ? 'burned'
            : lease.status === 'expired'
              ? 'reserved-expired'
              : 'reserved';
        await this.journal.append({
          treeId,
          branchId: 'default',
          wotsIndex: flatIndex(lease.indices),
          indices: lease.indices,
          status,
          reservationId: lease.leaseId,
          ...(lease.txId !== undefined ? { txId: lease.txId } : {}),
          timestamp: lease.createdAt,
          deviceId: this.deviceId,
        });
        await this.watermark.markUnavailable(treeId, lease.indices, status);
        continue;
      }

      if (latest.status === 'committed' && lease.status !== 'finalized') {
        await this.leaseStore.updateStatus(lease.leaseId, 'finalized');
      } else if (latest.status === 'burned' && lease.status !== 'cancelled') {
        await this.leaseStore.updateStatus(lease.leaseId, 'cancelled');
      } else if (latest.status === 'reserved-expired' && lease.status !== 'expired') {
        await this.leaseStore.updateStatus(lease.leaseId, 'expired');
      } else if (latest.status === 'reserved' && lease.status === 'finalized') {
        await this.journal.append({
          treeId,
          branchId: 'default',
          wotsIndex: flatIndex(lease.indices),
          indices: lease.indices,
          status: 'committed',
          reservationId: lease.leaseId,
          ...(lease.txId !== undefined ? { txId: lease.txId } : {}),
          timestamp: Date.now(),
          deviceId: this.deviceId,
        });
        await this.watermark.markUnavailable(treeId, lease.indices, 'committed');
      } else if (latest.status === 'reserved' && lease.status === 'cancelled') {
        await this.journal.append({
          treeId,
          branchId: 'default',
          wotsIndex: flatIndex(lease.indices),
          indices: lease.indices,
          status: 'burned',
          reservationId: lease.leaseId,
          timestamp: Date.now(),
          deviceId: this.deviceId,
        });
        await this.watermark.markUnavailable(treeId, lease.indices, 'burned');
      }
    }
  }

  /** Burn all active (non-expired) leases that have no matching treeId.
   *  On restart, leases with missing treeId (from before the treeId field was added)
   *  must be burned to prevent index reuse. */
  private async burnUnresolvedReservations(): Promise<void> {
    const now = Date.now();
    for (const lease of this.leaseStore.getAll()) {
      if (lease.status === 'active' && lease.expiresAt >= now && !lease.treeId) {
        this.logger.warn(`[LocalLeaseProvider] Burning unresolved lease ${lease.leaseId} (no treeId)`);
        if (this.journal.getByReservation(lease.leaseId)?.status !== 'burned') {
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
        await this.watermark.markUnavailable('default', lease.indices, 'burned');
        await this.leaseStore.updateStatus(lease.leaseId, 'cancelled');
      }
    }
  }

  private async recoverExpiredReservations(): Promise<void> {
    const now = Date.now();
    for (const lease of this.leaseStore.getAll()) {
      if (lease.status === 'expired' || (lease.status === 'active' && lease.expiresAt < now)) {
        const treeId = lease.treeId ?? 'default';
        if (this.journal.getByReservation(lease.leaseId)?.status !== 'reserved-expired') {
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
        await this.watermark.markUnavailable(treeId, lease.indices, 'reserved-expired');
        if (lease.status !== 'expired') await this.leaseStore.updateStatus(lease.leaseId, 'expired');
      }
    }
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    return this.withMutationLock(async () => {
      if (!this._initialized) await this.initialize();
      const indices = this.watermark.getNextIndices(params.treeId);
      return this.reserveSpecificKeyUseUnlocked(params, indices);
    });
  }

  /**
   * Reserve a specific set of indices (used by quorum coordination so every
   * peer attests to the same slot). Throws IndicesUnavailableError when the
   * slot is already taken.
   */
  async reserveSpecificKeyUse(params: ReserveParams, indices: SigningIndices): Promise<LeaseReservation> {
    return this.withMutationLock(async () => {
      if (!this._initialized) await this.initialize();
      return this.reserveSpecificKeyUseUnlocked(params, indices);
    });
  }

  private async reserveSpecificKeyUseUnlocked(
    params: ReserveParams,
    indices: SigningIndices,
  ): Promise<LeaseReservation> {
    if (!this._initialized) await this.initialize();
    const treeId = params.treeId;
    const ttlMs = params.ttlMs ?? 120_000;

    if (this.watermark.isUnavailable(treeId, indices)) {
      throw new IndicesUnavailableError(treeId, indices);
    }

    // Validate device range BEFORE marking unavailable — prevents permanent index loss
    if (params.deviceId) {
      const range = this.getDeviceRange(params.deviceId);
      if (range && (indices.addressIndex < range.start || indices.addressIndex > range.end)) {
        throw new DeviceRangeViolationError(indices.addressIndex, range.start, range.end);
      }
    }

    const reservationId = randomId();
    const expiresAt = Date.now() + ttlMs;

    // Write-ahead safety record: once this succeeds, recovery will never
    // re-expose the index even if a later snapshot write fails.
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

    await this.watermark.markUnavailable(treeId, indices, 'reserved');

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

    return { reservationId, indices, expiresAt };
  }

  private withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationTail.then(operation, operation);
    this.mutationTail = run.then(() => undefined, () => undefined);
    return run;
  }

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    return this.withMutationLock(() => this.commitKeyUseUnlocked(reservationId, txId));
  }

  private async commitKeyUseUnlocked(reservationId: string, txId: string): Promise<void> {
    if (!this._initialized) await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    const treeId = lease.treeId ?? 'default';
    const indices: SigningIndices = lease.indices;
    const latest = this.journal.getByReservation(reservationId);
    if (latest?.status === 'committed') {
      if (latest.txId !== txId) {
        throw new InvalidLeaseTransitionError(reservationId, 'committed', 'committed');
      }
      await this.watermark.markUnavailable(treeId, indices, 'committed');
      if (lease.status !== 'finalized') await this.leaseStore.updateStatus(reservationId, 'finalized');
      return;
    }
    if (latest?.status === 'burned' || latest?.status === 'reserved-expired'
      || lease.status === 'cancelled' || lease.status === 'expired') {
      throw new InvalidLeaseTransitionError(reservationId, latest?.status ?? lease.status, 'committed');
    }
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
    await this.watermark.markUnavailable(treeId, indices, 'committed');
    await this.leaseStore.updateStatus(reservationId, 'finalized');
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    return this.withMutationLock(() => this.burnReservationUnlocked(reservationId, reason));
  }

  private async burnReservationUnlocked(reservationId: string, reason: string): Promise<void> {
    if (!this._initialized) await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    const treeId = lease.treeId ?? 'default';
    const indices: SigningIndices = lease.indices;
    const latest = this.journal.getByReservation(reservationId);
    if (latest?.status === 'burned') {
      await this.watermark.markUnavailable(treeId, indices, 'burned');
      if (lease.status !== 'cancelled') await this.leaseStore.updateStatus(reservationId, 'cancelled');
      return;
    }
    if (latest?.status === 'committed' || latest?.status === 'reserved-expired'
      || lease.status === 'finalized' || lease.status === 'expired') {
      throw new InvalidLeaseTransitionError(reservationId, latest?.status ?? lease.status, 'burned');
    }
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
    await this.watermark.markUnavailable(treeId, indices, 'burned');
    await this.leaseStore.updateStatus(reservationId, 'cancelled');

    this.logger.warn(`[LocalLeaseProvider] Burning reservation ${reservationId}: ${reason}`);
  }

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    if (!this._initialized) await this.initialize();
    return this.watermark.getLocalWatermark(treeId);
  }

  /** List all tree IDs known to the local watermark store. */
  listTrees(): string[] {
    return Object.keys(this.watermark.getRawState().trees);
  }

  /** Expose the journal for quorum/on-chain providers to merge remote entries. */
  getJournal(): LeaseJournal {
    return this.journal;
  }

  /**
   * Advance the local watermark to a remote cursor (monotonic merge).
   * Used by quorum sync and the lookup-node LeaseCoordinator when a peer
   * publishes a watermark ahead of ours. Returns false when the remote
   * cursor is behind (no-op).
   */
  async advanceToRemoteWatermark(
    treeId: string,
    remote: { addressCursor: number; l1Cursor: number; l2Cursor: number },
  ): Promise<boolean> {
    if (!this._initialized) await this.initialize();
    const local = this.watermark.getLocalWatermark(treeId);
    const localFlat = flatIndex({ addressIndex: local.addressCursor, l1: local.l1Cursor, l2: local.l2Cursor });
    const remoteFlat = flatIndex({ addressIndex: remote.addressCursor, l1: remote.l1Cursor, l2: remote.l2Cursor });
    if (remoteFlat <= localFlat) return false;
    await this.watermark.save(treeId, {
      addressCursor: remote.addressCursor,
      l1Cursor: remote.l1Cursor,
      l2Cursor: remote.l2Cursor,
      lastSyncTimestamp: Date.now(),
    });
    return true;
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

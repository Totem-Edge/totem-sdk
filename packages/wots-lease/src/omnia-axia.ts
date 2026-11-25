/**
 * OmniaAxiaLeaseProvider — Axia hardened-WOTS leases for Omnia channel signing.
 *
 * Omnia signs per-channel state/funding digests with the wallet's per-address
 * TreeKey. The Axia hardened lease API is transaction-shaped:
 *   POST /v1/wots-hardened/prepare  { txId, rootPublicKey, addressIndex, ... }
 *   POST /v1/wots-hardened/consume  { leaseToken, txHash }
 *
 * This adapter keeps the Omnia `treeId` (per channel) as the local watermark and
 * journal key while leasing the wallet's per-address WOTS slot from Axia.
 */

import type { StorageAdapter, LoggerAdapter } from '@totemsdk/core';
import { NoopLogger, LeaseStore, type StoredLease } from '@totemsdk/core';
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
import { StorageError } from '@totemsdk/storage/errors';

export interface OmniaAxiaLeaseProviderConfig {
  apiUrl: string;
  apiKey: string;
  /** Wallet root public key (0x-prefixed 32-byte hex). */
  rootPublicKey: string;
  /** Wallet address index whose per-address TreeKey signs the channel. */
  addressIndex: number;
  storage: StorageAdapter;
  logger?: LoggerAdapter;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

interface PrepareResponse {
  leaseToken?: string;
  leaseId?: string;
  txId?: string;
  addressIndex?: number;
  l1?: number;
  l2?: number;
  leaseTTL?: number;
  lease?: {
    leaseToken?: string;
    leaseId?: string;
    addressIndex?: number;
    l1?: number;
    l2?: number;
  };
  error?: string;
}

export class OmniaAxiaLeaseProvider implements WotsLeaseProvider {
  private readonly watermark: WotsWatermarkStore;
  private readonly leaseStore: LeaseStore;
  private readonly journal: LeaseJournal;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly rootPublicKey: string;
  private readonly addressIndex: number;
  private readonly logger: LoggerAdapter;
  private readonly fetchImpl: typeof fetch;
  private _initialized = false;

  constructor(config: OmniaAxiaLeaseProviderConfig) {
    if (!Number.isInteger(config.addressIndex) || config.addressIndex < 0 || config.addressIndex > 63) {
      throw new Error('OmniaAxiaLeaseProvider requires addressIndex 0..63');
    }
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.rootPublicKey = config.rootPublicKey;
    this.addressIndex = config.addressIndex;
    this.logger = config.logger ?? new NoopLogger();
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.watermark = new WotsWatermarkStore(config.storage, this.logger);
    this.leaseStore = new LeaseStore(config.storage, this.logger);
    this.journal = new LeaseJournal(config.storage, this.logger);
  }

  private async initialize(): Promise<void> {
    if (this._initialized) return;
    await this.watermark.initialize();
    await this.leaseStore.initialize();
    await this.journal.initialize();
    this._initialized = true;
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    await this.initialize();

    const txId = params.payloadHash ?? `omnia-${params.treeId}-${Date.now()}`;
    const ttlMs = params.ttlMs ?? 120_000;
    const response = await this.fetchImpl(`${this.apiUrl}/v1/wots-hardened/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({
        txId,
        rootPublicKey: this.rootPublicKey,
        addressIndex: this.addressIndex,
        paramSet: 'v2-spec',
        ttlMs,
      }),
    });

    const raw = (await response.json().catch(() => ({}))) as PrepareResponse;
    if (!response.ok) {
      throw new Error(`Omnia Axia lease prepare failed (${response.status}): ${raw.error ?? 'unknown error'}`);
    }

    const leaseToken = raw.leaseToken ?? raw.lease?.leaseToken;
    if (!leaseToken) throw new Error('Omnia Axia lease prepare returned no leaseToken');

    const indices: SigningIndices = {
      addressIndex: raw.addressIndex ?? raw.lease?.addressIndex ?? this.addressIndex,
      l1: raw.l1 ?? raw.lease?.l1 ?? 0,
      l2: raw.l2 ?? raw.lease?.l2 ?? 0,
    };
    const reservationId = raw.leaseId ?? raw.lease?.leaseId ?? txId;
    const expiresAt = Date.now() + (raw.leaseTTL ?? ttlMs);

    await this.watermark.refresh();
    if (this.watermark.isUnavailable(params.treeId, indices)) {
      throw new Error(
        `Omnia Axia lease server returned an already-used WOTS index for ${params.treeId}`,
      );
    }

    const lease: StoredLease = {
      leaseId: reservationId,
      leaseToken,
      treeId: params.treeId,
      indices,
      expiresAt,
      status: 'active',
      createdAt: Date.now(),
      leaseTTL: ttlMs,
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
      deviceId: params.deviceId ?? 'omnia-axia',
    });

    return { reservationId, indices, expiresAt, leaseToken };
  }

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    const response = await this.fetchImpl(`${this.apiUrl}/v1/wots-hardened/consume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({ leaseToken: lease.leaseToken, txHash: txId }),
    });
    const raw = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(`Omnia Axia lease consume failed (${response.status}): ${raw.error ?? 'unknown error'}`);
    }

    const treeId = lease.treeId;
    if (!treeId) {
      throw new StorageError(`OmniaAxiaLeaseProvider: lease ${reservationId} has no treeId`, 'corrupt');
    }

    await this.watermark.markUnavailable(treeId, lease.indices, 'committed');
    await this.leaseStore.updateStatus(reservationId, 'finalized');
    await this.journal.append({
      treeId,
      branchId: 'default',
      wotsIndex: flatIndex(lease.indices),
      indices: lease.indices,
      status: 'committed',
      txId,
      timestamp: Date.now(),
      deviceId: 'omnia-axia',
    });
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    await this.initialize();
    const lease = this.leaseStore.get(reservationId);
    if (!lease) throw new LeaseNotFoundError(reservationId);

    const treeId = lease.treeId;
    if (!treeId) {
      throw new StorageError(`OmniaAxiaLeaseProvider: lease ${reservationId} has no treeId`, 'corrupt');
    }

    // There is no Axia cancel endpoint. Mark the slot locally as burned and let
    // the server lease expire; never reuse the index.
    await this.watermark.markUnavailable(treeId, lease.indices, 'burned');
    await this.leaseStore.updateStatus(reservationId, 'cancelled');
    this.logger.warn(`[OmniaAxiaLeaseProvider] burned reservation ${reservationId}: ${reason}`);
    await this.journal.append({
      treeId,
      branchId: 'default',
      wotsIndex: flatIndex(lease.indices),
      indices: lease.indices,
      status: 'burned',
      timestamp: Date.now(),
      deviceId: 'omnia-axia',
    });
  }

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    await this.initialize();
    return this.watermark.getLocalWatermark(treeId);
  }

  async publishWatermark(_treeId: string): Promise<void> {
    // Axia maintains its own server watermark.
  }

  async syncLeaseJournal(): Promise<SyncResult> {
    return { synced: true, conflicts: [] };
  }

  async verifyLeaseCertificate(_cert?: LeaseCertificate): Promise<boolean> {
    // The Axia API does not return a server-signed certificate we can verify.
    return false;
  }
}

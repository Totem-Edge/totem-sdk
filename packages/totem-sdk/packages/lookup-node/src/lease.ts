/**
 * LeaseCoordinator — server-side WOTS lease coordination.
 *
 * Bridges the lookup protocol LEASE_RESERVE / LEASE_COMMIT / LEASE_BURN
 * messages to a LocalLeaseProvider from @totemsdk/wots-lease.
 *
 * Issues signed LeaseCertificates on successful reservations.
 * Uses the StorageAdapter from config (or in-memory if omitted) for the
 * wots-lease journal; SQLite-level persistence for the lookup-node layer is
 * handled by the LookupNode's SqliteStore (not needed here since wots-lease
 * already persists to its own StorageAdapter).
 */

import { LocalLeaseProvider } from '@totemsdk/wots-lease';
import type { StorageAdapter } from '@totemsdk/core';
import type {
  LeaseReserveMessage,
  LeaseCommitMessage,
  LeaseBurnMessage,
} from '@totemsdk/lookup-protocol';
import type { LeaseCertificate } from '@totemsdk/wots-lease';
import type { SendFn } from './handlers.js';
import type { LeaseConfig } from './types.js';

// ---------------------------------------------------------------------------
// In-memory StorageAdapter (fallback when no external storage is configured)
// ---------------------------------------------------------------------------

class MemoryStorageAdapter implements StorageAdapter {
  private _store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this._store.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this._store.set(key, value);
  }
  async remove(key: string): Promise<boolean> {
    return this._store.delete(key);
  }
  async clear(): Promise<void> {
    this._store.clear();
  }
  async keys(): Promise<string[]> {
    return [...this._store.keys()];
  }
  async has(key: string): Promise<boolean> {
    return this._store.has(key);
  }
}

// ---------------------------------------------------------------------------
// LeaseCoordinator
// ---------------------------------------------------------------------------

export class LeaseCoordinator {
  private readonly _provider: LocalLeaseProvider;
  private _initialized = false;
  private _nodeId: string;
  private _signFn?: (data: Uint8Array) => Promise<Uint8Array>;
  /** Track burned reservations to reject commit-after-burn */
  private readonly _burnedReservations = new Set<string>();

  constructor(nodeId: string, config: LeaseConfig) {
    const storage: StorageAdapter = config.storage ?? new MemoryStorageAdapter();
    this._provider = new LocalLeaseProvider(storage);
    this._nodeId = nodeId;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    await this._provider.initialize();
    // Generate ephemeral Ed25519 signing key for certificate issuance
    try {
      const subtle = globalThis.crypto.subtle;
      const { privateKey, publicKey } = (await subtle.generateKey(
        { name: 'Ed25519' } as AlgorithmIdentifier,
        true,
        ['sign', 'verify'],
      )) as CryptoKeyPair;
      const rawPub = await subtle.exportKey('raw', publicKey);
      this._nodeId = Array.from(new Uint8Array(rawPub))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const capturedPriv = privateKey;
      this._signFn = async (data: Uint8Array) => {
        const sig = await subtle.sign(
          { name: 'Ed25519' } as AlgorithmIdentifier,
          capturedPriv,
          Buffer.from(data),
        );
        return new Uint8Array(sig);
      };
    } catch {
      // Ed25519 not supported (unusual) — certs will have placeholder sig
    }
    this._initialized = true;
  }

  private async _issueCertificate(
    reservationId: string,
    treeId: string,
    expiresAt: number,
    indices: { addressIndex: number; l1: number; l2: number },
  ): Promise<LeaseCertificate> {
    const issuedAt = Date.now();
    const cert: LeaseCertificate = {
      reservationId,
      treeId,
      indices,
      issuedBy: this._nodeId,
      issuedAt,
      expiresAt,
      signature: '',
    };

    if (this._signFn) {
      const certBytes = new TextEncoder().encode(
        JSON.stringify({ ...cert, signature: undefined }),
      );
      const sigBytes = await this._signFn(certBytes);
      cert.signature = Array.from(sigBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return cert;
  }

  async handleReserve(msg: LeaseReserveMessage, sendFn: SendFn): Promise<void> {
    if (!this._initialized) await this.initialize();
    try {
      const reservation = await this._provider.reserveKeyUse({
        treeId: msg.payload.treeId,
        branchId: msg.payload.branchId,
        deviceId: msg.payload.deviceId,
        ttlMs: msg.payload.ttlMs,
        payloadHash: msg.payload.payloadHash,
        purpose: msg.payload.purpose,
      });

      const cert = await this._issueCertificate(
        reservation.reservationId,
        msg.payload.treeId,
        reservation.expiresAt,
        reservation.indices,
      );

      sendFn({
        type: 'LEASE_RESPONSE',
        version: 1,
        id: msg.id,
        payload: {
          action: 'reserved',
          reservation: { ...reservation, certificate: cert },
          certificate: cert,
        },
      });
    } catch (err) {
      sendFn({
        type: 'ERROR',
        version: 1,
        id: msg.id,
        payload: { code: 'LEASE_RESERVE_FAILED', message: String(err), requestId: msg.id },
      });
    }
  }

  async handleCommit(msg: LeaseCommitMessage, sendFn: SendFn): Promise<void> {
    if (!this._initialized) await this.initialize();
    if (this._burnedReservations.has(msg.payload.reservationId)) {
      sendFn({
        type: 'ERROR',
        version: 1,
        id: msg.id,
        payload: { code: 'LEASE_COMMIT_FAILED', message: 'reservation already burned', requestId: msg.id },
      });
      return;
    }
    try {
      await this._provider.commitKeyUse(msg.payload.reservationId, msg.payload.txId);
      sendFn({
        type: 'LEASE_RESPONSE',
        version: 1,
        id: msg.id,
        payload: { action: 'committed' },
      });
    } catch (err) {
      sendFn({
        type: 'ERROR',
        version: 1,
        id: msg.id,
        payload: { code: 'LEASE_COMMIT_FAILED', message: String(err), requestId: msg.id },
      });
    }
  }

  async handleBurn(msg: LeaseBurnMessage, sendFn: SendFn): Promise<void> {
    if (!this._initialized) await this.initialize();
    try {
      await this._provider.burnReservation(msg.payload.reservationId, msg.payload.reason);
      this._burnedReservations.add(msg.payload.reservationId);
      sendFn({
        type: 'LEASE_RESPONSE',
        version: 1,
        id: msg.id,
        payload: { action: 'burned' },
      });
    } catch (err) {
      sendFn({
        type: 'ERROR',
        version: 1,
        id: msg.id,
        payload: { code: 'LEASE_BURN_FAILED', message: String(err), requestId: msg.id },
      });
    }
  }
}

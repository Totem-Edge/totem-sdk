/**
 * P2PQuorumLeaseProvider — Layer 4: multi-device quorum lease coordination.
 *
 * Safety model
 * ────────────
 * The local provider remains the authoritative watermark (it can only move
 * forward). The quorum adds a second, independent check: before a reservation
 * is handed to the caller, at least `minAttestations` peers must confirm that
 * the same (treeId, indices) slot is free in *their* view of the world. This
 * catches the failure mode where two devices share a seed and both believe
 * they own the next slot — the peers see the double-reservation and refuse
 * to attest.
 *
 * Wire protocol
 * ─────────────
 * Peers speak the same LEASE_RESERVE / LEASE_COMMIT / LEASE_BURN /
 * LEASE_WATERMARK message shapes as the lookup protocol, so any peer that
 * implements that protocol can participate: a personal lookup node, another
 * device running this provider, or an in-memory test peer.
 *
 * Failure semantics
 * ─────────────────
 * - If quorum cannot be reached, the local reservation is burned and
 *   QuorumUnavailableError is thrown. The slot is NOT reusable (burned),
 *   which is the safe direction: a slot that might have been attested by
 *   some peers must never be handed out again.
 * - If a peer reports the slot as taken, the local reservation is burned
 *   and QuorumConflictError is thrown.
 */

import type {
  WotsLeaseProvider,
  ReserveParams,
  LeaseReservation,
  LeaseCertificate,
  LocalWatermark,
  SyncResult,
  QuorumPeer,
  QuorumAttestation,
  P2PQuorumLeaseProviderConfig,
} from './types.js';
import type { LocalLeaseProvider } from './local.js';
import {
  QuorumUnavailableError,
  QuorumConflictError,
} from './errors.js';

interface PeerReserveResponse {
  action?: string;
  reservation?: {
    reservationId?: string;
    indices?: { addressIndex: number; l1: number; l2: number };
    expiresAt?: number;
  };
  certificate?: {
    issuedBy?: string;
    expiresAt?: number;
  };
}

interface PeerAckResponse {
  action?: string;
}

function sameIndices(
  a: { addressIndex: number; l1: number; l2: number },
  b: { addressIndex: number; l1: number; l2: number },
): boolean {
  return a.addressIndex === b.addressIndex && a.l1 === b.l1 && a.l2 === b.l2;
}

export class P2PQuorumLeaseProvider implements WotsLeaseProvider {
  private readonly peers: QuorumPeer[];
  private readonly minAttestations: number;
  private readonly local: LocalLeaseProvider;
  private readonly requestTimeoutMs: number;
  private readonly requireQuorumOnCommit: boolean;
  private _initialized = false;

  constructor(config: P2PQuorumLeaseProviderConfig) {
    this.peers = config.peers;
    this.minAttestations = config.minAttestations ?? 1;
    this.local = config.local;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 5_000;
    this.requireQuorumOnCommit = config.requireQuorumOnCommit ?? false;
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    await this.local.initialize();
    this._initialized = true;
  }

  private async ensureInit(): Promise<void> {
    if (!this._initialized) await this.initialize();
  }

  // -------------------------------------------------------------------------
  // Reserve — local first, then quorum attestation
  // -------------------------------------------------------------------------

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    await this.ensureInit();

    // 1. Local reservation (authoritative, monotonic watermark).
    const reservation = await this.local.reserveKeyUse(params);

    // 2. Collect attestations from peers for the SAME indices.
    //    On failure the local reservation is burned — the slot is never reused.
    let attestations: QuorumAttestation[];
    try {
      attestations = await this.attestKeyUse(params, reservation.indices);
    } catch (err) {
      const reason = err instanceof QuorumConflictError
        ? `quorum conflict: ${err.message}`
        : 'quorum not reached';
      await this.local.burnReservation(reservation.reservationId, reason);
      throw err;
    }

    const certificate: LeaseCertificate = {
      reservationId: reservation.reservationId,
      treeId: params.treeId,
      branchId: params.branchId,
      deviceId: params.deviceId,
      indices: reservation.indices,
      purpose: params.purpose,
      payloadHash: params.payloadHash,
      issuedBy: 'p2p-quorum',
      issuedAt: Date.now(),
      expiresAt: reservation.expiresAt,
      signature: '',
      attestations,
    };

    return { ...reservation, certificate };
  }

  /**
   * Collect quorum attestations for a reservation that was already made
   * locally (used by HybridLeaseProvider so the local slot and the attested
   * slot are the same). Throws QuorumUnavailableError / QuorumConflictError
   * on failure — the caller owns the local reservation and must burn it.
   */
  async attestKeyUse(
    params: ReserveParams,
    indices: { addressIndex: number; l1: number; l2: number },
  ): Promise<QuorumAttestation[]> {
    await this.ensureInit();

    const attestations: QuorumAttestation[] = [];
    const conflicts: string[] = [];

    await Promise.all(
      this.peers.map(async (peer) => {
        try {
          const resp = await peer.request(
            {
              type: 'LEASE_RESERVE',
              payload: {
                treeId: params.treeId,
                branchId: params.branchId,
                deviceId: params.deviceId,
                ttlMs: params.ttlMs,
                payloadHash: params.payloadHash,
                purpose: params.purpose,
                indices,
              },
            },
            this.requestTimeoutMs,
          );

          if (resp.type === 'ERROR') {
            conflicts.push(String((resp.payload as { message?: string }).message ?? 'peer error'));
            return;
          }

          const body = resp.payload as PeerReserveResponse;
          const peerIndices = body.reservation?.indices;
          if (!peerIndices || !sameIndices(peerIndices, indices)) {
            conflicts.push('peer returned mismatched indices');
            return;
          }

          attestations.push({
            peerId: peer.peerId,
            indices,
            expiresAt: body.reservation?.expiresAt ?? Date.now() + (params.ttlMs ?? 120_000),
          });
        } catch {
          // Peer unreachable — counted as no attestation.
        }
      }),
    );

    if (conflicts.length > 0) {
      throw new QuorumConflictError(params.treeId, indices);
    }

    if (attestations.length < this.minAttestations) {
      throw new QuorumUnavailableError(this.minAttestations, attestations.length);
    }

    return attestations;
  }

  // -------------------------------------------------------------------------
  // Commit / burn — local authoritative, broadcast to peers
  // -------------------------------------------------------------------------

  async commitKeyUse(reservationId: string, txId: string): Promise<void> {
    await this.ensureInit();
    await this.local.commitKeyUse(reservationId, txId);

    const acks = await this.broadcastAck('LEASE_COMMIT', { reservationId, txId });
    if (this.requireQuorumOnCommit && acks < this.minAttestations) {
      throw new QuorumUnavailableError(this.minAttestations, acks);
    }
  }

  async burnReservation(reservationId: string, reason: string): Promise<void> {
    await this.ensureInit();
    await this.local.burnReservation(reservationId, reason);
    await this.broadcastAck('LEASE_BURN', { reservationId, reason });
  }

  private async broadcastAck(
    type: 'LEASE_COMMIT' | 'LEASE_BURN',
    payload: Record<string, unknown>,
  ): Promise<number> {
    let acks = 0;
    await Promise.all(
      this.peers.map(async (peer) => {
        try {
          const resp = await peer.request({ type, payload }, this.requestTimeoutMs);
          if (resp.type !== 'ERROR') acks++;
        } catch {
          // Peer unreachable — no ack.
        }
      }),
    );
    return acks;
  }

  // -------------------------------------------------------------------------
  // Watermark / journal
  // -------------------------------------------------------------------------

  async getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    await this.ensureInit();
    return this.local.getLocalWatermark(treeId);
  }

  async publishWatermark(treeId: string): Promise<void> {
    await this.ensureInit();
    const wm = await this.local.getLocalWatermark(treeId);
    await Promise.all(
      this.peers.map(async (peer) => {
        try {
          await peer.request(
            {
              type: 'LEASE_WATERMARK',
              payload: {
                treeId,
                addressCursor: wm.addressCursor,
                l1Cursor: wm.l1Cursor,
                l2Cursor: wm.l2Cursor,
                unavailableCount: wm.unavailableCount,
                lastSyncTimestamp: wm.lastSyncTimestamp ?? Date.now(),
              },
            },
            this.requestTimeoutMs,
          );
        } catch {
          // Peer unreachable — watermark publish is best-effort.
        }
      }),
    );
  }

  async syncLeaseJournal(): Promise<SyncResult> {
    await this.ensureInit();
    const conflicts: SyncResult['conflicts'] = [];
    let advancedTo: SyncResult['advancedTo'];

    for (const treeId of this.local.listTrees()) {
      const localWm = await this.local.getLocalWatermark(treeId);
      for (const peer of this.peers) {
        try {
          const resp = await peer.request(
            {
              type: 'LEASE_WATERMARK',
              payload: { treeId, query: true },
            },
            this.requestTimeoutMs,
          );
          if (resp.type === 'ERROR') continue;
          const p = resp.payload as {
            addressCursor?: number;
            l1Cursor?: number;
            l2Cursor?: number;
          };
          if (typeof p.addressCursor !== 'number') continue;

          const remoteFlat =
            p.addressCursor * 64 * 64 + p.l1Cursor! * 64 + p.l2Cursor!;
          const localFlat =
            localWm.addressCursor * 64 * 64 + localWm.l1Cursor * 64 + localWm.l2Cursor;

          if (remoteFlat > localFlat) {
            const advanced = await this.local.advanceToRemoteWatermark(treeId, {
              addressCursor: p.addressCursor,
              l1Cursor: p.l1Cursor!,
              l2Cursor: p.l2Cursor!,
            });
            if (advanced) {
              advancedTo = {
                addressIndex: p.addressCursor,
                l1: p.l1Cursor!,
                l2: p.l2Cursor!,
              };
            }
          } else if (remoteFlat < localFlat) {
            conflicts.push({
              treeId,
              localIndex: localFlat,
              remoteIndex: remoteFlat,
              timestamp: Date.now(),
            });
          }
        } catch {
          // Peer unreachable — skip.
        }
      }
    }

    return { synced: conflicts.length === 0, conflicts, advancedTo };
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (!cert) return false;
    if (cert.expiresAt <= Date.now()) return false;
    const attestations = cert.attestations ?? [];
    if (attestations.length < this.minAttestations) return false;
    return attestations.every(
      (a) =>
        sameIndices(a.indices, cert.indices) &&
        a.expiresAt > Date.now(),
    );
  }
}

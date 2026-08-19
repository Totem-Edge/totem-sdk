/**
 * HybridLeaseProvider — recommended production default.
 *
 * Always uses local first, then gates on node cert and/or quorum attestation
 * for transactions above a configurable value threshold.
 */

import type {
  WotsLeaseProvider,
  ReserveParams,
  LeaseReservation,
  LeaseCertificate,
  LocalWatermark,
  SyncResult,
} from './types.js';
import type { LocalLeaseProvider } from './local.js';
import type { PersonalLeaseNodeProvider } from './stubs.js';
import type { P2PQuorumLeaseProvider } from './stubs.js';
import type { OnchainWatermarkProvider } from './stubs.js';

export interface HybridLeaseProviderConfig {
  local: LocalLeaseProvider;
  node?: PersonalLeaseNodeProvider;
  quorum?: P2PQuorumLeaseProvider;
  onchain?: OnchainWatermarkProvider;
  threshold?: number;
}

export class HybridLeaseProvider implements WotsLeaseProvider {
  private readonly local: LocalLeaseProvider;
  private readonly node?: PersonalLeaseNodeProvider;
  private readonly quorum?: P2PQuorumLeaseProvider;
  private readonly onchain?: OnchainWatermarkProvider;
  private readonly threshold: number;

  constructor(config: HybridLeaseProviderConfig) {
    this.local = config.local;
    this.node = config.node;
    this.quorum = config.quorum;
    this.onchain = config.onchain;
    this.threshold = config.threshold ?? Infinity;
  }

  private isHighValue(params: ReserveParams): boolean {
    if (!params.valueHint) return false;
    const val = parseFloat(params.valueHint);
    return !isNaN(val) && val >= this.threshold;
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    const reservation = await this.local.reserveKeyUse(params);

    if (this.isHighValue(params)) {
      // Layer 4 — quorum attestation over the SAME local slot.
      if (this.quorum) {
        try {
          const attestations = await this.quorum.attestKeyUse(params, reservation.indices);
          return {
            ...reservation,
            certificate: {
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
            },
          };
        } catch {
          // Quorum unavailable — fall through to node / local only.
        }
      }

      // Layer 3 — personal lookup node certificate.
      if (this.node) {
        try {
          const nodeReservation = await this.node.reserveKeyUse(params);
          return { ...reservation, certificate: nodeReservation.certificate };
        } catch {
          // Node unavailable — continue with local only
        }
      }
    }

    return reservation;
  }

  commitKeyUse(reservationId: string, txId: string): Promise<void> {
    return this.local.commitKeyUse(reservationId, txId);
  }

  burnReservation(reservationId: string, reason: string): Promise<void> {
    return this.local.burnReservation(reservationId, reason);
  }

  getLocalWatermark(treeId: string): Promise<LocalWatermark> {
    return this.local.getLocalWatermark(treeId);
  }

  publishWatermark(treeId: string): Promise<void> {
    if (this.node) {
      return this.node.publishWatermark(treeId).catch(() => this.local.publishWatermark(treeId));
    }
    return this.local.publishWatermark(treeId);
  }

  syncLeaseJournal(): Promise<SyncResult> {
    if (this.node) {
      return this.node.syncLeaseJournal().catch(() => this.local.syncLeaseJournal());
    }
    return this.local.syncLeaseJournal();
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (!cert) return this.local.verifyLeaseCertificate(cert);
    if (this.node) return this.node.verifyLeaseCertificate(cert);
    return false;
  }
}

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
  CertificateSigner,
} from './types.js';
import type { LocalLeaseProvider } from './local.js';
import type { PersonalLeaseNodeProvider } from './stubs.js';
import type { P2PQuorumLeaseProvider } from './stubs.js';
import type { OnchainWatermarkProvider } from './stubs.js';
import { signCertificate, certificateSignatureVerified } from './certificate.js';

export interface HybridLeaseProviderConfig {
  local: LocalLeaseProvider;
  node?: PersonalLeaseNodeProvider;
  quorum?: P2PQuorumLeaseProvider;
  onchain?: OnchainWatermarkProvider;
  threshold?: number;
  /** Identity that authenticates locally-assembled quorum certificates. */
  certificateSigner?: CertificateSigner;
}

export class HybridLeaseProvider implements WotsLeaseProvider {
  private readonly local: LocalLeaseProvider;
  private readonly node?: PersonalLeaseNodeProvider;
  private readonly quorum?: P2PQuorumLeaseProvider;
  private readonly onchain?: OnchainWatermarkProvider;
  private readonly threshold: number;
  private readonly certificateSigner?: CertificateSigner;

  constructor(config: HybridLeaseProviderConfig) {
    this.local = config.local;
    this.node = config.node;
    this.quorum = config.quorum;
    this.onchain = config.onchain;
    this.threshold = config.threshold ?? Infinity;
    this.certificateSigner = config.certificateSigner;
  }

  private isHighValue(params: ReserveParams): boolean {
    if (!params.valueHint) return false;
    const val = parseFloat(params.valueHint);
    return !isNaN(val) && val >= this.threshold;
  }

  async reserveKeyUse(params: ReserveParams): Promise<LeaseReservation> {
    // Cross-instance/restore safety (RFC-013 §8/§9): before a high-value
    // reservation, anchor the local cursor to the on-chain watermark so a second
    // instance of the same seed cannot be handed a leaf we already used.
    if (this.isHighValue(params) && this.onchain) {
      try {
        await this.onchain.syncLeaseJournal();
      } catch {
        // Chain unreachable — local monotonic watermark still guards reuse.
      }
    }

    const reservation = await this.local.reserveKeyUse(params);

    if (this.isHighValue(params)) {
      // Layer 4 — quorum attestation over the SAME local slot.
      if (this.quorum) {
        try {
          const attestations = await this.quorum.attestKeyUse(params, reservation.indices);
          const certificate: LeaseCertificate = {
            reservationId: reservation.reservationId,
            treeId: params.treeId,
            branchId: params.branchId,
            deviceId: params.deviceId,
            indices: reservation.indices,
            purpose: params.purpose,
            payloadHash: params.payloadHash,
            issuedBy: this.certificateSigner?.name ?? 'p2p-quorum',
            issuedAt: Date.now(),
            expiresAt: reservation.expiresAt,
            signature: '',
            attestations,
          };
          certificate.signature = this.certificateSigner
            ? await signCertificate(this.certificateSigner, certificate)
            : '';
          return { ...reservation, certificate };
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

  async publishWatermark(treeId: string): Promise<void> {
    // Anchor to the chain first (authoritative cross-instance cursor), then the
    // personal node, then the local no-op.
    if (this.onchain) {
      try {
        await this.onchain.publishWatermark(treeId);
        return;
      } catch {
        // fall through
      }
    }
    if (this.node) {
      try {
        await this.node.publishWatermark(treeId);
        return;
      } catch {
        // fall through
      }
    }
    await this.local.publishWatermark(treeId);
  }

  async syncLeaseJournal(): Promise<SyncResult> {
    // Read the authoritative on-chain cursor first so a restore/second instance
    // advances past every leaf published by anyone holding this seed.
    if (this.onchain) {
      try {
        return await this.onchain.syncLeaseJournal();
      } catch {
        // fall through
      }
    }
    if (this.node) {
      try {
        return await this.node.syncLeaseJournal();
      } catch {
        // fall through
      }
    }
    return this.local.syncLeaseJournal();
  }

  async verifyLeaseCertificate(cert?: LeaseCertificate): Promise<boolean> {
    if (!cert) return this.local.verifyLeaseCertificate(cert);
    // Locally-assembled quorum certificates authenticate against our issuer.
    if (cert.issuedBy === (this.certificateSigner?.name ?? 'p2p-quorum')) {
      return certificateSignatureVerified(cert, this.certificateSigner);
    }
    if (this.node) return this.node.verifyLeaseCertificate(cert);
    return false;
  }
}

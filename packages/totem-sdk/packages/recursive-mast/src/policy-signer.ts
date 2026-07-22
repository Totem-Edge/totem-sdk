/**
 * Policy Signer interface — WOTS-aware signing with lease integration.
 *
 * Manifests, branch packages, signing requests and responses all consume
 * one-time WOTS keys. This interface integrates with @totemsdk/wots-lease
 * to prevent key-index reuse.
 */

import type { BlockHeight, UnixTimeMs } from './branded-types.js';

export type SigningDomain =
  | 'policy-manifest'
  | 'branch-package'
  | 'signing-request'
  | 'signing-response'
  | 'evidence'
  | 'availability-receipt';

export interface PolicySigner {
  address: string;

  signDomainSeparated(
    domain: SigningDomain,
    payload: Uint8Array,
  ): Promise<PolicySignature>;

  getPublicKey(): Promise<string>;

  reserveKey?(): Promise<{
    keyIndex: number;
    leaseReceipt: string;
  }>;

  commitKey?(leaseReceipt: string): Promise<void>;

  burnKey?(leaseReceipt: string, reason: string): Promise<void>;
}

export interface PolicySignature {
  signature: string;
  publicKey: string;
  keyIndex: number;
  leaseReceipt: string;
  signedAt: UnixTimeMs;
}

export interface PolicySignerConfig {
  wotsLeaseProvider?: {
    reserveKeyUse(params: {
      treeId: string;
      branchId?: string;
      deviceId?: string;
      ttlMs?: number;
      payloadHash?: string;
      purpose?: string;
    }): Promise<{
      reservationId: string;
      indices: { l1: number; l2: number; l3: number };
      publicKey: string;
    }>;

    commitReservation(reservationId: string, txId: string): Promise<void>;

    burnReservation(reservationId: string, reason: string): Promise<void>;
  };

  signFn: (data: Uint8Array, keyIndex: number) => Promise<Uint8Array>;

  publicKeyHex: string;
  address: string;
  treeId: string;
}

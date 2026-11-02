/**
 * @totemsdk/tx-builder/signer
 *
 * Structural signing and WOTS-lease helpers. tx-builder never holds keys; the
 * caller supplies a signer (extension, local WOTS key, or a leased signer).
 */

import type { ExternalSignature } from '@totemsdk/core/scripts';
import {
  buildTransaction,
  serializeWitness,
  serializeForTxnImport,
  type EnhancedBuildResult,
  type WotsSignatureData,
} from './build.js';
import type { EnhancedBuildParams } from './enhanced-types.js';

export interface SigningIndices {
  addressIndex: number;
  l1: number;
  l2: number;
}

export interface LeaseReservationLike {
  reservationId: string;
  indices: SigningIndices;
  expiresAt: number;
}

/** Structural subset of `@totemsdk/wots-lease`'s `WotsLeaseProvider`. */
export interface SigningLease {
  reserveKeyUse(params: {
    treeId: string;
    branchId?: string;
    purpose?: string;
    deviceId?: string;
    ttlMs?: number;
    payloadHash?: string;
    valueHint?: string;
  }): Promise<LeaseReservationLike>;
  commitKeyUse(reservationId: string, txId: string): Promise<void>;
  burnReservation(reservationId: string, reason: string): Promise<void>;
}

export interface SignerOutput {
  wotsData?: WotsSignatureData;
  externalSignatures?: ExternalSignature[];
}

/** Sign the exact transaction digest. */
export interface TransactionSigner {
  sign(digestHex: string): Promise<SignerOutput>;
}

export interface SignedTransaction {
  built: EnhancedBuildResult;
  witness: Uint8Array;
  txnRow: Uint8Array;
  digestHex: string;
  txId: string;
}

/**
 * Build the transaction, sign its digest, assemble the witness, and serialize a
 * TxnRow for `txnimport`/broadcast.
 */
export async function signAndSerialize(
  params: EnhancedBuildParams,
  signer: TransactionSigner,
  txId: string,
): Promise<SignedTransaction> {
  const built = buildTransaction(params);
  const signature = await signer.sign(built.digestTxHex);
  const witness = serializeWitness(
    signature.wotsData,
    built.coinProofsHex,
    built.scriptDescriptors,
    built.extraScripts,
    signature.externalSignatures,
  );
  return {
    built,
    witness,
    txnRow: serializeForTxnImport(txId, built.transaction, witness),
    digestHex: built.digestTxHex,
    txId,
  };
}

/** Reserve a WOTS leaf for a digest. */
export async function reserveSigningIndices(
  lease: SigningLease,
  params: {
    treeId: string;
    branchId?: string;
    digestHex: string;
    ttlMs?: number;
    purpose?: string;
  },
): Promise<LeaseReservationLike> {
  return lease.reserveKeyUse({
    treeId: params.treeId,
    branchId: params.branchId,
    purpose: params.purpose ?? 'tx-builder',
    ttlMs: params.ttlMs,
    payloadHash: params.digestHex,
  });
}

/** Mark a reservation as used after the transaction is accepted. */
export async function commitSigningReservation(
  lease: SigningLease,
  reservationId: string,
  txId: string,
): Promise<void> {
  await lease.commitKeyUse(reservationId, txId);
}

/** Return an unused reservation to the pool. */
export async function releaseSigningReservation(
  lease: SigningLease,
  reservationId: string,
  reason = 'released',
): Promise<void> {
  await lease.burnReservation(reservationId, reason);
}

/**
 * Convenience: reserve → sign with the supplied local WOTS callback → return
 * the reservation so the caller can commit it after broadcast.
 */
export async function signWithLease(params: {
  lease: SigningLease;
  treeId: string;
  branchId?: string;
  digestHex: string;
  sign: (digestHex: string, indices: SigningIndices) => Promise<WotsSignatureData>;
}): Promise<{ wotsData: WotsSignatureData; reservation: LeaseReservationLike }> {
  const reservation = await reserveSigningIndices(params.lease, {
    treeId: params.treeId,
    branchId: params.branchId,
    digestHex: params.digestHex,
  });
  try {
    const wotsData = await params.sign(params.digestHex, reservation.indices);
    return { wotsData, reservation };
  } catch (error) {
    await releaseSigningReservation(params.lease, reservation.reservationId, 'sign_failed').catch(
      () => undefined,
    );
    throw error;
  }
}

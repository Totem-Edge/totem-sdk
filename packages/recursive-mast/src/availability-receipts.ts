/**
 * Availability receipts — cryptographically signed attestations that
 * a custodian holds specific policy material.
 *
 * A receipt proves:
 *   1. The custodian controls the declared identity
 *   2. The custodian held the material at a specific time
 *   3. The material matches the committed hashes
 *
 * Receipts are domain-separated and use canonical encoding for
 * cross-implementation verifiability.
 */

import { sha3_256, bytesToHex } from '@totemsdk/core';
import { canonicalHash, canonicalSign, canonicalVerify, type EncodingDomain } from './canonical-encoding.js';
import type { BranchInventory } from './branch-inventory.js';

export interface AvailabilityReceipt {
  receiptId: string;
  custodianIdentityId: string;
  policyId: string;
  policyVersion: number;
  policyEpoch: number;
  policyRoot: string;
  manifestDigest: string;
  branchHashes: string[];
  inventoryDigest?: string;
  timestamp: number;
  expiresAt: number;
  custodianSignature?: string;
  custodianPkd?: string;
}

export function createAvailabilityReceipt(config: {
  custodianIdentityId: string;
  policyId: string;
  policyVersion: number;
  policyEpoch: number;
  policyRoot: string;
  manifestDigest: string;
  branchHashes: string[];
  inventoryDigest?: string;
  validitySeconds?: number;
}): AvailabilityReceipt {
  const now = Math.floor(Date.now() / 1000);
  const receiptId = `avrc-${bytesToHex(sha3_256(new TextEncoder().encode(
    `${config.custodianIdentityId}:${config.policyId}:${config.policyVersion}:${now}`
  ))).slice(0, 16)}`;

  return {
    receiptId,
    custodianIdentityId: config.custodianIdentityId,
    policyId: config.policyId,
    policyVersion: config.policyVersion,
    policyEpoch: config.policyEpoch,
    policyRoot: config.policyRoot,
    manifestDigest: config.manifestDigest,
    branchHashes: [...config.branchHashes].sort(),
    inventoryDigest: config.inventoryDigest,
    timestamp: now,
    expiresAt: now + (config.validitySeconds ?? 86400),
  };
}

export async function signAvailabilityReceipt(
  receipt: AvailabilityReceipt,
  signFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  custodianPkd: string,
): Promise<AvailabilityReceipt> {
  const payload: Record<string, unknown> = {
    receiptId: receipt.receiptId,
    custodianIdentityId: receipt.custodianIdentityId,
    policyId: receipt.policyId,
    policyVersion: receipt.policyVersion,
    policyEpoch: receipt.policyEpoch,
    policyRoot: receipt.policyRoot,
    manifestDigest: receipt.manifestDigest,
    branchHashes: receipt.branchHashes,
    inventoryDigest: receipt.inventoryDigest ?? null,
    timestamp: receipt.timestamp,
    expiresAt: receipt.expiresAt,
  };

  const sigBytes = await canonicalSign('AVRC' as EncodingDomain, payload, signFn);

  return {
    ...receipt,
    custodianSignature: bytesToHex(sigBytes),
    custodianPkd,
  };
}

export async function verifyAvailabilityReceipt(
  receipt: AvailabilityReceipt,
  verifyFn: (data: Uint8Array, sig: Uint8Array) => boolean | Promise<boolean>,
): Promise<{ valid: boolean; reason?: string }> {
  if (!receipt.custodianSignature || !receipt.custodianPkd) {
    return { valid: false, reason: 'Receipt is not signed' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > receipt.expiresAt) {
    return { valid: false, reason: 'Receipt has expired' };
  }

  const payload: Record<string, unknown> = {
    receiptId: receipt.receiptId,
    custodianIdentityId: receipt.custodianIdentityId,
    policyId: receipt.policyId,
    policyVersion: receipt.policyVersion,
    policyEpoch: receipt.policyEpoch,
    policyRoot: receipt.policyRoot,
    manifestDigest: receipt.manifestDigest,
    branchHashes: receipt.branchHashes,
    inventoryDigest: receipt.inventoryDigest ?? null,
    timestamp: receipt.timestamp,
    expiresAt: receipt.expiresAt,
  };

  const sigBytes = new Uint8Array(
    receipt.custodianSignature.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [],
  );

  const valid = await canonicalVerify('AVRC' as EncodingDomain, payload, sigBytes, verifyFn);

  if (!valid) {
    return { valid: false, reason: 'Signature verification failed' };
  }

  return { valid: true };
}

export function receiptCoversBranch(receipt: AvailabilityReceipt, scriptHash: string): boolean {
  return receipt.branchHashes.includes(scriptHash);
}

export function receiptCoversInventory(receipt: AvailabilityReceipt, inventory: BranchInventory): boolean {
  if (!receipt.inventoryDigest) return false;
  const expectedDigest = bytesToHex(sha3_256(new TextEncoder().encode(
    JSON.stringify(inventory.branches.map(b => b.scriptHash).sort())
  )));
  return receipt.inventoryDigest === expectedDigest;
}

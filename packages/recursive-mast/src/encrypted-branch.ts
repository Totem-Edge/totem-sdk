/**
 * Encrypted branch support — private policy branches for recursive MAST.
 *
 * Not every branch should be public. Theft recovery, emergency override,
 * and regulator succession procedures may be restricted. A branch package
 * can be encrypted while its script hash remains committed on-chain.
 *
 * Public (always visible):
 *   - branch hash (scriptHash)
 *   - policy root
 *   - basic role metadata
 *   - encrypted package reference
 *
 * Authorized recipient (after decryption):
 *   - decryption key
 *   - script
 *   - proof
 *   - detailed instructions
 *
 * The transaction eventually reveals any script it executes, but the
 * branch does not have to be publicly available beforehand.
 */

import { sha3_256, bytesToHex, hexToBytes } from '@totemsdk/core';
import type { MastBranchPackage } from './branch-capsule.js';

export interface EncryptedBranchPackage {
  policyId: string;
  policyRoot: string;
  policyVersion: number;
  policyEpoch: number;

  scriptHash: string;
  action: string;
  role?: string;

  encryptedPayload: Uint8Array;
  encryptionKeyFingerprint: string;
  recipientPkds: string[];

  validFrom: number;
  expiresAt?: number;

  publisherIdentityId: string;
  publisherSignature: string;
}

export interface DecryptedBranchResult {
  branch: MastBranchPackage;
  keyFingerprint: string;
}

export async function createEncryptedBranch(
  branch: MastBranchPackage,
  encryptFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  keyFingerprint: string,
  recipientPkds: string[],
): Promise<EncryptedBranchPackage> {
  const branchBytes = new TextEncoder().encode(JSON.stringify({
    script: branch.script,
    proof: bytesToHex(branch.proof),
    childRoots: branch.childRoots,
    evidenceRequirements: branch.evidenceRequirements,
  }));

  const encResult = await encryptFn(branchBytes);
  const encryptedPayload = encResult instanceof Uint8Array ? encResult : encResult;

  return {
    policyId: branch.policyId,
    policyRoot: branch.policyRoot,
    policyVersion: branch.policyVersion,
    policyEpoch: branch.policyEpoch,
    scriptHash: branch.scriptHash,
    action: branch.action,
    role: branch.role,
    encryptedPayload,
    encryptionKeyFingerprint: keyFingerprint,
    recipientPkds,
    validFrom: branch.validFrom,
    expiresAt: branch.expiresAt,
    publisherIdentityId: branch.publisherIdentityId,
    publisherSignature: branch.publisherSignature,
  };
}

export async function decryptBranch(
  encrypted: EncryptedBranchPackage,
  decryptFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  keyFingerprint: string,
): Promise<DecryptedBranchResult> {
  const decResult = await decryptFn(encrypted.encryptedPayload);
  const decryptedBytes = decResult instanceof Uint8Array ? decResult : decResult;

  const inner = JSON.parse(new TextDecoder().decode(decryptedBytes)) as {
    script: string;
    proof: string;
    childRoots?: string[];
    evidenceRequirements?: string[];
  };

  const branch: MastBranchPackage = {
    policyId: encrypted.policyId,
    policyRoot: encrypted.policyRoot,
    policyVersion: encrypted.policyVersion,
    policyEpoch: encrypted.policyEpoch,
    script: inner.script,
    scriptHash: encrypted.scriptHash,
    proof: hexToBytes(inner.proof),
    action: encrypted.action,
    role: encrypted.role,
    childRoots: inner.childRoots,
    evidenceRequirements: inner.evidenceRequirements,
    validFrom: encrypted.validFrom,
    expiresAt: encrypted.expiresAt,
    publisherIdentityId: encrypted.publisherIdentityId,
    publisherSignature: encrypted.publisherSignature,
  };

  return {
    branch,
    keyFingerprint,
  };
}

export function isEncryptedBranch(obj: unknown): obj is EncryptedBranchPackage {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.encryptedPayload === 'object' &&
    typeof o.encryptionKeyFingerprint === 'string' &&
    typeof o.scriptHash === 'string';
}

export function encryptedBranchPublicMetadata(encrypted: EncryptedBranchPackage): {
  scriptHash: string;
  policyRoot: string;
  action: string;
  role?: string;
  encryptionKeyFingerprint: string;
  recipientPkds: string[];
  validFrom: number;
  expiresAt?: number;
} {
  return {
    scriptHash: encrypted.scriptHash,
    policyRoot: encrypted.policyRoot,
    action: encrypted.action,
    role: encrypted.role,
    encryptionKeyFingerprint: encrypted.encryptionKeyFingerprint,
    recipientPkds: encrypted.recipientPkds,
    validFrom: encrypted.validFrom,
    expiresAt: encrypted.expiresAt,
  };
}

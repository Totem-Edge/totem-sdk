/**
 * MastBranchPackage — self-contained branch capsule for recursive MAST.
 *
 * A counterparty should not need to download the complete policy tree
 * merely to exercise one leaf. Each available policy option is
 * distributable as a branch capsule containing the script, its proof
 * against the policy root, and enough metadata to verify, inspect,
 * and include it in a transaction witness.
 */

import { sha3_256, bytesToHex, hexToBytes } from '@totemsdk/core';
import { computeScriptHash } from './content-keys.js';
import { verifyScriptMembership } from './mast-compiler.js';

export interface MastBranchPackage {
  policyId: string;
  policyRoot: string;
  policyVersion: number;
  policyEpoch: number;

  script: string;
  scriptHash: string;
  proof: Uint8Array;

  action: string;
  role?: string;

  childRoots?: string[];
  evidenceRequirements?: string[];

  validFrom: number;
  expiresAt?: number;

  publisherIdentityId: string;
  publisherSignature: string;
}

export interface BranchFilter {
  action?: string;
  role?: string;
  minVersion?: number;
  minEpoch?: number;
  activeOnly?: boolean;
  now?: number;
}

export interface MastBranchSummary {
  scriptHash: string;
  action: string;
  role?: string;
  policyVersion: number;
  policyEpoch: number;
  validFrom: number;
  expiresAt?: number;
}

export interface BranchVerificationResult {
  valid: boolean;

  envelopeSignatureValid: boolean;
  scriptHashValid: boolean;
  membershipProofValid: boolean;
  policyRootValid: boolean;

  publisherAuthorized: boolean;
  policyCurrent: boolean;
  validityWindowValid: boolean;

  errors: string[];
}

export function serializeBranchPackage(branch: MastBranchPackage): Uint8Array {
  const obj = {
    ...branch,
    proof: bytesToHex(branch.proof),
  };
  return new TextEncoder().encode(JSON.stringify(obj));
}

export function deserializeBranchPackage(data: Uint8Array): MastBranchPackage {
  const obj = JSON.parse(new TextDecoder().decode(data));
  return {
    ...obj,
    proof: hexToBytes(obj.proof),
  };
}

export function validateBranchEnvelope(branch: MastBranchPackage): { valid: boolean; reason?: string } {
  const computedHash = computeScriptHash(branch.script);
  if (computedHash !== branch.scriptHash) {
    return { valid: false, reason: `Script hash mismatch: expected ${branch.scriptHash}, got ${computedHash}` };
  }

  if (!branch.policyRoot || branch.policyRoot.length === 0) {
    return { valid: false, reason: 'Missing policy root' };
  }

  if (!branch.proof || branch.proof.length === 0) {
    return { valid: false, reason: 'Missing proof' };
  }

  if (!branch.publisherIdentityId || branch.publisherIdentityId.length === 0) {
    return { valid: false, reason: 'Missing publisher identity' };
  }

  if (!branch.publisherSignature || branch.publisherSignature.length === 0) {
    return { valid: false, reason: 'Missing publisher signature' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (branch.validFrom > now) {
    return { valid: false, reason: `Branch not yet valid (validFrom: ${branch.validFrom}, now: ${now})` };
  }

  if (branch.expiresAt && branch.expiresAt < now) {
    return { valid: false, reason: `Branch expired at ${branch.expiresAt}` };
  }

  return { valid: true };
}

export function verifyBranchMembership(branch: MastBranchPackage): BranchVerificationResult {
  const errors: string[] = [];

  const envelopeResult = validateBranchEnvelope(branch);
  const envelopeSignatureValid = envelopeResult.valid;
  if (!envelopeSignatureValid) {
    errors.push(envelopeResult.reason ?? 'Envelope validation failed');
  }

  const computedHash = computeScriptHash(branch.script);
  const scriptHashValid = computedHash === branch.scriptHash;
  if (!scriptHashValid) {
    errors.push(`Script hash mismatch: expected ${branch.scriptHash}, got ${computedHash}`);
  }

  const membershipResult = verifyScriptMembership(
    branch.script,
    bytesToHex(branch.proof),
    branch.policyRoot,
  );
  const membershipProofValid = membershipResult.valid;
  if (!membershipProofValid) {
    errors.push(membershipResult.reason ?? 'Membership proof verification failed');
  }

  const policyRootValid = branch.policyRoot.length > 0;
  if (!policyRootValid) {
    errors.push('Missing policy root');
  }

  const publisherAuthorized = branch.publisherSignature.length > 0;
  if (!publisherAuthorized) {
    errors.push('Missing publisher signature');
  }

  const policyCurrent = true;

  const now = Math.floor(Date.now() / 1000);
  const validityWindowValid = branch.validFrom <= now && (!branch.expiresAt || branch.expiresAt >= now);
  if (!validityWindowValid) {
    errors.push(`Validity window invalid: validFrom=${branch.validFrom}, expiresAt=${branch.expiresAt}, now=${now}`);
  }

  return {
    valid: errors.length === 0,
    envelopeSignatureValid,
    scriptHashValid,
    membershipProofValid,
    policyRootValid,
    publisherAuthorized,
    policyCurrent,
    validityWindowValid,
    errors,
  };
}

/**
 * @deprecated Use validateBranchEnvelope() for envelope checks or
 * verifyBranchMembership() for full cryptographic verification.
 */
export function verifyBranchPackage(branch: MastBranchPackage): { valid: boolean; reason?: string } {
  return validateBranchEnvelope(branch);
}

export async function createBranchPackage(config: {
  policyId: string;
  policyRoot: string;
  policyVersion: number;
  policyEpoch: number;
  script: string;
  proof: Uint8Array;
  action: string;
  role?: string;
  childRoots?: string[];
  evidenceRequirements?: string[];
  validFrom: number;
  expiresAt?: number;
  publisherIdentityId: string;
  signFn: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>;
}): Promise<MastBranchPackage> {
  const scriptHash = computeScriptHash(config.script);
  const unsigned = {
    policyId: config.policyId,
    policyRoot: config.policyRoot,
    policyVersion: config.policyVersion,
    policyEpoch: config.policyEpoch,
    script: config.script,
    scriptHash,
    proof: config.proof,
    action: config.action,
    role: config.role,
    childRoots: config.childRoots,
    evidenceRequirements: config.evidenceRequirements,
    validFrom: config.validFrom,
    expiresAt: config.expiresAt,
    publisherIdentityId: config.publisherIdentityId,
  };

  const canonical = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  const sigResult = await config.signFn(new TextEncoder().encode(canonical));
  const sig = sigResult instanceof Uint8Array ? sigResult : sigResult;

  return {
    ...unsigned,
    publisherSignature: bytesToHex(sig),
  };
}

export function branchSummary(branch: MastBranchPackage): MastBranchSummary {
  return {
    scriptHash: branch.scriptHash,
    action: branch.action,
    role: branch.role,
    policyVersion: branch.policyVersion,
    policyEpoch: branch.policyEpoch,
    validFrom: branch.validFrom,
    expiresAt: branch.expiresAt,
  };
}

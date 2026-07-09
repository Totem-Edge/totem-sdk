/**
 * Proof lifecycle: create, sign, verify.
 *
 * signProof: computes a WOTS signature over the canonical JSON of the UnsignedProof.
 * verifyProofSignature: recomputes the digest from unsigned fields — NOT from
 *   signature.message (which is optional debug metadata only).
 * verifyProofPayload: checks expiry only.
 * verifyProof: combined check returning ProofVerifyResult.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import {
  wotsSign,
  wotsKeypairFromSeed,
  wotsAddressFromKeypair,
  wotsVerifyDigest,
  hexToBytes,
  bytesToHex,
  scriptFromWotsPk,
  scriptToAddress,
} from '@totemsdk/core';
import { canonicalJson, computeProofId } from './canonical.js';
import type {
  UnsignedProof,
  SignedProof,
  ProofKind,
  ProofSubject,
  EvidenceRef,
  ProofLink,
  ProofVerifyResult,
} from './types.js';

export interface CreateProofParams {
  kind: ProofKind;
  subject: ProofSubject;
  issuer: string;
  issuedAt?: number;
  expiresAt?: number;
  evidence?: EvidenceRef[];
  links?: ProofLink[];
  payload?: Record<string, unknown>;
}

/**
 * Create an UnsignedProof with a computed proofId.
 * Optional fields are only included when provided, keeping the canonical form
 * stable across callers.
 */
export function createProof(params: CreateProofParams): UnsignedProof {
  const core: Omit<UnsignedProof, 'proofId'> = {
    kind: params.kind,
    subject: params.subject,
    issuer: params.issuer,
    issuedAt: params.issuedAt ?? Date.now(),
    ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : {}),
    ...(params.evidence !== undefined && params.evidence.length > 0 ? { evidence: params.evidence } : {}),
    ...(params.links !== undefined && params.links.length > 0 ? { links: params.links } : {}),
    ...(params.payload !== undefined ? { payload: params.payload } : {}),
  };
  const proofId = computeProofId(core);
  return { ...core, proofId };
}

/**
 * Sign an UnsignedProof with a WOTS key.
 * The digest is SHA3-256 of the canonical JSON of the full UnsignedProof
 * (including proofId). signature.message is NOT set — it is optional debug-only.
 *
 * The caller is responsible for reserving the WOTS key index before calling
 * this function. This package does NOT depend on @totemsdk/wots-lease.
 */
export function signProof(
  unsignedProof: UnsignedProof,
  seed: Uint8Array,
  keyIndex: number,
): SignedProof {
  const digest = sha3_256(new TextEncoder().encode(canonicalJson(unsignedProof)));
  const sigBytes = wotsSign(seed, keyIndex, digest);
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  const address = wotsAddressFromKeypair(kp);

  return {
    ...unsignedProof,
    signature: {
      address,
      publicKey: bytesToHex(kp.pk),
      signature: bytesToHex(sigBytes),
    },
  };
}

/**
 * Derive a Minima address from a 32-byte WOTS PKdigest (hex).
 * Returns null if decoding fails.
 */
function addressFromPkDigest(publicKeyHex: string): string | null {
  try {
    const pkDigest = hexToBytes(publicKeyHex);
    const script = scriptFromWotsPk(pkDigest);
    return scriptToAddress(script);
  } catch {
    return null;
  }
}

/**
 * Verify the WOTS signature of a SignedProof.
 *
 * Recomputes the digest from the unsigned proof fields (stripping signature,
 * anchor, rootIdentityProof). Does NOT use signature.message.
 * Also binds signature.address to signature.publicKey to prevent spoofing.
 */
export function verifyProofSignature(signedProof: SignedProof): boolean {
  // anchor and rootIdentityProof are stripped via destructuring so unsignedProof
  // contains only the signed fields. Prefixed with _ to avoid unused-var lint.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature, anchor: _anchor, rootIdentityProof: _rootIdentityProof, ...unsignedProof } = signedProof;

  let sigBytes: Uint8Array;
  let pkDigest: Uint8Array;
  try {
    sigBytes = hexToBytes(signature.signature);
    pkDigest = hexToBytes(signature.publicKey);
  } catch {
    return false;
  }

  const expectedAddress = addressFromPkDigest(signature.publicKey);
  if (expectedAddress === null || expectedAddress !== signature.address) {
    return false;
  }

  const digest = sha3_256(new TextEncoder().encode(canonicalJson(unsignedProof)));

  try {
    return wotsVerifyDigest(sigBytes, digest, pkDigest);
  } catch {
    return false;
  }
}

/**
 * Check the payload constraints of a SignedProof (expiry only).
 * Returns false if expiresAt is in the past.
 */
export function verifyProofPayload(signedProof: SignedProof): boolean {
  if (signedProof.expiresAt !== undefined && Date.now() > signedProof.expiresAt) {
    return false;
  }
  return true;
}

/**
 * Full combined proof verification: signature + payload constraints.
 */
export function verifyProof(
  signedProof: SignedProof,
  _options?: Record<string, unknown>,
): ProofVerifyResult {
  const expired = !verifyProofPayload(signedProof);
  if (expired) {
    return {
      valid: false,
      expired: true,
      reason: 'proof has expired',
      signerAddress: signedProof.signature.address,
    };
  }

  const sigValid = verifyProofSignature(signedProof);
  if (!sigValid) {
    return {
      valid: false,
      reason: 'WOTS signature invalid',
      signerAddress: signedProof.signature.address,
    };
  }

  return {
    valid: true,
    signerAddress: signedProof.signature.address,
  };
}

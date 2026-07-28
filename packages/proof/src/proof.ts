/**
 * Proof lifecycle: create, sign, verify.
 *
 * signProof: computes a WOTS signature over the canonical JSON of the UnsignedProof.
 * verifyProofSignature: recomputes the digest from unsigned fields — NOT from
 *   signature.message (which is optional debug metadata only).
 * verifyProofPayload: checks expiry only.
 * verifyProof: combined check returning ProofVerifyResult.
 */

import { sha3_256, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import {
  wotsSign,
  wotsKeypairFromSeed,
  wotsAddressFromKeypair,
  wotsVerifyDigest,
  hexToBytes,
  bytesToHex,
} from '@totemsdk/core';
import { canonicalJson, computeProofId, toHex } from './canonical.js';
import type {
  UnsignedProof,
  SignedProof,
  ProofKind,
  ProofSubject,
  EvidenceRef,
  ProofLink,
  ProofVerifyResult,
  SigningIndices,
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
  const pkHex = bytesToHex(kp.pk);
  const address = scriptToAddress(scriptFromWotsPk(kp.pk));

  return {
    ...unsignedProof,
    signature: {
      address,
      publicKey: pkHex,
      signature: bytesToHex(sigBytes),
    },
  };
}

/**
 * Flat WOTS key index from 3-level signing indices.
 * Matches @totemsdk/wots-lease's flatIndex() computation so that
 * indices reserved by any WotsLeaseProvider can be passed to signProof.
 */
function flatIndex(indices: SigningIndices): number {
  const MAX_L = 64;
  return indices.addressIndex * MAX_L * MAX_L + indices.l1 * MAX_L + indices.l2;
}

/**
 * Sign an UnsignedProof using a WOTS lease provider to reserve the key index,
 * preventing concurrent-use or restart-reuse of one-time WOTS keys.
 *
 * The lease provider must satisfy a minimal signature compatible with
 * @totemsdk/wots-lease's WotsLeaseProvider. Callers who manage key indices
 * directly should continue using signProof().
 *
 * On success the reservation is committed. On failure it is burned so the
 * index can be marked unavailable rather than silently lost.
 */
export async function signWithLease(
  unsignedProof: UnsignedProof,
  seed: Uint8Array,
  leaseProvider: {
    reserveKeyUse(params: {
      treeId: string;
      ttlMs?: number;
      payloadHash?: string;
    }): Promise<{ reservationId: string; indices: SigningIndices }>;
    commitKeyUse(reservationId: string, txId: string): Promise<void>;
    burnReservation(reservationId: string, reason: string): Promise<void>;
  },
  options?: { treeId?: string; ttlMs?: number },
): Promise<SignedProof> {
  const treeId = options?.treeId ?? 'default';
  const digest = sha3_256(new TextEncoder().encode(canonicalJson(unsignedProof)));
  const payloadHash = toHex(digest);

  const reservation = await leaseProvider.reserveKeyUse({
    treeId,
    ttlMs: options?.ttlMs ?? 60_000,
    payloadHash,
  });

  const keyIndex = flatIndex(reservation.indices);

  try {
    const signed = signProof(unsignedProof, seed, keyIndex);
    await leaseProvider.commitKeyUse(reservation.reservationId, signed.proofId);
    return signed;
  } catch (err) {
    await leaseProvider.burnReservation(
      reservation.reservationId,
      err instanceof Error ? err.message : 'signProof failed',
    );
    throw err;
  }
}

/**
 * Verify that the proofId in a SignedProof matches a recomputation from its
 * unsigned fields. This prevents callers from replacing the proofId after
 * signing and relying on a stale identifier.
 */
export function verifyProofIdIntegrity(signedProof: SignedProof): boolean {
  const { signature: _sig, anchor: _anc, rootIdentityProof: _rip, proofId: _pid, ...unsignedFields } = signedProof;
  const expectedId = computeProofId(unsignedFields);
  return expectedId === signedProof.proofId;
}

/**
 * Verify the WOTS signature of a SignedProof.
 *
 * Recomputes the digest from the unsigned proof fields (stripping signature,
 * anchor, rootIdentityProof). Does NOT use signature.message.
 *
 * Security: cryptographically derives the expected Minima address from the
 * WOTS public-key digest and compares it with the declared signature.address.
 * Rejects the proof when the addresses do not match, preventing an attacker
 * from setting a privileged address while signing with a different key.
 */
export function verifyProofSignature(signedProof: SignedProof): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { signature, anchor: _anchor, rootIdentityProof: _rootIdentityProof, ...unsignedProof } = signedProof;

  // Address/public-key binding check:
  // Derive the expected Minima address from the WOTS public-key digest using
  // the same script-based derivation as signProof (scriptFromWotsPk + scriptToAddress).
  // Reject the proof when the declared address does not match, preventing an
  // attacker from claiming a privileged address while signing with a different key.
  let pkBytes: Uint8Array;
  try {
    pkBytes = hexToBytes(signature.publicKey);
  } catch {
    return false;
  }
  try {
    const expectedAddress = scriptToAddress(scriptFromWotsPk(pkBytes));
    if (expectedAddress !== signature.address) return false;
  } catch {
    return false;
  }

  let sigBytes: Uint8Array;
  let pkDigest: Uint8Array;
  try {
    sigBytes = hexToBytes(signature.signature);
    pkDigest = hexToBytes(signature.publicKey);
  } catch {
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
 * @param graceMs optional tolerance in ms for clock skew (default 0).
 * @param now optional explicit timestamp (ms). When provided, the check is
 *   deterministic and does NOT call Date.now(). If omitted, Date.now() is used.
 */
export function verifyProofPayload(signedProof: SignedProof, graceMs = 0, now?: number): boolean {
  const effectiveNow = now ?? Date.now();
  if (signedProof.expiresAt !== undefined && effectiveNow > signedProof.expiresAt + graceMs) {
    return false;
  }
  return true;
}

/**
 * Full combined proof verification: signature + payload constraints.
 *
 * Checks performed:
 *   1. signature object is present with address, publicKey, signature fields
 *   2. proofId matches a recomputation from the unsigned fields
 *   3. WOTS signature is valid over the canonical unsigned proof
 *   4. expiresAt is not in the past (with configurable graceMs)
 */
export function verifyProof(
  signedProof: SignedProof,
  options?: { graceMs?: number; now?: number },
): ProofVerifyResult {
  const sig = (signedProof as unknown as Record<string, unknown>).signature;
  if (!sig || typeof sig !== 'object') {
    return { valid: false, reason: 'missing signature block' };
  }
  const sigObj = sig as Record<string, unknown>;
  if (typeof sigObj.address !== 'string' || typeof sigObj.publicKey !== 'string' || typeof sigObj.signature !== 'string') {
    return { valid: false, reason: 'signature missing required fields (address, publicKey, signature)' };
  }

  if (!verifyProofIdIntegrity(signedProof)) {
    return {
      valid: false,
      reason: 'proofId does not match recomputed value',
      signerAddress: signedProof.signature.address,
    };
  }

  const expired = !verifyProofPayload(signedProof, options?.graceMs, options?.now);
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

import { F, bytesToHex, hexToBytes, scriptFromWotsPk, scriptToAddress, wotsVerifyDigest } from '@totemsdk/core';
import type {
  LiquidityBondVerifyResult,
  LiquidityPoolManifest,
  LiquidityCommitment,
  LiquidityReceipt,
  VerifyPoolOperatorIdentityParams,
  VerifyLpIdentityParams,
  VerifyReceiptOwnerIdentityParams,
} from './types.js';

export const IDENTITY_CHALLENGE_DOMAIN = 'totemsdk/liquidity-bond/identity/v1';

/**
 * A signature-backed identity proof (#10/#32): the claimed address proves
 * control by signing a domain-separated challenge with its WOTS key. The
 * advisory `identityGraph` is no longer the load-bearing check — a signature
 * from the address-derived public key is.
 */
export interface IdentityChallengeProof {
  address: string;
  /** Hex of the 32-byte WOTS public key digest. */
  publicKeyDigest: string;
  /** Hex of the challenge bytes that were signed. */
  challenge: string;
  /** Hex WOTS signature over the challenge. */
  signature: string;
}

/**
 * Domain-separated challenge for an identity claim (#33): scoped to the entity
 * (poolId / positionId / receiptId) so a signature on one record cannot replay
 * against another.
 */
export function computeIdentityChallenge(entityId: string, address: string): string {
  return bytesToHex(F(new TextEncoder().encode(`${IDENTITY_CHALLENGE_DOMAIN}|${entityId}|${address}`)));
}

/** Derive the Mx address a 32-byte WOTS pk digest controls (mirrors core wasm). */
function addressFromPkDigestHex(pkDigestHex: string): string {
  return scriptToAddress(scriptFromWotsPk(hexToBytes(pkDigestHex)));
}

/**
 * Verify a signature-backed identity proof against a claimed address.
 * All gates must hold:
 *  1. the proof's address matches the claimed address;
 *  2. the public key digest actually owns that address;
 *  3. the challenge is the domain-separated challenge for this entity+address;
 *  4. the WOTS signature verifies over the challenge.
 */
export function verifyIdentityChallengeProof(
  proof: IdentityChallengeProof,
  claimedAddress: string,
  entityId: string,
): boolean {
  if (proof.address !== claimedAddress) return false;
  if (addressFromPkDigestHex(proof.publicKeyDigest) !== claimedAddress) return false;
  if (proof.challenge !== computeIdentityChallenge(entityId, claimedAddress)) return false;
  return wotsVerifyDigest(
    hexToBytes(proof.signature),
    hexToBytes(proof.challenge),
    hexToBytes(proof.publicKeyDigest),
  );
}

function isIdentityGraph(value: unknown): value is {
  document: { rootAddress: string; controllerAddress: string };
  claims: Array<{ claim: { type: string; issuer: string; subject: string; object: string }; proof: { address: string } }>;
} {
  if (!value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  return typeof g.document === 'object' && g.document !== null && Array.isArray(g.claims);
}

function getAuthorisedAddresses(identityGraph: unknown): string[] {
  if (!isIdentityGraph(identityGraph)) return [];
  const addresses = new Set<string>();
  const doc = identityGraph.document;
  if (doc.rootAddress) addresses.add(doc.rootAddress);
  if (doc.controllerAddress) addresses.add(doc.controllerAddress);
  for (const c of identityGraph.claims) {
    if (c.claim.type === 'delegates_to' && c.proof?.address) {
      addresses.add(c.proof.address);
    }
  }
  return Array.from(addresses);
}

export function verifyPoolOperatorIdentity(params: VerifyPoolOperatorIdentityParams): LiquidityBondVerifyResult {
  const { manifest, identityGraph, proof } = params;
  if (!manifest.operatorAddress) {
    return { ok: true, code: 'OK' };
  }
  if (!proof) {
    return { ok: false, reason: 'Pool operator identity requires a signature-backed challenge proof', code: 'POOL_IDENTITY_NOT_AUTHORISED' };
  }
  if (!verifyIdentityChallengeProof(proof, manifest.operatorAddress, manifest.poolId)) {
    return { ok: false, reason: 'Pool operator identity proof is invalid', code: 'POOL_IDENTITY_NOT_AUTHORISED' };
  }
  if (identityGraph && !getAuthorisedAddresses(identityGraph).includes(manifest.operatorAddress)) {
    return { ok: false, reason: 'Pool operator is not authorised by identity', code: 'POOL_IDENTITY_NOT_AUTHORISED' };
  }
  return { ok: true, code: 'OK' };
}

export function verifyLpIdentity(params: VerifyLpIdentityParams): LiquidityBondVerifyResult {
  const { commitment, identityGraph, proof } = params;
  if (!proof) {
    return { ok: false, reason: 'LP identity requires a signature-backed challenge proof', code: 'LP_IDENTITY_NOT_AUTHORISED' };
  }
  if (!verifyIdentityChallengeProof(proof, commitment.lpAddress, commitment.commitmentId)) {
    return { ok: false, reason: 'LP identity proof is invalid', code: 'LP_IDENTITY_NOT_AUTHORISED' };
  }
  if (identityGraph && !getAuthorisedAddresses(identityGraph).includes(commitment.lpAddress)) {
    return { ok: false, reason: 'LP address is not authorised by identity', code: 'LP_IDENTITY_NOT_AUTHORISED' };
  }
  return { ok: true, code: 'OK' };
}

export function verifyReceiptOwnerIdentity(params: VerifyReceiptOwnerIdentityParams): LiquidityBondVerifyResult {
  const { receipt, identityGraph, proof } = params;
  if (!proof) {
    return { ok: false, reason: 'Receipt owner identity requires a signature-backed challenge proof', code: 'RECEIPT_OWNER_NOT_AUTHORISED' };
  }
  if (!verifyIdentityChallengeProof(proof, receipt.ownerAddress, receipt.receiptId)) {
    return { ok: false, reason: 'Receipt owner identity proof is invalid', code: 'RECEIPT_OWNER_NOT_AUTHORISED' };
  }
  if (identityGraph && !getAuthorisedAddresses(identityGraph).includes(receipt.ownerAddress)) {
    return { ok: false, reason: 'Receipt owner is not authorised by identity', code: 'RECEIPT_OWNER_NOT_AUTHORISED' };
  }
  return { ok: true, code: 'OK' };
}

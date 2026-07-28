/**
 * Canonical JSON, hashing helpers, and proof ID computation.
 *
 * canonicalJson is implemented fresh here — @totemsdk/identity has its own
 * copy in identity/src/canonical.ts but does NOT export it.
 *
 * toHex: plain hex without 0x prefix (bytesToHex from core adds 0x — do NOT
 * use it for proof URIs or IDs).
 */

import { sha3_256 } from '@totemsdk/core';
import type { UnsignedProof, EvidenceRef } from './types.js';

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic canonical JSON with recursively sorted keys.
 * Never use bare JSON.stringify on objects passed to hash or sign operations.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute a deterministic proof ID from the core unsigned fields (excluding proofId).
 * This is the primary ID rule — callers must strip `proofId` before passing in.
 */
export function computeProofId(input: Omit<UnsignedProof, 'proofId'>): string {
  const hash = sha3_256(new TextEncoder().encode('totem-proof' + canonicalJson(input)));
  return 'totem:proof:' + toHex(hash);
}

/**
 * Hash a complete UnsignedProof (including proofId) for external consumers.
 */
export function hashProofPayload(unsignedProof: UnsignedProof): string {
  return toHex(sha3_256(new TextEncoder().encode('totem-proof' + canonicalJson(unsignedProof))));
}

/**
 * Hash a single EvidenceRef for integrity checks.
 */
export function hashEvidence(evidence: EvidenceRef): string {
  return toHex(sha3_256(new TextEncoder().encode(canonicalJson(evidence))));
}

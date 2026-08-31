/**
 * admission/challenge.ts — WorkChallenge creation and validation.
 *
 * The receiver controls the admission requirement. A challenge must be unique
 * enough to prevent useful pre-mining, must expire, must bind to the intended
 * receiver, and must bind to an application domain. Verification NEVER trusts
 * sender-reported hardware speed — it only checks `hash < target`.
 *
 * ── AUTHENTICATION BOUNDARY ────────────────────────────────────────────────
 * `validateWorkChallenge()` validates structural/freshness/domain/recipient
 * properties but does NOT prove that the claimed recipient actually issued the
 * challenge. A WorkChallenge is a plain data object; anyone can construct one
 * claiming any recipient. Proving the issuer requires authenticating the
 * enclosing message (e.g. a signed machine-to-machine protocol message in the
 * Edge negotiation layer). @totemsdk/txpow deliberately does NOT implement a
 * parallel identity/signature system — that belongs to the application layer.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { sha3_256 } from '@totemsdk/core';
import { MACHINE_WORK_ADMISSION_VERSION, type WorkChallenge } from './types.js';

/** Default challenge lifetime: 5 minutes. */
export const DEFAULT_CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** Maximum challenge lifetime: 24 hours. */
export const MAX_CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes: number): string {
  const out = new Uint8Array(bytes);
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error(
      'SECURITY: crypto.getRandomValues unavailable — cannot generate secure random challenge'
    );
  }
  crypto.getRandomValues(out);
  return toHex(out);
}

/**
 * Create a WorkChallenge.
 *
 * @param recipient  The intended receiver the challenge binds to.
 * @param domain     Application domain (open-ended, e.g. "totem.compute.reserve").
 * @param target     Absolute 32-byte cryptographic target (hex).
 * @param options    Optional overrides (challengeId, nonce, ttl, issuedAt, network).
 */
export function createWorkChallenge(
  recipient: string,
  domain: string,
  target: string,
  options?: {
    challengeId?: string;
    nonce?: string;
    ttlMs?: number;
    issuedAt?: number;
    network?: string;
  }
): WorkChallenge {
  if (!recipient) throw new Error('WorkChallenge requires a recipient');
  if (!domain) throw new Error('WorkChallenge requires a domain');
  if (!/^[0-9a-fA-F]{64}$/.test(target)) {
    throw new Error('WorkChallenge target must be 32-byte hex (64 hex chars)');
  }

  const ttlMs = options?.ttlMs ?? DEFAULT_CHALLENGE_TTL_MS;
  if (ttlMs <= 0 || ttlMs > MAX_CHALLENGE_TTL_MS) {
    throw new Error(`WorkChallenge ttlMs must be in (0, ${MAX_CHALLENGE_TTL_MS}]`);
  }

  const issuedAt = options?.issuedAt ?? Date.now();
  const challengeId = options?.challengeId ?? randomHex(16);
  const nonce = options?.nonce ?? randomHex(16);

  return {
    version: MACHINE_WORK_ADMISSION_VERSION,
    challengeId,
    recipient,
    domain,
    target,
    nonce,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    network: options?.network,
  };
}

/**
 * Validate a WorkChallenge at verification time.
 *
 * Checks structural integrity, expiry, and that the challenge binds to the
 * expected recipient/domain. Does NOT check the proof hash — that is the
 * caller's job via verifyWorkAdmission.
 */
export function validateWorkChallenge(
  challenge: WorkChallenge,
  expected?: { recipient?: string; domain?: string; now?: number }
): { valid: boolean; reason?: string } {
  if (!challenge || typeof challenge !== 'object') {
    return { valid: false, reason: 'challenge is not an object' };
  }
  if (challenge.version !== MACHINE_WORK_ADMISSION_VERSION) {
    return { valid: false, reason: `unsupported challenge version ${challenge.version}` };
  }
  if (!challenge.challengeId) {
    return { valid: false, reason: 'challenge is missing challengeId' };
  }
  if (!challenge.recipient) {
    return { valid: false, reason: 'challenge is missing recipient' };
  }
  if (!challenge.domain) {
    return { valid: false, reason: 'challenge is missing domain' };
  }
  if (!/^[0-9a-fA-F]{64}$/.test(challenge.target)) {
    return { valid: false, reason: 'challenge target must be 32-byte hex' };
  }
  if (typeof challenge.issuedAt !== 'number' || typeof challenge.expiresAt !== 'number') {
    return { valid: false, reason: 'challenge issuedAt/expiresAt must be numbers' };
  }

  const now = expected?.now ?? Date.now();
  if (now > challenge.expiresAt) {
    return { valid: false, reason: 'challenge has expired' };
  }
  if (now < challenge.issuedAt - 60_000) {
    return { valid: false, reason: 'challenge issuedAt is in the future' };
  }

  if (expected?.recipient && challenge.recipient !== expected.recipient) {
    return { valid: false, reason: 'challenge recipient mismatch' };
  }
  if (expected?.domain && challenge.domain !== expected.domain) {
    return { valid: false, reason: 'challenge domain mismatch' };
  }

  return { valid: true };
}

/**
 * Derive a stable challenge fingerprint (SHA3-256 of canonical challenge bytes).
 * Useful for higher-level code that tracks already-consumed challenge IDs.
 */
export function challengeFingerprint(challenge: WorkChallenge): string {
  const canonical = canonicalChallenge(challenge);
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

/**
 * Canonical serialization of a WorkChallenge.
 *
 * Deterministic field ordering with length-prefixed strings so that no
 * ambiguous concatenation is possible. Used for the commitment and for
 * challenge fingerprints.
 */
export function canonicalChallenge(challenge: WorkChallenge): string {
  const parts: string[] = [];
  const push = (s: string): void => {
    parts.push(String(s.length).padStart(8, '0'));
    parts.push(s);
  };
  push('totem.work-challenge');
  push(String(challenge.version));
  push(challenge.challengeId);
  push(challenge.recipient);
  push(challenge.domain);
  push(challenge.target);
  push(challenge.nonce);
  push(String(challenge.issuedAt));
  push(String(challenge.expiresAt));
  if (challenge.network !== undefined) push(challenge.network);
  return parts.join('');
}

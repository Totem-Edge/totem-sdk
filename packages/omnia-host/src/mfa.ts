/**
 * TOTP + operation-bound MFA assertions (RFC-061 D8).
 *
 * The node/host creates an MfaChallenge for a money-moving operation; the user
 * returns an MfaAssertion (TOTP proof). Verification binds the assertion to the
 * exact operation hash, disclosure and expiry, and consumes it once. Secrets
 * never leave the verifier.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_PERIOD = 30;
const DEFAULT_DIGITS = 6;

export interface TotpOptions {
  /** Current time in ms (default Date.now()). */
  time?: number;
  period?: number;
  digits?: number;
  /** Accepted step window on either side (default 1). */
  window?: number;
}

function toSecret(secret: string | Uint8Array): Uint8Array {
  if (secret instanceof Uint8Array) return secret;
  const clean = secret.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!clean) throw new Error('MFA secret is empty');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const index = BASE32.indexOf(ch);
    if (index < 0) throw new Error('MFA secret is not valid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function hotp(secret: Uint8Array, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(msg).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

function step(timeMs: number, period: number): number {
  return Math.floor(timeMs / 1000 / period);
}

export function generateTotp(secret: string | Uint8Array, options: TotpOptions = {}): string {
  const period = options.period ?? DEFAULT_PERIOD;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const time = options.time ?? Date.now();
  return hotp(toSecret(secret), step(time, period), digits);
}

export function verifyTotp(
  secret: string | Uint8Array,
  code: string,
  options: TotpOptions = {},
): boolean {
  const period = options.period ?? DEFAULT_PERIOD;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const window = options.window ?? 1;
  const time = options.time ?? Date.now();
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) return false;
  const key = toSecret(secret);
  const current = step(time, period);
  for (let delta = -window; delta <= window; delta += 1) {
    const candidate = hotp(key, current + delta, digits);
    if (
      candidate.length === normalized.length &&
      timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized))
    ) {
      return true;
    }
  }
  return false;
}

export type MfaPurpose = 'sign' | 'submit' | 'key-rotation' | 'recovery' | 'admin';
export type MfaMethod = 'totp' | 'webauthn' | 'recovery-code';

/** Server-issued challenge bound to one exact operation. */
export interface MfaChallenge {
  challengeId: string;
  purpose: MfaPurpose;
  operationHash: string;
  disclosureId?: string;
  expiresAt: number;
  attempts?: number;
}

/** Client-supplied proof for a challenge. */
export interface MfaAssertion {
  challengeId: string;
  method: MfaMethod;
  proof: string;
  issuedAt: number;
}

/** Single-use replay guard (durable in a hosted deployment). */
export interface MfaReplayGuard {
  has(challengeId: string): boolean;
  add(challengeId: string): void;
}

export class MemoryMfaReplayGuard implements MfaReplayGuard {
  private readonly used = new Set<string>();
  has(challengeId: string): boolean {
    return this.used.has(challengeId);
  }
  add(challengeId: string): void {
    this.used.add(challengeId);
  }
}

export interface MfaVerificationOptions {
  secret: string | Uint8Array;
  /** Expected operation hash (see `mfaOperationHash`). */
  operationHash: string;
  disclosureId?: string;
  now?: number;
  period?: number;
  digits?: number;
  window?: number;
  /** Tolerated future clock skew for issuedAt (default 5 minutes). */
  clockSkewMs?: number;
  /** Replay guard; defaults to a process-local guard when omitted. */
  used?: MfaReplayGuard;
}

export interface MfaVerificationResult {
  ok: boolean;
  reason?: string;
}

const defaultGuard = new MemoryMfaReplayGuard();

export function verifyMfaAssertion(
  challenge: MfaChallenge,
  assertion: MfaAssertion,
  options: MfaVerificationOptions,
): MfaVerificationResult {
  const now = options.now ?? Date.now();
  if (!challenge.challengeId || assertion.challengeId !== challenge.challengeId) {
    return { ok: false, reason: 'MFA assertion does not match the challenge' };
  }
  if (challenge.expiresAt <= now) return { ok: false, reason: 'MFA challenge has expired' };
  if (challenge.attempts !== undefined && challenge.attempts <= 0) {
    return { ok: false, reason: 'MFA challenge has no attempts left' };
  }
  if (challenge.operationHash !== options.operationHash) {
    return { ok: false, reason: 'MFA challenge does not match the operation' };
  }
  if (challenge.disclosureId !== undefined && challenge.disclosureId !== options.disclosureId) {
    return { ok: false, reason: 'MFA challenge does not match the disclosure' };
  }
  const skew = options.clockSkewMs ?? 5 * 60_000;
  if (
    !Number.isFinite(assertion.issuedAt) ||
    assertion.issuedAt <= 0 ||
    assertion.issuedAt > now + skew
  ) {
    return { ok: false, reason: 'MFA assertion has an invalid issuedAt' };
  }
  const used = options.used ?? defaultGuard;
  if (used.has(challenge.challengeId)) {
    return { ok: false, reason: 'MFA assertion has already been used' };
  }
  if (assertion.method !== 'totp') {
    return { ok: false, reason: `unsupported MFA method: ${assertion.method}` };
  }
  if (
    !verifyTotp(options.secret, assertion.proof, {
      time: assertion.issuedAt,
      period: options.period,
      digits: options.digits,
      window: options.window,
    })
  ) {
    return { ok: false, reason: 'MFA proof is invalid' };
  }
  used.add(challenge.challengeId);
  return { ok: true };
}

export function assertMfaAssertion(
  challenge: MfaChallenge,
  assertion: MfaAssertion,
  options: MfaVerificationOptions,
): void {
  const result = verifyMfaAssertion(challenge, assertion, options);
  if (!result.ok) throw new Error(result.reason ?? 'MFA verification failed');
}

export interface MfaOperationInput {
  purpose: MfaPurpose;
  domain: string;
  /** Canonical operation digest (SignRequest.digest). */
  digest: Uint8Array | string;
  disclosureId?: string;
  amount?: string;
  asset?: string;
}

/** Stable operation hash binding an MFA challenge to one signing intent. */
export function mfaOperationHash(input: MfaOperationInput): string {
  const digest = input.digest instanceof Uint8Array
    ? Buffer.from(input.digest).toString('hex')
    : String(input.digest).replace(/^0x/i, '').toLowerCase();
  const canonical = JSON.stringify({
    purpose: input.purpose,
    domain: input.domain,
    digest,
    disclosureId: input.disclosureId ?? null,
    amount: input.amount ?? null,
    asset: input.asset ?? null,
  });
  return '0x' + createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * RFC-032: post-quantum message authentication for the lookup protocol.
 *
 * Authentication is WOTS (hash-based, quantum-resistant), not Ed25519. A
 * signed message carries a {@link WotsAuthEnvelope} (`auth`) whose signature is
 * over:
 *
 *   sha3_256( canonicalJson({ type, id, payload }) ‖ nonce ‖ expiresAt )
 *
 * The signing/verification itself is delegated to the caller via `SignFn` /
 * `VerifyFn`, so this package keeps no concrete crypto dependency beyond the
 * SHA3-256 digest. `@totemsdk/core` provides the WOTS implementation used by
 * lookup-client (sign) and lookup-node (verify).
 */

import { sha3_256 } from '@totemsdk/core';
import type { LookupMessage, WotsAuthEnvelope } from './messages.js';

/** Deterministic canonical JSON (sorted keys, recursive) for stable digests. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value instanceof Uint8Array) return JSON.stringify(Array.from(value));
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') +
    '}'
  );
}

/** A WOTS signer: signs a 32-byte digest, returns the signature bytes. */
export interface SignFn {
  (digest: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

/** A WOTS verifier: verifies (digest, signature, pkDigest) → boolean. */
export interface VerifyFn {
  (digest: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean | Promise<boolean>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Digest of the authenticated portion of a message: everything except `auth` and
 * the legacy `sig`, plus the anti-replay nonce and expiry.
 */
export function authDigest(
  msg: Omit<LookupMessage, 'auth' | 'sig'>,
  nonce: number,
  expiresAt: number,
): Uint8Array {
  const { auth: _a, sig: _s, ...rest } = msg as LookupMessage & { auth?: unknown; sig?: string };
  const canonical = canonicalJson(rest);
  const preimage = new TextEncoder().encode(`${canonical}|${nonce}|${expiresAt}`);
  return sha3_256(preimage);
}

/**
 * Attach a WOTS auth envelope to a message. The signer signs the auth digest.
 * `rootPublicKey` is the hex PKdigest; `rootIdentityProof`/`address` are optional.
 */
export async function signMessage<T extends LookupMessage>(
  msg: Omit<T, 'auth' | 'sig'>,
  sign: SignFn,
  rootPublicKey: string,
  options: {
    nonce: number;
    expiresAt: number;
    rootIdentityProof?: string;
    address?: string;
  },
): Promise<T> {
  const digest = authDigest(msg as Omit<LookupMessage, 'auth' | 'sig'>, options.nonce, options.expiresAt);
  const sigBytes = await sign(digest);
  const auth: WotsAuthEnvelope = {
    rootPublicKey,
    signature: bytesToHex(sigBytes),
    nonce: options.nonce,
    expiresAt: options.expiresAt,
    ...(options.rootIdentityProof !== undefined ? { rootIdentityProof: options.rootIdentityProof } : {}),
    ...(options.address !== undefined ? { address: options.address } : {}),
  };
  return { ...(msg as T), auth };
}

/**
 * Verify the `auth` envelope of a message. Returns false when absent, expired,
 * or the signature does not verify. The caller is responsible for replay
 * rejection (nonce/index uniqueness) — see lookup-node.
 */
export async function verifyMessageAuth(
  msg: LookupMessage,
  verify: VerifyFn,
  now: number = Date.now(),
): Promise<boolean> {
  const auth = msg.auth;
  if (!auth || typeof auth.signature !== 'string' || auth.signature.length === 0) return false;
  if (typeof auth.expiresAt !== 'number' || now > auth.expiresAt) return false;
  try {
    const digest = authDigest(
      msg as Omit<LookupMessage, 'auth' | 'sig'>,
      auth.nonce,
      auth.expiresAt,
    );
    return await verify(digest, hexToBytes(auth.signature), hexToBytes(auth.rootPublicKey));
  } catch {
    return false;
  }
}

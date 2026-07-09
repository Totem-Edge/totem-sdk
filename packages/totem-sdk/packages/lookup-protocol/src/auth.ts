/**
 * Message authentication for the lookup protocol.
 *
 * Uses SHA3-256 from @totemsdk/core to produce a digest over the canonical
 * message payload, then attaches/verifies a hex signature.
 *
 * NOTE: Full ed25519 signing is intentionally deferred — this module provides
 * the digest surface so higher layers (lookup-node, lookup-client) can attach
 * their preferred signing backend without taking on a crypto dependency here.
 * `signMessage` accepts any sign function; `verifyMessageAuth` accepts any
 * verify function.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import type { LookupMessage } from './messages.js';

export interface SignFn {
  (digest: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

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
 * Compute a canonical digest over the message for signing/verification.
 * Excludes the `sig` field so the digest is stable.
 */
export function messageDigest(msg: LookupMessage): Uint8Array {
  const { sig: _sig, ...rest } = msg as LookupMessage & { sig?: string };
  const json = JSON.stringify(rest);
  return sha3_256(new TextEncoder().encode(json));
}

/**
 * Attach a signature to a message.
 * Returns a new message object with the `sig` field set.
 */
export async function signMessage<T extends LookupMessage>(
  msg: T,
  sign: SignFn,
): Promise<T & { sig: string }> {
  const digest = messageDigest(msg);
  const sigBytes = await sign(digest);
  return { ...msg, sig: bytesToHex(sigBytes) };
}

/**
 * Verify the `sig` field of a message against a known public key.
 * Returns false if `sig` is absent.
 */
export async function verifyMessageAuth(
  msg: LookupMessage,
  publicKey: Uint8Array,
  verify: VerifyFn,
): Promise<boolean> {
  if (!msg.sig) return false;
  try {
    const digest = messageDigest(msg);
    const sigBytes = hexToBytes(msg.sig);
    return verify(digest, sigBytes, publicKey);
  } catch {
    return false;
  }
}

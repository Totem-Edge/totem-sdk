/**
 * Encryption envelope specification for private policy branches.
 *
 * This module defines the encryption envelope format, algorithm
 * identifiers, and key management procedures. It replaces the
 * previous ad-hoc encryptFn/decryptFn callbacks with a formally
 * specified envelope.
 *
 * Envelope format (binary):
 *   version(1) || algorithm(1) || keyFingerprint(32) || nonce(12) || ciphertext(*)
 *
 * Supported algorithms:
 *   0x01 = AES-256-GCM (recommended)
 *   0x02 = ChaCha20-Poly1305
 *
 * Key wrapping:
 *   Per-recipient: encrypt DEK with recipient's public key (ECIES)
 *   Key rotation: re-wrap DEK with new recipient keys
 *   Compromise recovery: rotate DEK, re-encrypt all branches
 *
 * Confidentiality boundary:
 *   Encryption protects branches at rest and in transit. When a branch
 *   is exercised and its script enters a transaction witness, the script
 *   becomes publicly visible on-chain. Encryption does not provide
 *   post-execution confidentiality.
 */

import { sha3_256, bytesToHex, hexToBytes } from '@totemsdk/core';

export const ENCRYPTION_ALGORITHMS = {
  AES_256_GCM: 0x01,
  CHACHA20_POLY1305: 0x02,
} as const;

export type EncryptionAlgorithm = typeof ENCRYPTION_ALGORITHMS[keyof typeof ENCRYPTION_ALGORITHMS];

export const ENVELOPE_VERSION = 1;

export interface EncryptionEnvelope {
  version: number;
  algorithm: EncryptionAlgorithm;
  keyFingerprint: string;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface KeyWrappingEnvelope {
  version: number;
  algorithm: EncryptionAlgorithm;
  recipientPkd: string;
  wrappedKey: Uint8Array;
  keyFingerprint: string;
}

export function serializeEncryptionEnvelope(envelope: EncryptionEnvelope): Uint8Array {
  const parts: Uint8Array[] = [
    new Uint8Array([envelope.version, envelope.algorithm]),
    hexToBytes(envelope.keyFingerprint),
    envelope.nonce,
    envelope.ciphertext,
  ];

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function deserializeEncryptionEnvelope(data: Uint8Array): EncryptionEnvelope | null {
  if (data.length < 2 + 32 + 12) return null;

  const version = data[0];
  const algorithm = data[1] as EncryptionAlgorithm;
  const keyFingerprint = bytesToHex(data.slice(2, 34));
  const nonce = data.slice(34, 46);
  const ciphertext = data.slice(46);

  return { version, algorithm, keyFingerprint, nonce, ciphertext };
}

export function computeKeyFingerprint(keyBytes: Uint8Array): string {
  return bytesToHex(sha3_256(keyBytes));
}

export function createEncryptionEnvelope(
  algorithm: EncryptionAlgorithm,
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): EncryptionEnvelope {
  return {
    version: ENVELOPE_VERSION,
    algorithm,
    keyFingerprint: computeKeyFingerprint(keyBytes),
    nonce,
    ciphertext,
  };
}

export function createKeyWrappingEnvelope(
  algorithm: EncryptionAlgorithm,
  recipientPkd: string,
  wrappedKey: Uint8Array,
  keyFingerprint: string,
): KeyWrappingEnvelope {
  return {
    version: ENVELOPE_VERSION,
    algorithm,
    recipientPkd,
    wrappedKey,
    keyFingerprint,
  };
}

export function serializeKeyWrappingEnvelope(envelope: KeyWrappingEnvelope): Uint8Array {
  const pkdBytes = hexToBytes(envelope.recipientPkd);
  const parts: Uint8Array[] = [
    new Uint8Array([envelope.version, envelope.algorithm]),
    pkdBytes,
    envelope.wrappedKey,
    hexToBytes(envelope.keyFingerprint),
  ];

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function deserializeKeyWrappingEnvelope(data: Uint8Array): KeyWrappingEnvelope | null {
  if (data.length < 2 + 32 + 1 + 32) return null;

  const version = data[0];
  const algorithm = data[1] as EncryptionAlgorithm;
  const recipientPkd = bytesToHex(data.slice(2, 34));

  let offset = 34;
  const wrappedKeyLen = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
  offset += 4;
  const wrappedKey = data.slice(offset, offset + wrappedKeyLen);
  offset += wrappedKeyLen;

  const keyFingerprint = bytesToHex(data.slice(offset, offset + 32));

  return { version, algorithm, recipientPkd, wrappedKey, keyFingerprint };
}

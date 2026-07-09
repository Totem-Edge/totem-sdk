import { sha3_256 } from '@noble/hashes/sha3.js';
import { verifyTreeSignature, deserializeTreeSignature } from './treekey.js';
import { scriptToAddress, addressToRoot } from './derive.js';
import { scriptFromWotsPk } from './script.js';
import { getRootPublicKey } from './treekey.js';
import { wotsVerifyDigest } from './wots.js';
import { getParamSet } from './params.js';
import type { TreeSignature, SignatureProof } from './treekey.js';
import type { Bytes } from './mmr.js';

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

export function normalizeHex(hex: string): string {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex;
  return stripped.toLowerCase();
}

export function hexToBytes(hex: string): Uint8Array {
  const h = normalizeHex(hex);
  if (h.length % 2 !== 0) throw new Error('Invalid hex string: odd length');
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function deriveAddressFromPublicKey(publicKeyHex: string): string {
  const pkBytes = hexToBytes(publicKeyHex);
  if (pkBytes.length !== 32) {
    throw new Error(
      `Public key must be 32 bytes (64 hex chars), got ${pkBytes.length} bytes`
    );
  }
  const script = scriptFromWotsPk(pkBytes);
  return scriptToAddress(script);
}

export function verifyTreeSignatureDetailed(
  expectedPubkey: Bytes,
  data: Bytes,
  signature: TreeSignature
): VerificationResult {
  const { proofs } = signature;

  if (proofs.length === 0) {
    return { valid: false, error: 'Signature contains no proofs' };
  }

  const paramSet = getParamSet();

  for (let depth = 0; depth < proofs.length; depth++) {
    const proof = proofs[depth];

    const rootPubkey = getRootPublicKey(proof);

    if (depth === 0) {
      if (!timingSafeEqual(expectedPubkey, rootPubkey)) {
        return {
          valid: false,
          error: 'Root public key does not match expected public key (wrong key or address)',
        };
      }
    }

    let signedData: Bytes;
    if (depth === proofs.length - 1) {
      signedData = data;
    } else {
      signedData = getRootPublicKey(proofs[depth + 1]);
    }

    if (!wotsVerifyDigest(proof.signature, signedData, proof.leafPubkey, paramSet)) {
      return {
        valid: false,
        error: `WOTS signature verification failed at depth ${depth} (digest mismatch or corrupted signature)`,
      };
    }
  }

  return { valid: true };
}

export function verifySignature(
  address: string,
  message: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  const result = verifySignatureDetailed(address, message, signatureHex, publicKeyHex);
  return result.valid;
}

export function verifySignatureDetailed(
  address: string,
  message: string,
  signatureHex: string,
  publicKeyHex: string
): VerificationResult {
  try {
    const pkBytes = hexToBytes(publicKeyHex);
    if (pkBytes.length !== 32) {
      return {
        valid: false,
        error: `Public key must be 32 bytes (64 hex chars), got ${pkBytes.length} bytes`,
      };
    }

    const derivedAddress = deriveAddressFromPublicKey(publicKeyHex);
    if (derivedAddress.toLowerCase() !== address.toLowerCase()) {
      return {
        valid: false,
        error: `Public key does not match claimed address. Expected ${address}, derived ${derivedAddress}`,
      };
    }

    const sigBytes = hexToBytes(signatureHex);
    let treeSignature: TreeSignature;
    try {
      treeSignature = deserializeTreeSignature(sigBytes);
    } catch (e: any) {
      return {
        valid: false,
        error: `Malformed signature: ${e.message}`,
      };
    }

    const digest = sha3_256(new TextEncoder().encode(message));

    return verifyTreeSignatureDetailed(pkBytes, digest, treeSignature);
  } catch (e: any) {
    return {
      valid: false,
      error: `Verification error: ${e.message}`,
    };
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function cryptoRandomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    // Web Crypto API — available in browsers, Bare/Pear, and Node.js ≥ 19
    globalThis.crypto.getRandomValues(buf);
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    // Node.js < 19 fallback — dynamic import avoids static resolution in Bare/bundlers
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = Function('return require')()('crypto') as { randomFillSync: (buf: Uint8Array) => void };
    nodeCrypto.randomFillSync(buf);
  } else {
    throw new Error('No cryptographically secure RNG available in this runtime');
  }
  return buf;
}

export function createChallenge(domain: string, nonce?: string): string {
  const ts = Date.now();
  const n = nonce || bytesToHex(
    sha3_256(new Uint8Array([...new TextEncoder().encode(`${domain}:${ts}:`), ...cryptoRandomBytes(16)]))
  ).slice(0, 16);
  return JSON.stringify({ domain, nonce: n, issuedAt: ts });
}

export function validateChallenge(
  challenge: string,
  options?: { maxAgeMs?: number; expectedDomain?: string }
): VerificationResult {
  try {
    const parsed = JSON.parse(challenge);
    const { domain, nonce, issuedAt } = parsed;

    if (!domain || !nonce || !issuedAt) {
      return { valid: false, error: 'Challenge missing required fields (domain, nonce, issuedAt)' };
    }

    if (options?.expectedDomain && domain !== options.expectedDomain) {
      return { valid: false, error: `Domain mismatch: expected ${options.expectedDomain}, got ${domain}` };
    }

    const maxAge = options?.maxAgeMs ?? 5 * 60 * 1000;
    const age = Date.now() - issuedAt;
    if (age > maxAge) {
      return { valid: false, error: `Challenge expired: ${Math.round(age / 1000)}s old (max ${Math.round(maxAge / 1000)}s)` };
    }
    if (age < 0) {
      return { valid: false, error: 'Challenge issued in the future' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid challenge format (not valid JSON)' };
  }
}

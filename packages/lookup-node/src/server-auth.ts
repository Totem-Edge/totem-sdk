/**
 * Server-side authentication for the lookup protocol.
 *
 * Flow:
 *   1. Server sends AUTH_CHALLENGE with a random challenge and expiry.
 *   2. Client sends AUTH_RESPONSE with { challenge, publicKey (hex), signature (hex) }.
 *      The signature covers `new TextEncoder().encode(challenge)` bytes using Ed25519.
 *   3. Server verifies the signature using WebCrypto subtle.verify.
 */

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

export interface AuthChallenge {
  challenge: string;
  expiresAt: number;
}

export function generateChallenge(ttlMs = 30_000): AuthChallenge {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return {
    challenge: bytesToHex(bytes),
    expiresAt: Date.now() + ttlMs,
  };
}

export interface AuthResponsePayload {
  challenge: string;
  publicKey: string;
  signature: string;
}

export interface VerifyResult {
  valid: boolean;
  publicKeyHex: string;
  reason?: string;
}

export async function verifyAuthResponse(
  payload: AuthResponsePayload,
  expectedChallenge: string,
  expiresAt: number,
): Promise<VerifyResult> {
  if (Date.now() > expiresAt) {
    return { valid: false, publicKeyHex: payload.publicKey, reason: 'challenge expired' };
  }
  if (payload.challenge !== expectedChallenge) {
    return { valid: false, publicKeyHex: payload.publicKey, reason: 'challenge mismatch' };
  }

  try {
    const pubKeyBytes = hexToBytes(payload.publicKey);
    const sigBytes = hexToBytes(payload.signature);
    const challengeBytes = new TextEncoder().encode(payload.challenge);

    const pubKey = await globalThis.crypto.subtle.importKey(
      'raw',
      Buffer.from(pubKeyBytes),
      { name: 'Ed25519' } as AlgorithmIdentifier,
      false,
      ['verify'],
    );

    const valid = await globalThis.crypto.subtle.verify(
      { name: 'Ed25519' } as AlgorithmIdentifier,
      pubKey,
      Buffer.from(sigBytes),
      Buffer.from(challengeBytes),
    );

    return { valid, publicKeyHex: payload.publicKey, reason: valid ? undefined : 'bad signature' };
  } catch (err) {
    return { valid: false, publicKeyHex: payload.publicKey, reason: String(err) };
  }
}

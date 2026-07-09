/**
 * Identity keypair generation and auth handshake for lookup-client.
 *
 * Crypto strategy (portable, no static Node-only imports):
 *   1. Try globalThis.crypto.subtle with Ed25519 — works in Node 18+, browsers, Pear/Bare.
 *   2. Fall back to dynamically-imported node:crypto if SubtleCrypto is unavailable
 *      or does not support Ed25519.
 *
 * Auth handshake uses @totemsdk/lookup-protocol helpers:
 *   - signMessage() adds the message-level `sig` field (SHA3-256 MAC)
 *   - payload.signature is the raw ed25519 signature over the challenge (identity proof)
 */

import { PROTOCOL_VERSION, signMessage } from '@totemsdk/lookup-protocol';
import type { SignFn } from '@totemsdk/lookup-protocol';
import type { RpcLayer } from './rpc.js';

export interface IdentityKeyPair {
  /** Ed25519 public key as a lowercase hex string (32 bytes = 64 chars). */
  publicKeyHex: string;
  /** Sign arbitrary bytes, returning a 64-byte ed25519 signature. Compatible with lookup-protocol's SignFn. */
  signFn: SignFn;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate an ephemeral ed25519 identity keypair for this session.
 *
 * Uses WebCrypto (Ed25519) where available — portable across Node 18+, browsers, Pear/Bare.
 * Falls back to dynamically imported node:crypto for older Node environments.
 */
export async function generateIdentityKeyPair(): Promise<IdentityKeyPair> {
  // ── Primary path: WebCrypto Ed25519 ──────────────────────────────────────
  const subtle = globalThis.crypto?.subtle;
  if (subtle != null) {
    try {
      const kp = await subtle.generateKey(
        { name: 'Ed25519' } as EcKeyGenParams,
        true,
        ['sign', 'verify'],
      );
      const rawPub = await subtle.exportKey('raw', (kp as CryptoKeyPair).publicKey);
      const pubHex = toHex(new Uint8Array(rawPub));
      const privKey = (kp as CryptoKeyPair).privateKey;

      return {
        publicKeyHex: pubHex,
        signFn: async (digest: Uint8Array): Promise<Uint8Array> => {
          // Wrap in Buffer to guarantee a plain ArrayBuffer backing (TypeScript strict mode)
          const sig = await subtle.sign(
            { name: 'Ed25519' } as AlgorithmIdentifier,
            privKey,
            Buffer.from(digest),
          );
          return new Uint8Array(sig);
        },
      };
    } catch {
      // Ed25519 not supported in this WebCrypto implementation — fall through
    }
  }

  // ── Fallback: dynamically-imported node:crypto ────────────────────────────
  // Dynamic import keeps this import out of the static module graph so bundlers
  // targeting browser/Pear runtimes can tree-shake it.
  const nodeCrypto = await import('node:crypto');
  const { privateKey, publicKey } = nodeCrypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  const pubHex = toHex(new Uint8Array(Buffer.from(jwk.x, 'base64url')));

  return {
    publicKeyHex: pubHex,
    signFn: (digest: Uint8Array): Uint8Array => {
      const sig = nodeCrypto.sign(null, Buffer.from(digest), privateKey);
      return new Uint8Array(sig);
    },
  };
}

let _authIdCounter = 0;

/**
 * Run the HELLO → AUTH_CHALLENGE → AUTH_RESPONSE handshake.
 *
 * AUTH_RESPONSE includes:
 *   - payload.signature: raw ed25519 signature over the challenge bytes (identity proof)
 *   - msg.sig: message-level MAC via signMessage() from @totemsdk/lookup-protocol
 *
 * Resolves when the server acknowledges AUTH_RESPONSE (any non-ERROR reply).
 */
export async function runAuthHandshake(
  rpc: RpcLayer,
  keypair: IdentityKeyPair,
  timeoutMs?: number,
): Promise<void> {
  // Step 1: HELLO → AUTH_CHALLENGE
  const challengeMsg = await rpc.sendRequest(
    {
      type: 'HELLO',
      version: PROTOCOL_VERSION,
      payload: { clientVersion: PROTOCOL_VERSION },
    },
    timeoutMs,
  );

  if (challengeMsg.type !== 'AUTH_CHALLENGE') {
    throw new Error(
      `Auth handshake failed: expected AUTH_CHALLENGE, got ${challengeMsg.type}`,
    );
  }

  const { challenge } = challengeMsg.payload as { challenge: string; expiresAt: number };

  // Step 2: sign challenge bytes as identity proof (payload.signature)
  const challengeSig = await keypair.signFn(new TextEncoder().encode(challenge));

  // Pre-assign a request id so we can sign the complete message before sendRequest sees it.
  // This ensures the message digest (which includes `id`) is stable.
  const authId = `auth-${++_authIdCounter}`;

  const authResponseUnsigned = {
    type: 'AUTH_RESPONSE' as const,
    version: PROTOCOL_VERSION,
    id: authId,
    payload: {
      challenge,
      publicKey: keypair.publicKeyHex,
      signature: toHex(challengeSig),
    },
  };

  // Add message-level sig using lookup-protocol helper (SHA3-256 digest, same sign function)
  const signedAuthResponse = await signMessage(authResponseUnsigned, keypair.signFn);

  // Step 3: send AUTH_RESPONSE — server replies with any non-ERROR message
  await rpc.sendRequest(signedAuthResponse, timeoutMs);
}

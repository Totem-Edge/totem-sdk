/**
 * @module se-server/ownerAuth
 *
 * AUD-026 — owner authentication request binding.
 *
 * A challenge nonce alone must not authenticate an operation: a pending owner
 * signature could otherwise be replayed against a different endpoint or body.
 * The owner signs a canonical, domain-separated message bound to the chain,
 * operation, nonce and the operation's signed body; the server reconstructs the
 * same message and verifies the signature against it.
 *
 * Canonical format (shared with the client):
 *   `totem:se-request:v1|<chainId>|<operation>|<nonce>|<sorted body>`
 * where `sorted body` is `key=value` pairs sorted by key, joined with `&`.
 */

import {
  sha3_256,
  hexToBytes,
  deserializeTreeSignature,
  verifyTreeSignatureDetailed,
} from '@totemsdk/core';

export type SeOperation = 'blind-sign' | 'revoke-key' | 'claim' | 'reclaim-tx';

export function seRequestMessage(
  chainId: string,
  operation: SeOperation,
  nonce: string,
  body: Record<string, string> = {},
): string {
  const bodyStr = Object.keys(body).sort().map((k) => `${k}=${body[k]}`).join('&');
  return `totem:se-request:v1|${chainId}|${operation}|${nonce}|${bodyStr}`;
}

function fromHex(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s.replace(/^0x/i, ''), 'hex'));
}

/**
 * Verify the owner's root-bound Minima `TreeSignature` over the bound request
 * message (RFC-009). `ownerPkd` is the owner's TreeKey **root** public key;
 * `ownerSig` is the serialized `TreeSignature` hex.
 */
export async function verifyOwnerRequest(
  ownerPkd: string,
  chainId: string,
  operation: SeOperation,
  nonce: string,
  body: Record<string, string>,
  ownerSig: string,
): Promise<boolean> {
  try {
    const message = seRequestMessage(chainId, operation, nonce, body);
    const msg = sha3_256(new TextEncoder().encode(message));
    const sig = deserializeTreeSignature(fromHex(ownerSig));
    return verifyTreeSignatureDetailed(fromHex(ownerPkd), msg, sig).valid === true;
  } catch {
    return false;
  }
}

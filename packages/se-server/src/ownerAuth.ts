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

import { sha3_256 } from '@totemsdk/core';
import { wotsVerifyDigestAsync } from './seKey';

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

/** Verify the owner's signature over the bound request message. */
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
    return await wotsVerifyDigestAsync(fromHex(ownerSig), msg, fromHex(ownerPkd));
  } catch {
    return false;
  }
}

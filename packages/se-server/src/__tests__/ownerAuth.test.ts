/**
 * AUD-026 — owner authentication request binding.
 *
 * A challenge nonce must not authenticate an operation by itself; the owner
 * signs a canonical message bound to chain + operation + nonce + body.
 */

import { TreeKey, bytesToHex, sha3_256, serializeTreeSignature } from '@totemsdk/core';
import { seRequestMessage, verifyOwnerRequest } from '../ownerAuth';

const owner = new TreeKey(new Uint8Array(32).fill(0x5a), 4, 2);
const PKD_HEX = bytesToHex(owner.getPublicKey());

function sign(message: string): string {
  return bytesToHex(serializeTreeSignature(owner.sign(sha3_256(new TextEncoder().encode(message)))));
}

jest.setTimeout(60_000);

describe('ownerAuth (AUD-026)', () => {
  it('canonical message is domain-separated and body-sorted', () => {
    expect(seRequestMessage('sc_1', 'blind-sign', 'n1', { b: '2', a: '1' }))
      .toBe('totem:se-request:v1|sc_1|blind-sign|n1|a=1&b=2');
  });

  it('accepts a signature over the exact request', async () => {
    const body = { blindedCommitment: '0xdead' };
    const sig = sign(seRequestMessage('sc_1', 'blind-sign', 'n1', body));
    expect(await verifyOwnerRequest(PKD_HEX, 'sc_1', 'blind-sign', 'n1', body, sig)).toBe(true);
  });

  it('rejects the same signature for a different operation', async () => {
    const body = { blindedCommitment: '0xdead' };
    const sig = sign(seRequestMessage('sc_1', 'blind-sign', 'n1', body));
    expect(await verifyOwnerRequest(PKD_HEX, 'sc_1', 'claim', 'n1', body, sig)).toBe(false);
  });

  it('rejects a signature over a different body', async () => {
    const sig = sign(seRequestMessage('sc_1', 'blind-sign', 'n1', { blindedCommitment: '0xdead' }));
    expect(await verifyOwnerRequest(PKD_HEX, 'sc_1', 'blind-sign', 'n1', { blindedCommitment: '0xbeef' }, sig)).toBe(false);
  });

  it('rejects a signature for a different chain', async () => {
    const body = { blindedCommitment: '0xdead' };
    const sig = sign(seRequestMessage('sc_1', 'blind-sign', 'n1', body));
    expect(await verifyOwnerRequest(PKD_HEX, 'sc_2', 'blind-sign', 'n1', body, sig)).toBe(false);
  });
});

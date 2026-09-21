/**
 * AUD-026 — owner authentication request binding.
 *
 * A challenge nonce must not authenticate an operation by itself; the owner
 * signs a canonical message bound to chain + operation + nonce + body.
 */

import { wotsSign, derivePKdigest, bytesToHex, sha3_256 } from '@totemsdk/core';
import { seRequestMessage, verifyOwnerRequest } from '../ownerAuth';

const SEED = new Uint8Array(32).fill(0x5a);
const PKD_HEX = bytesToHex(derivePKdigest(SEED, 0));

function sign(message: string): string {
  return bytesToHex(wotsSign(SEED, 0, sha3_256(new TextEncoder().encode(message))));
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

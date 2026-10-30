/**
 * RFC-008 / RFC-033 — Go → TypeScript SE interop.
 *
 * `testdata-go-se-vector.json` is produced by the Go SE identity
 * (`EMIT_SE_INTEROP=1 go test -run TestSeIdentityInteropVector`). The TypeScript
 * core must verify the Go-produced child blind-signature and the root ownership
 * proof, proving the Go SE is byte-compatible with the TS SE identity.
 */

import * as fs from 'fs';
import * as path from 'path';
import { verifySignatureDetailed, scriptFromWotsPk, scriptToAddress, hexToBytes } from '@totemsdk/core';

interface GoSeVector {
  rootPublicKey: string;
  rootAddress: string;
  childAddress: string;
  childPublicKey: string;
  message: string;
  signature: string;
  rootProof: { address: string; publicKey: string; signature: string; message: string };
  childPubKeys: string[];
  childAddrs: string[];
  timestamp: string;
}

function load(): GoSeVector {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'testdata-go-se-vector.json'), 'utf8'),
  ) as GoSeVector;
}

describe('Go ⇄ TypeScript SE identity interop (RFC-008/RFC-033)', () => {
  it('verifies the Go SE child blind-signature', () => {
    const v = load();
    const res = verifySignatureDetailed(v.childAddress, v.message, v.signature, v.childPublicKey);
    expect(res.valid).toBe(true);
  });

  it('verifies the Go root ownership proof', () => {
    const v = load();
    const res = verifySignatureDetailed(
      v.rootProof.address,
      v.rootProof.message,
      v.rootProof.signature,
      v.rootProof.publicKey,
    );
    expect(res.valid).toBe(true);
  });

  it('child address is derived from the child public key (not a reused index-0 digest)', () => {
    const v = load();
    const derived = scriptToAddress(scriptFromWotsPk(hexToBytes(v.childPublicKey)));
    expect(derived.toLowerCase()).toBe(v.childAddress.toLowerCase());
    // The published identity is the root anchor, distinct from the signing child.
    expect(v.rootPublicKey).not.toBe(v.childPublicKey);
  });
});

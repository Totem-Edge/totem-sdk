/**
 * RFC-033 — Go → TypeScript interop.
 *
 * `testdata-go-treekey-vector.json` is produced by the Go cgo binding
 * (`EMIT_GO_INTEROP=1 go test -run TestEmitGoTreeKeyVector`). The TypeScript/Rust
 * engine must deserialize and verify it, proving the two stacks are
 * byte-compatible in both directions.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  deserializeTreeSignature,
  verifyTreeSignature,
  hexToBytes,
} from '@totemsdk/core';

interface GoVector {
  digestHex: string;
  rootPubHex: string;
  sigHex: string;
}

describe('Go ⇄ TypeScript TreeSignature interop (RFC-033)', () => {
  it('verifies a Go-produced TreeSignature in TypeScript', () => {
    const raw = fs.readFileSync(
      path.join(__dirname, 'testdata-go-treekey-vector.json'),
      'utf8',
    );
    const v = JSON.parse(raw) as GoVector;

    const sig = deserializeTreeSignature(hexToBytes(v.sigHex));
    expect(sig.proofs.length).toBe(3);
    expect(verifyTreeSignature(hexToBytes(v.rootPubHex), hexToBytes(v.digestHex), sig)).toBe(true);
  });

  it('rejects a tampered Go vector digest', () => {
    const raw = fs.readFileSync(
      path.join(__dirname, 'testdata-go-treekey-vector.json'),
      'utf8',
    );
    const v = JSON.parse(raw) as GoVector;
    const bad = hexToBytes(v.digestHex);
    bad[0] ^= 0xff;
    const sig = deserializeTreeSignature(hexToBytes(v.sigHex));
    expect(verifyTreeSignature(hexToBytes(v.rootPubHex), bad, sig)).toBe(false);
  });
});

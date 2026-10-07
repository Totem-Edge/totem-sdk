/**
 * RFC-032/033 — Go → TypeScript auth-envelope interop.
 *
 * `testdata-go-auth-envelope.json` is produced by the Go lookup client
 * (`EMIT_GO_ENVELOPE=1 go test -run TestEmitGoAuthEnvelope`). The TypeScript
 * protocol verifier must accept it, proving a Go client can authenticate to a
 * TS node (the digest + WOTS signature are byte-compatible).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  deserializeTreeSignature,
  verifyTreeSignature,
  hexToBytes,
} from '@totemsdk/core';
import { verifyMessageAuth } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';

interface GoEnvelope {
  rootPublicKey: string;
  nonce: number;
  expiresAt: number;
  signature: string;
  message: LookupMessage;
}

function load(): GoEnvelope {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'testdata-go-auth-envelope.json'), 'utf8'),
  ) as GoEnvelope;
}

describe('Go ⇄ TypeScript auth-envelope interop (RFC-032/033)', () => {
  it('verifies a Go-signed auth envelope in TypeScript', async () => {
    const env = load();
    const msg = { ...env.message, auth: {
      rootPublicKey: env.rootPublicKey,
      signature: env.signature,
      nonce: env.nonce,
      expiresAt: env.expiresAt,
    } } as LookupMessage;

    const verifier = (digest: Uint8Array, sig: Uint8Array, pk: Uint8Array) =>
      verifyTreeSignature(pk, digest, deserializeTreeSignature(sig));

    const ok = await verifyMessageAuth(msg, verifier, 0);
    expect(ok).toBe(true);
  });

  it('rejects a tampered Go envelope (nonce changed)', async () => {
    const env = load();
    const msg = { ...env.message, auth: {
      rootPublicKey: env.rootPublicKey,
      signature: env.signature,
      nonce: env.nonce + 1,
      expiresAt: env.expiresAt,
    } } as LookupMessage;

    const verifier = (digest: Uint8Array, sig: Uint8Array, pk: Uint8Array) =>
      verifyTreeSignature(pk, digest, deserializeTreeSignature(sig));

    const ok = await verifyMessageAuth(msg, verifier, 0);
    expect(ok).toBe(false);
  });
});

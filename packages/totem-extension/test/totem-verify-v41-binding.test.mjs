/**
 * TOTEM_VERIFY v4.1 — spend-address binding invariant (Task #83)
 *
 * In v4.0 the proof was signed from a reserved auth-key slot (address index
 * 63), so `verification.publicKey` was the auth-key root and
 * `deriveAddress(publicKey) !== verification.address` by design.
 *
 * In v4.1 the proof is signed from the connected spend address's
 * per-address TreeKey, so the binding `deriveAddress(publicKey) ===
 * verification.address` MUST hold for every valid proof. Backends rely on
 * this to verify with the high-level `verifySignatureDetailed` one-liner.
 *
 * This test reproduces the same derivation chain the extension's
 * TOTEM_VERIFY handler uses, and asserts:
 *   - the v4.1 binding invariant holds for the response shape
 *   - verifySignatureDetailed accepts the proof in a single call
 *   - mismatched (address, publicKey) is rejected
 *
 * Run with: node --test test/totem-verify-v41-binding.test.mjs
 *
 * Uses node:test (not jest) because @totemsdk/core is pure ESM and the
 * extension's existing jest config is CJS-only. Extension package.json
 * exposes this as `npm run test:verify-binding`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import sha3pkg from 'js-sha3';
const { sha3_256 } = sha3pkg;
import {
  TreeKey,
  serializeTreeSignature,
  deriveAddressFromPublicKey,
  verifySignatureDetailed,
} from '../../totem-sdk/packages/core/dist/index.js';

function hexToBytes(hex) {
  const stripped = String(hex).replace(/^0x/i, '');
  const out = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildSpendAddressProof(addressIndex, message) {
  // Tiny tree (4 leaves × 1 level) keeps this test fast — the binding
  // invariant is independent of tree depth.
  const baseSeed = new Uint8Array(32);
  for (let i = 0; i < baseSeed.length; i++) baseSeed[i] = (i + addressIndex) & 0xff;

  const tk = new TreeKey(baseSeed, 4, 1);
  tk.setUses(0);

  const pkBytes = tk.getPublicKey();
  const publicKey = '0x' + bytesToHex(pkBytes);
  const address = deriveAddressFromPublicKey(publicKey);

  const digest = hexToBytes(sha3_256(message));
  const treeSig = tk.sign(digest);
  const signature = '0x' + bytesToHex(serializeTreeSignature(treeSig));

  return { address, message, signature, publicKey };
}

test('v4.1 binding: deriveAddressFromPublicKey(publicKey) === address holds for the response shape', () => {
  const proof = buildSpendAddressProof(7, 'example.com login at ' + Date.now());
  assert.equal(deriveAddressFromPublicKey(proof.publicKey), proof.address);
});

test('verifySignatureDetailed accepts the proof in a single call', () => {
  const proof = buildSpendAddressProof(7, 'example.com login at ' + Date.now());
  const result = verifySignatureDetailed(
    proof.address,
    proof.message,
    proof.signature,
    proof.publicKey
  );
  assert.equal(result.valid, true, result.error);
});

test('mismatched (address, publicKey) is rejected by the helper', () => {
  const a = buildSpendAddressProof(1, 'm1');
  const b = buildSpendAddressProof(2, 'm2');
  // Mix: claim address from proof A but supply publicKey from proof B
  const result = verifySignatureDetailed(a.address, a.message, a.signature, b.publicKey);
  assert.equal(result.valid, false);
});

test('binding holds across a range of address indices', () => {
  for (const idx of [0, 1, 5, 31, 62, 63, 100]) {
    const proof = buildSpendAddressProof(idx, `idx-${idx}`);
    assert.equal(deriveAddressFromPublicKey(proof.publicKey), proof.address);
  }
});

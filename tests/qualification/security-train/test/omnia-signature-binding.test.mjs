/**
 * RFC-078 — a channel signature must recover the WOTS leaf it claims.
 *
 * If index binding is dropped the verifier accepts a signature made at another
 * leaf, so the claimed `signingIndices` stop constraining which key was used.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUnifiedChildTreeKey, serializeTreeSignature } from '../../../../packages/core/dist/index.js';
import { deriveSignatureLeafBinding } from '../../../../packages/omnia/dist/index.js';
import { initCoreWasm } from '../_shared/init-core-wasm.mjs';

await initCoreWasm();

test('deriveSignatureLeafBinding is exported from the omnia entry', () => {
  assert.equal(typeof deriveSignatureLeafBinding, 'function');
});

test('a signature made at leaf 5 reports l1=0, l2=5', () => {
  const key = createUnifiedChildTreeKey(new Uint8Array(32).fill(7), 0);
  key.setUses(5);
  const signature = serializeTreeSignature(key.sign(new Uint8Array(32).fill(1)));

  const binding = deriveSignatureLeafBinding(signature);
  assert.ok(binding, 'signature did not recover a leaf binding');
  assert.equal(binding.l1, 0);
  assert.equal(binding.l2, 5);
  assert.equal(binding.high, 0);
});

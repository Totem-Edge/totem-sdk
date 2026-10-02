/**
 * Regenerate test/kernel-baseline.json (RFC-031 P2).
 *
 * Preserves existing parity annotations; new kernels default to `pending` so a
 * kernel can never be silently added without triage. Run from packages/core
 * after building dist:
 *
 *   node test/gen-kernel-baseline.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

import * as async from '../dist/wasm-async.js';

// Known parity coverage (see src/__tests__/*.parity.test.ts).
const PARITY = {
  sha3_256: 'wots-parity',
  wotsSign: 'wots-parity',
  wotsVerify: 'wots-parity',
  wotsVerifyDigest: 'wots-parity',
  wotsPkFromSig: 'wots-parity',
  wotsPublicKeyFromSeed: 'wots-parity',
  wotsSignBatch: 'wots-parity',
  derivePKdigest: 'wots-parity',
  derivePKdigestBatch: 'wots-parity',
  deriveFullPublicKey: 'wots-parity',
  deriveFullPublicKeyBatch: 'wots-parity',
  serializeTransaction: 'transaction.serializer-parity',
  computeTransactionDigest: 'transaction.serializer-parity',
  precomputeTransactionCoinID: 'transaction.serializer-parity',
  writeMiniNumber: 'Streamable.parity',
  writeMiniData: 'Streamable.parity',
  writeMiniString: 'Streamable.parity',
  derivePerAddressSeed: 'perAddressDerivation.parity',
  deriveChainSeedJava: 'perAddressDerivation.parity',
  deriveRootPrivSeed: 'perAddressDerivation.parity',
  createUnifiedChildTreeKey: 'perAddressDerivation.parity',
  createUnifiedRootTreeKey: 'perAddressDerivation.parity',
  deriveUnifiedAddressPublicKey: 'perAddressDerivation.parity',
  // WASM ↔ JS-kernel differential parity.
  bytesToHex: 'legacy-differential.parity',
  hexToBytes: 'legacy-differential.parity',
  concatBytes: 'legacy-differential.parity',
  cleanSeedPhrase: 'legacy-differential.parity',
  makeMxAddress: 'legacy-differential.parity',
  parseMxAddress: 'legacy-differential.parity',
  phraseToSeed: 'legacy-differential.parity',
  validatePhrase: 'legacy-differential.parity',
  wotsKeypairFromSeed: 'legacy-differential.parity',
  // WASM functional / self-consistency.
  createChallenge: 'wasm-functional',
  validateChallenge: 'wasm-functional',
  getParams: 'wasm-functional',
  timingSafeEqual: 'wasm-functional',
  hashChain: 'wasm-functional',
  expandPrivateKey: 'wasm-functional',
  mmrRootFromPublicKeys: 'wasm-functional',
  generateWordList: 'wasm-functional',
  wotsAddressFromKeypair: 'wasm-functional',
  wasmTreeKeyFree: 'wasm-functional',
  wasmTreeKeyGetMaxUses: 'wasm-functional',
  wasmTreeKeyGetPublicKey: 'wasm-functional',
  wasmTreeKeyGetUses: 'wasm-functional',
  wasmTreeKeyNew: 'wasm-functional',
  wasmTreeKeySetUses: 'wasm-functional',
  wasmTreeKeySign: 'wasm-functional',
  mineTxPoW: 'wasm-functional',
  mineTxPoWChunk: 'wasm-functional',
};

let previous = {};
try {
  previous = JSON.parse(readFileSync(new URL('./kernel-baseline.json', import.meta.url), 'utf8')).kernels ?? {};
} catch { /* first run */ }

const exports = Object.keys(async)
  .filter((name) => typeof async[name] === 'function' && name !== 'init' && name !== 'initSync')
  .sort();

const kernels = {};
for (const name of exports) kernels[name] = PARITY[name] ?? previous[name] ?? 'pending';

const baseline = {
  note: 'RFC-031 P2 kernel coverage matrix. Each WASM kernel must be triaged (parity test or pending). Regenerate: node test/gen-kernel-baseline.mjs',
  kernels,
  initHelpers: ['init', 'initSync'],
};

writeFileSync(new URL('./kernel-baseline.json', import.meta.url), JSON.stringify(baseline, null, 2) + '\n');
const covered = Object.values(kernels).filter((ref) => ref !== 'pending').length;
console.log(`wrote kernel-baseline.json: ${exports.length} kernels, ${covered} covered, ${exports.length - covered} pending`);

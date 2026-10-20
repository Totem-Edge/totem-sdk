#!/usr/bin/env node
/**
 * Signature parity — TS vs Rust (RFC-009 / RFC-033 / RFC-048).
 *
 * Asserts the TypeScript signature verifiers and the Rust crypto engine agree on
 * identical inputs, for both signature forms Minima uses:
 *
 *   - flat single-key WOTS  : TS `wotsVerifyDigest`     ↔ Rust `wots_verify_digest`
 *   - canonical tree sig    : TS `verifyTreeSignature`  ↔ Rust `verify_tree_signature`
 *
 * and that both reject tampering identically (wrong digest / mutated signature).
 * This is the drift guard between the two implementations of the same crypto.
 *
 * Requires the built dist (core, kissvm) and the core-wasm web + nodejs builds.
 * Usage: node scripts/custody-signature-parity.mjs
 */
import './lib/init-core-wasm.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);
const require = createRequire(import.meta.url);

const CORE_WASM_BG = join(ROOT, 'packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm');
if (!existsSync(CORE_WASM_BG)) {
  console.error('✗ core-wasm web build missing — run the core-wasm wasm build first');
  process.exit(1);
}
const coreWasmMod = await load('packages/core-wasm/pkg-web/totemsdk_core_wasm.js');
await coreWasmMod.default(readFileSync(CORE_WASM_BG));
const rust = require(join(ROOT, 'packages/core-wasm/pkg-node/totemsdk_core_wasm.js'));

const core = await load('packages/core/dist/index.js');
const { treeSignatureToWasm } = await load('packages/kissvm/dist/index.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}
function agree(label, ts, rs, expected) {
  check(`${label} [ts=${ts} rust=${rs}]`, ts === rs && ts === expected, `expected ${expected}`);
}

const SEEDS = [0x01, 0x7f, 0xe3];
const DIGESTS = [0x11, 0x9a, 0xff];

console.log('flat WOTS: TS wotsVerifyDigest ↔ Rust wots_verify_digest');
for (const s of SEEDS) {
  for (const d of DIGESTS) {
    const seed = new Uint8Array(32).fill(s);
    const digest = new Uint8Array(32).fill(d);
    const pk = core.derivePKdigest(seed, 0);
    const sig = core.wotsSign(seed, 0, digest);
    agree(`seed=${s} digest=${d} valid`, core.wotsVerifyDigest(sig, digest, pk), rust.wots_verify_digest_wasm(sig, digest, pk), true);
    const wrongDigest = new Uint8Array(32).fill(d ^ 0xff);
    agree(`seed=${s} digest=${d} wrong-digest`, core.wotsVerifyDigest(sig, wrongDigest, pk), rust.wots_verify_digest_wasm(sig, wrongDigest, pk), false);
    const tampered = Uint8Array.from(sig); tampered[0] ^= 0xff;
    agree(`seed=${s} digest=${d} tampered-sig`, core.wotsVerifyDigest(tampered, digest, pk), rust.wots_verify_digest_wasm(tampered, digest, pk), false);
  }
}

console.log('tree signature: TS verifyTreeSignature ↔ Rust verify_tree_signature');
for (const s of SEEDS) {
  const seed = new Uint8Array(32).fill(s);
  const tk = new core.TreeKey(seed, 64, 3);
  const root = tk.getPublicKey();
  for (const d of DIGESTS) {
    const digest = new Uint8Array(32).fill(d);
    const sig = tk.sign(digest);
    const json = JSON.stringify(treeSignatureToWasm(sig));
    agree(`seed=${s} digest=${d} valid`, core.verifyTreeSignature(root, digest, sig), rust.verify_tree_signature_wasm(root, digest, json), true);
    const wrongDigest = new Uint8Array(32).fill(d ^ 0xff);
    agree(`seed=${s} digest=${d} wrong-digest`, core.verifyTreeSignature(root, wrongDigest, sig), rust.verify_tree_signature_wasm(root, wrongDigest, json), false);
  }
}

if (failures > 0) {
  console.error(`\nSignature-parity gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nSignature-parity gate: TS and Rust verifiers agree on all vectors.');

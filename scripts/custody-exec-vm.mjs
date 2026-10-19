#!/usr/bin/env node
/**
 * Custody escape — real-VM test (RFC-048 proof-ladder L3/L5 direction).
 *
 * `custody-exec.mjs` runs the escape branches through the *TypeScript* KISSVM
 * evaluator. This gate runs the SAME branches through the **Rust/WASM KISSVM**
 * (`packages/kissvm/rust/pkg-node`, an independent implementation that mirrors
 * Minima's VM) and cross-checks the two agree — so the custody fix is validated
 * by a second VM, not just one evaluator.
 *
 * Signatures are **real**: each signer is a Minima `TreeKey`, and every
 * `SIGNEDBY`/`MULTISIG` is satisfied by an actual tree signature over the
 * transaction digest. The Rust VM verifies these via
 * `totemsdk_core_wasm::treekey::verify_tree_signature` — the same Rust engine the
 * node and the JS bridge use (RFC-048 §5/§12) — so this is a genuine
 * TS-vs-Rust signature-parity check, not a `simulationMode` presence check.
 *
 * A fully isolated Minima *node* run (real chain inclusion) remains the L4 bar;
 * this is the cross-implementation VM check.
 *
 * Requires: built dist (omnia-vtxo, omnia-factory, kissvm, core) AND the kissvm
 * wasm nodejs build (`cd packages/kissvm/rust && wasm-pack build --target nodejs
 * --out-dir pkg-node`). Usage: node scripts/custody-exec-vm.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

const WASM_PATH = join(ROOT, 'packages/kissvm/rust/pkg-node/kissvm_wasm.js');
if (!existsSync(WASM_PATH)) {
  console.error('✗ kissvm wasm nodejs build missing — run: (cd packages/kissvm/rust && wasm-pack build --target nodejs --out-dir pkg-node)');
  process.exit(1);
}
const wasm = require(WASM_PATH);

// Initialize the core crypto engine's bundler build so the ESM dist used by the
// TS evaluator can verify signatures in Node.
const CORE_WASM_JS = join(ROOT, 'packages/core-wasm/pkg-web/totemsdk_core_wasm.js');
const CORE_WASM_BG = join(ROOT, 'packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm');
if (!existsSync(CORE_WASM_JS)) {
  console.error('✗ core-wasm web build missing — run the core-wasm wasm build first');
  process.exit(1);
}
const coreWasmMod = await load('packages/core-wasm/pkg-web/totemsdk_core_wasm.js');
await coreWasmMod.default(readFileSync(CORE_WASM_BG));

const { evaluateScript, toWasmWitness } = await load('packages/kissvm/dist/index.js');
const { buildPoolScript } = await load('packages/omnia-vtxo/dist/index.js');
const { buildFactoryScript } = await load('packages/omnia-factory/dist/index.js');
const { TreeKey } = await load('packages/core/dist/index.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const hex = (u8) => Buffer.from(u8).toString('hex');
const pk = (treeKey) => '0x' + hex(treeKey.getPublicKey());

/** A signer identity (TreeKey) — root public key is the SIGNEDBY identity. */
const mk = (fill) => new TreeKey(new Uint8Array(32).fill(fill), 64, 3);

const operatorKey = mk(0xa1);
const holderKey = mk(0xb2);
const partyAKey = mk(0xc3);
const partyBKey = mk(0xd4);

const operator = pk(operatorKey);
const holder = pk(holderKey);
const A = pk(partyAKey);
const B = pk(partyBKey);

const DIGEST = new Uint8Array(32).fill(0x42);
const POOL = '0x' + 'dd'.repeat(32);
const FACTORY = 'FACTORY';

/** Sign `digest` with each key → Map(rootKeyHex → TreeSignature). */
function signWith(keys, digest = DIGEST) {
  const m = new Map();
  for (const k of keys) m.set(hex(k.getPublicKey()), k.sign(digest));
  return m;
}

/** Run via the Rust/WASM VM (canonical TS witness → wasm witness). */
function wasmEval(script, sigs, ctx) {
  const res = wasm.evaluate_script_wasm(script, toWasmWitness({ signatures: sigs }), {
    block: ctx.block,
    inputIndex: 0,
    inputs: ctx.inputs,
    outputs: ctx.outputs,
    state: new Map(Object.entries(ctx.state).map(([p, v]) => [Number(p), String(v)])),
    prevState: new Map(Object.entries(ctx.prevState).map(([p, v]) => [Number(p), String(v)])),
    txDigest: Array.from(ctx.txDigest),
  });
  return res.passed === true;
}
/** Run via the TypeScript evaluator (real TreeSignature witness). */
function tsEval(script, sigs, ctx) {
  return evaluateScript(script, { signatures: sigs }, { ...ctx, inputIndex: 0 }).passed === true;
}

function both(label, script, sigs, ctx, expected) {
  const w = wasmEval(script, sigs, ctx);
  const t = tsEval(script, sigs, ctx);
  check(`${label} [wasm=${w} ts=${t}]`, w === expected && t === expected, `expected ${expected}`);
}

// ── VTXO pool: per-share unilateral exit (real signature) ────────────────────
const pool = buildPoolScript({ operatorPublicKeyDigest: operator, holders: [holder], exitBlock: 100 });
const poolExit = ({ spentShare, successorShare, amount, remainder }) => {
  const outputs = [{ address: holder, amount: Number(spentShare), tokenId: '0x00', keepState: false }];
  if (remainder) outputs.push({ address: POOL, amount: Number(remainder), tokenId: '0x00', keepState: true });
  return {
    block: 200,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: POOL, amount: Number(amount), tokenId: '0x00' }],
    outputs,
    state: { 101: '1', 102: '100', 128: String(successorShare) },
    prevState: { 101: '0', 102: '100', 128: String(spentShare) },
  };
};
console.log('real VM: omnia-vtxo pool owner exit (real TreeSignature, Rust/WASM vs TS)');
both('full-share exit with real holder sig', pool, signWith([holderKey]), poolExit({ spentShare: 1000, successorShare: 0, amount: 1000 }), true);
both('partial-share exit (payout@0, remainder@1)', pool, signWith([holderKey]), poolExit({ spentShare: 1000, successorShare: 0, amount: 1500, remainder: 500 }), true);
both('rejected: successor does not zero the share', pool, signWith([holderKey]), poolExit({ spentShare: 1000, successorShare: 1000, amount: 1000 }), false);
both('rejected: signer is not the holder (wrong root)', pool, signWith([operatorKey]), poolExit({ spentShare: 1000, successorShare: 0, amount: 1000 }), false);
both('rejected: holder sig over a tampered digest', pool, signWith([holderKey], new Uint8Array(32).fill(0x43)), poolExit({ spentShare: 1000, successorShare: 0, amount: 1000 }), false);

// ── VTXO pool: cooperative MULTISIG(operator + holders) ──────────────────────
const poolCoopCtx = {
  block: 50,
  txDigest: DIGEST,
  inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: POOL, amount: 1000, tokenId: '0x00' }],
  outputs: [{ address: POOL, amount: 1000, tokenId: '0x00', keepState: true }],
  state: { 101: '1', 102: '100', 128: '1000' },
  prevState: { 101: '0', 102: '100', 128: '1000' },
};
console.log('real VM: omnia-vtxo pool cooperative update MULTISIG(2)');
both('accepted with operator + holder real sigs', pool, signWith([operatorKey, holderKey]), poolCoopCtx, true);
both('rejected with only the holder sig (2-of-2 unmet)', pool, signWith([holderKey]), poolCoopCtx, false);

// ── Factory: per-party escape (real signature) ───────────────────────────────
const factory = buildFactoryScript([
  { partyId: 'a', publicKeyDigest: A, addressIndex: 0, contributionAmount: 1000n, settlementAddress: A },
  { partyId: 'b', publicKeyDigest: B, addressIndex: 1, contributionAmount: 500n, settlementAddress: B },
]);
const factoryExit = ({ amount, remainder, successorZero }) => {
  const outputs = [{ address: A, amount: 1000, tokenId: '0x00', keepState: false }];
  if (remainder) outputs.push({ address: FACTORY, amount: Number(remainder), tokenId: '0x00', keepState: true });
  return {
    block: 300,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'ee'.repeat(32), address: FACTORY, amount: Number(amount), tokenId: '0x00' }],
    outputs,
    state: { 100: '0', 103: '256', 128: successorZero ? '0' : '1000', 129: '500' },
    prevState: { 100: '0', 103: '256', 128: '1000', 129: '500' },
  };
};
console.log('real VM: omnia-factory per-party escape (real TreeSignature)');
both('party A escape with real sig (whole share)', factory, signWith([partyAKey]), factoryExit({ amount: 1000, remainder: 0, successorZero: true }), true);
both('party A escape (partial, payout@0 remainder@1)', factory, signWith([partyAKey]), factoryExit({ amount: 1500, remainder: 500, successorZero: true }), true);
both('rejected: successor does not zero party share', factory, signWith([partyAKey]), factoryExit({ amount: 1000, remainder: 0, successorZero: false }), false);
both('rejected: signer is party B, not A', factory, signWith([partyBKey]), factoryExit({ amount: 1000, remainder: 0, successorZero: true }), false);

// ── Factory: cooperative MULTISIG(N-of-N) ────────────────────────────────────
const factoryCoopCtx = {
  block: 100,
  txDigest: DIGEST,
  inputs: [{ coinId: '0x' + 'ee'.repeat(32), address: FACTORY, amount: 1500, tokenId: '0x00' }],
  outputs: [{ address: FACTORY, amount: 1500, tokenId: '0x00', keepState: true }],
  state: { 100: '0', 103: '256', 128: '1000', 129: '500' },
  prevState: { 100: '0', 103: '256', 128: '1000', 129: '500' },
};
console.log('real VM: omnia-factory cooperative MULTISIG(2)');
both('accepted with both party real sigs', factory, signWith([partyAKey, partyBKey]), factoryCoopCtx, true);
both('rejected with only party A sig (2-of-2 unmet)', factory, signWith([partyAKey]), factoryCoopCtx, false);

if (failures > 0) {
  console.error(`\nReal-VM escape gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nReal-VM escape gate: Rust/WASM and TS evaluators agree on real-signature escape + MULTISIG branches.');

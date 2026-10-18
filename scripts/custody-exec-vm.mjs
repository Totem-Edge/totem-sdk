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
 * NOTE: the Rust/WASM `wots_verify` is stubbed to `false`, so signatures are
 * exercised via `simulationMode` (as in the TS gate). A fully isolated Minima
 * *node* run remains the L4 bar; this is the cross-implementation VM check.
 *
 * Requires: built dist (omnia-vtxo, omnia-factory, kissvm) AND the kissvm wasm
 * nodejs build (`cd packages/kissvm/rust && wasm-pack build --target nodejs
 * --out-dir pkg-node`). Usage: node scripts/custody-exec-vm.mjs
 */
import { existsSync } from 'node:fs';
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
const { evaluateScript } = await load('packages/kissvm/dist/index.js');
const { buildPoolScript } = await load('packages/omnia-vtxo/dist/index.js');
const { buildFactoryScript } = await load('packages/omnia-factory/dist/index.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const OP = '0x' + 'aa'.repeat(32);
const OWNER = '0x' + 'bb'.repeat(32);
const ownerKey = OWNER.slice(2).toLowerCase();
const opKey = OP.slice(2).toLowerCase();
const POOL = '0x' + 'dd'.repeat(32);

/** Run via the Rust/WASM VM (numeric-keyed Maps for state). */
function wasmEval(script, signers, { block, inputs, outputs, state, prevState }) {
  const signatures = new Map();
  for (const k of signers) signatures.set(k, new Uint8Array([1]));
  const res = wasm.evaluate_script_wasm(script, { signatures }, {
    block, inputIndex: 0, inputs, outputs,
    state: new Map(Object.entries(state).map(([p, v]) => [Number(p), String(v)])),
    prevState: new Map(Object.entries(prevState).map(([p, v]) => [Number(p), String(v)])),
    simulationMode: true,
  });
  return res.passed === true;
}
/** Run via the TypeScript evaluator (plain-object state). */
function tsEval(script, signers, ctx) {
  const signatures = new Map();
  for (const k of signers) signatures.set(k, new Uint8Array([1]));
  return evaluateScript(script, { signatures }, { ...ctx, inputIndex: 0, simulationMode: true }).passed === true;
}

function both(label, script, signers, ctx, expected) {
  const w = wasmEval(script, signers, ctx);
  const t = tsEval(script, signers, ctx);
  check(`${label} [wasm=${w} ts=${t}]`, w === expected && t === expected, `expected ${expected}`);
}

// ── VTXO pool owner exit ─────────────────────────────────────────────────────
const pool = buildPoolScript({ operatorPublicKeyDigest: OP, holders: [OWNER], exitBlock: 100 });
const poolCtx = ({ spentShare, successorShare, amount, remainder }) => {
  const outputs = [{ address: OWNER, amount: Number(spentShare), tokenId: '0x00', keepState: false }];
  if (remainder) outputs.push({ address: POOL, amount: Number(remainder), tokenId: '0x00', keepState: true });
  return {
    block: 200,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: POOL, amount: Number(amount), tokenId: '0x00' }],
    outputs,
    state: { 101: '1', 102: '0', 128: String(successorShare) },
    prevState: { 101: '0', 102: '100', 128: String(spentShare) },
  };
};
console.log('real VM: omnia-vtxo pool owner exit (Rust/WASM vs TS)');
both('full-share exit satisfiable', pool, [ownerKey], poolCtx({ spentShare: 1000, successorShare: 0, amount: 1000 }), true);
both('partial-share exit satisfiable (payout@0, remainder@1)', pool, [ownerKey], poolCtx({ spentShare: 1000, successorShare: 0, amount: 1500, remainder: 500 }), true);
both('rejected when successor does not zero the share', pool, [ownerKey], poolCtx({ spentShare: 1000, successorShare: 1000, amount: 1000 }), false);
both('rejected without the owner signature', pool, [opKey], poolCtx({ spentShare: 1000, successorShare: 0, amount: 1000 }), false);

// ── Factory per-party escape ─────────────────────────────────────────────────
const A = '0x' + '11'.repeat(32), B = '0x' + '22'.repeat(32);
const aKey = A.slice(2).toLowerCase();
const FACTORY = 'FACTORY';
const factory = buildFactoryScript([
  { partyId: 'a', publicKeyDigest: A, addressIndex: 0, contributionAmount: 1000n, settlementAddress: A },
  { partyId: 'b', publicKeyDigest: B, addressIndex: 1, contributionAmount: 500n, settlementAddress: B },
]);
const factoryCtx = ({ amount, remainder, successorZero }) => {
  const outputs = [{ address: A, amount: 1000, tokenId: '0x00', keepState: false }];
  if (remainder) outputs.push({ address: FACTORY, amount: Number(remainder), tokenId: '0x00', keepState: true });
  return {
    block: 200,
    inputs: [{ coinId: '0x' + 'ee'.repeat(32), address: FACTORY, amount: Number(amount), tokenId: '0x00' }],
    outputs,
    state: { 100: '0', 103: '0', 128: successorZero ? '0' : '1000', 129: '500' },
    prevState: { 100: '0', 103: '0', 128: '1000', 129: '500' },
  };
};
console.log('real VM: omnia-factory per-party escape (Rust/WASM vs TS)');
both('party escape satisfiable (whole share)', factory, [aKey], factoryCtx({ amount: 1000, remainder: 0, successorZero: true }), true);
both('party escape satisfiable (partial, payout@0 remainder@1)', factory, [aKey], factoryCtx({ amount: 1500, remainder: 500, successorZero: true }), true);
both('rejected when successor does not zero the party share', factory, [aKey], factoryCtx({ amount: 1000, remainder: 0, successorZero: false }), false);

if (failures > 0) {
  console.error(`\nReal-VM escape gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nReal-VM escape gate: Rust/WASM and TS evaluators agree on the escape branches.');

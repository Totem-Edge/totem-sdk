#!/usr/bin/env node
/**
 * RFC-054 Gate 0 — bilateral channel script proof (real VM, offline).
 *
 * Gate 0 requires the *channel* scripts used by v1 to be exercised in the real
 * VM. This gate runs the Eltoo channel script built by `buildEltooScript`
 * (`@totemsdk/omnia`) through:
 *   - the Rust/WASM KISSVM (`packages/kissvm/rust/pkg-node`), and
 *   - the TypeScript KISSVM evaluator,
 * with **real** TreeKey signatures and `MULTISIG(2 …)` witnesses, and requires
 * both VMs to agree on every case.
 *
 * Scope: the v1 bilateral channel (`direct`), whose two spend paths are
 *   - update:     SETTLEMENT false, SEQUENCE >  PREVSEQUENCE, both signatures
 *   - settlement: SETTLEMENT true,  SEQUENCE EQ PREVSEQUENCE, both signatures,
 *                 @COINAGE >= contest delay
 * A fully isolated Minima *node* run (real chain inclusion) remains the L4 bar.
 *
 * Requires: built dist (core, omnia, kissvm) and the kissvm wasm nodejs build.
 * Usage: node scripts/omnia-channel-vm.mjs
 */
import './lib/init-core-wasm.mjs';
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

const CORE_WASM_JS = join(ROOT, 'packages/core-wasm/pkg-web/totemsdk_core_wasm.js');
const CORE_WASM_BG = join(ROOT, 'packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm');
if (!existsSync(CORE_WASM_JS)) {
  console.error('✗ core-wasm web build missing — build core-wasm wasm first');
  process.exit(1);
}
const coreWasmMod = await load('packages/core-wasm/pkg-web/totemsdk_core_wasm.js');
await coreWasmMod.default(readFileSync(CORE_WASM_BG));

const { evaluateScript, toWasmWitness } = await load('packages/kissvm/dist/index.js');
const { TreeKey, toNodeScript } = await load('packages/core/dist/index.js');
const { buildEltooScript, ELTOO_CONTEST_DELAY_BLOCKS } = await load('packages/omnia/dist/index.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const hex = (u8) => Buffer.from(u8).toString('hex');
const pk = (k) => '0x' + hex(k.getPublicKey());
const mk = (fill) => new TreeKey(new Uint8Array(32).fill(fill), 64, 3);

const aliceKey = mk(0xa1);
const bobKey = mk(0xb2);
const outsiderKey = mk(0xc3);

const parties = [
  { partyId: 'alice', publicKeyDigest: pk(aliceKey), addressIndex: 0 },
  { partyId: 'bob', publicKeyDigest: pk(bobKey), addressIndex: 1 },
];

const DIGEST = new Uint8Array(32).fill(0x42);
const CHANNEL = '0x' + 'cc'.repeat(32);
const AMOUNT = 1000;
const CONTEST = Number(ELTOO_CONTEST_DELAY_BLOCKS);
const BLOCK = 1000;

const script = buildEltooScript(parties);

function signWith(keys, digest = DIGEST) {
  const m = new Map();
  for (const k of keys) m.set(hex(k.getPublicKey()), k.sign(digest));
  return m;
}

function wasmEval(s, sigs, ctx) {
  const res = wasm.evaluate_script_wasm(s, toWasmWitness({ signatures: sigs }), {
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

function tsEval(s, sigs, ctx) {
  return evaluateScript(s, { signatures: sigs }, { ...ctx, inputIndex: 0 }).passed === true;
}

function both(label, s, sigs, ctx, expected) {
  const w = wasmEval(s, sigs, ctx);
  const t = tsEval(s, sigs, ctx);
  check(`${label} [wasm=${w} ts=${t}]`, w === expected && t === expected, `expected ${expected}`);
}

/** A spend of the channel coin. `coinage` is @BLOCK − coinCreatedBlock. */
function spend({ settlement, sequence, prevSequence, coinage = 0, block = BLOCK }) {
  return {
    block,
    txDigest: DIGEST,
    inputs: [{
      coinId: CHANNEL,
      address: CHANNEL,
      amount: AMOUNT,
      tokenId: '0x00',
      keepState: true,
      coinCreatedBlock: block - coinage,
    }],
    outputs: [{
      address: CHANNEL,
      amount: AMOUNT,
      tokenId: '0x00',
      keepState: true,
    }],
    state: { 100: settlement ? '1' : '0', 101: String(sequence) },
    prevState: { 100: '0', 101: String(prevSequence) },
  };
}

console.log('RFC-054 Gate 0: Eltoo channel update/settlement (real MULTISIG(2), Rust/WASM vs TS)');
console.log(`  script:\n${script.split('\n').map((l) => '    ' + l).join('\n')}`);

const both3 = () => signWith([aliceKey, bobKey]);

// ── Update path: advance the off-chain state ────────────────────────────────
both('update: both signatures, sequence advances', script, both3(),
  spend({ settlement: false, sequence: 5, prevSequence: 4 }), true);
both('update: single signature is rejected', script, signWith([aliceKey]),
  spend({ settlement: false, sequence: 5, prevSequence: 4 }), false);
both('update: equal sequence is rejected (no value transfer without advance)', script, both3(),
  spend({ settlement: false, sequence: 4, prevSequence: 4 }), false);
both('update: replayed stale sequence is rejected', script, both3(),
  spend({ settlement: false, sequence: 4, prevSequence: 5 }), false);
both('update: outsider signature does not satisfy MULTISIG(2)', script, signWith([aliceKey, outsiderKey]),
  spend({ settlement: false, sequence: 5, prevSequence: 4 }), false);
both('update: signatures over a tampered digest are rejected', script,
  signWith([aliceKey, bobKey], new Uint8Array(32).fill(0x43)),
  spend({ settlement: false, sequence: 5, prevSequence: 4 }), false);

// ── Settlement path: close on the agreed state ──────────────────────────────
both('settlement: both sigs, equal sequence, contest delay met', script, both3(),
  spend({ settlement: true, sequence: 5, prevSequence: 5, coinage: CONTEST }), true);
both('settlement: contest delay one block short is rejected', script, both3(),
  spend({ settlement: true, sequence: 5, prevSequence: 5, coinage: CONTEST - 1 }), false);
both('settlement: sequence mismatch is rejected', script, both3(),
  spend({ settlement: true, sequence: 6, prevSequence: 5, coinage: CONTEST }), false);
both('settlement: single signature is rejected', script, signWith([bobKey]),
  spend({ settlement: true, sequence: 5, prevSequence: 5, coinage: CONTEST }), false);
both('settlement: replayed stale settlement is rejected', script, both3(),
  spend({ settlement: true, sequence: 4, prevSequence: 5, coinage: CONTEST }), false);

// ── Cross-branch attempts ───────────────────────────────────────────────────
both('settlement flag cannot be used to raise the sequence', script, both3(),
  spend({ settlement: true, sequence: 6, prevSequence: 5, coinage: CONTEST }), false);
both('update flag cannot close on an equal sequence', script, both3(),
  spend({ settlement: false, sequence: 5, prevSequence: 5 }), false);
both('update path ignores the contest delay (relative, resets per update)', script, both3(),
  spend({ settlement: false, sequence: 5, prevSequence: 4, coinage: 0 }), true);

// ── Script form and address-safety checks ───────────────────────────────────
check('channel script is node-canonical (idempotent toNodeScript)', toNodeScript(script) === script);
check('channel script has no VERIFYOUT (v1 is not exposed to the address/pubkey conflation)',
  !/VERIFYOUT/i.test(script), 'VERIFYOUT present');

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`✗ ${failures} case(s) failed`);
  process.exit(1);
}
console.log('✓ all channel cases agree across Rust/WASM and TS');

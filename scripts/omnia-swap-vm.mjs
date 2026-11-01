#!/usr/bin/env node
/**
 * RFC-054 Gate 0 — bilateral HTLC script proof (real VM, offline).
 *
 * RFC-054 §10 Gate 0 requires the channel and HTLC scripts used by v1 to be
 * exercised "in the real VM": honest swap, refund before/after timelock, wrong
 * preimage, wrong amount/asset and counterparty withholding.
 *
 * This gate runs the on-chain HTLC leg through:
 *   - the Rust/WASM KISSVM (`packages/kissvm/rust/pkg-node`), and
 *   - the TypeScript KISSVM evaluator,
 * with **real** TreeKey signatures over the transaction digest, and requires
 * both to agree on every case. A fully isolated Minima *node* run (real chain
 * inclusion) remains the L4 bar and is not attempted here.
 *
 * The cases encode RFC-069 §6 invariant 5: the claim branch MUST NOT remain
 * spendable once the refund branch is valid. The legacy (pre-fix) template is
 * included as a negative control — it is expected to ACCEPT a claim after the
 * timeout, which is exactly the defect this gate exists to catch.
 *
 * Requires: built dist (core, kissvm) and the kissvm wasm nodejs build
 * (`cd packages/kissvm/rust && wasm-pack build --target nodejs --out-dir pkg-node`).
 * Usage: node scripts/omnia-swap-vm.mjs
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
const {
  TreeKey,
  wotsAddressData,
  bytesToHex,
  sha3_256,
  HTLCHelper,
  createHTLCDescriptor,
} = await load('packages/core/dist/index.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const hex = (u8) => Buffer.from(u8).toString('hex');
const pk = (treeKey) => '0x' + hex(treeKey.getPublicKey());

/** A signer identity (TreeKey) — the root public key is the SIGNEDBY identity. */
const mk = (fill) => new TreeKey(new Uint8Array(32).fill(fill), 64, 3);

const ownerKey = mk(0xa1);      // funds the on-chain leg; refunds after timeout
const recipientKey = mk(0xb2);  // claims with the preimage before the timeout

const owner = pk(ownerKey);
const recipient = pk(recipientKey);

const DIGEST = new Uint8Array(32).fill(0x42);
const TIMEOUT = 100n;
const AMOUNT = 1000;

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

// ── The swap's on-chain leg ─────────────────────────────────────────────────
const secret = HTLCHelper.generateSecret();
const preimage = secret.preimage;
const hashlock = secret.hash;
const { script: htlcScript, address: htlcAddress } = HTLCHelper.createHTLC(
  owner,
  recipient,
  hashlock,
  TIMEOUT,
  'sha3',
);

console.log('RFC-054 Gate 0: HTLC claim/refund mutex (real TreeSignature, Rust/WASM vs TS)');
console.log(`  script: ${htlcScript}`);

/** A spend of the funded HTLC coin at `block`, with `preimage` in STATE(1). */
function spendCtx(block, statePreimage = undefined) {
  return {
    block,
    txDigest: DIGEST,
    inputs: [{
      coinId: '0x' + 'aa'.repeat(32),
      address: htlcAddress,
      amount: AMOUNT,
      tokenId: '0x00',
      keepState: false,
    }],
    outputs: [{
      address: wotsAddressData(recipient),
      amount: AMOUNT,
      tokenId: '0x00',
      keepState: false,
    }],
    state: statePreimage === undefined ? {} : { 1: statePreimage },
    prevState: {},
  };
}

const claim = (block, p = preimage) => spendCtx(block, p);
const refund = (block) => spendCtx(block);

// Honest claim: recipient reveals the preimage at or before the timeout.
both('claim before timeout, correct preimage', htlcScript, signWith([recipientKey]), claim(50), true);
both('claim exactly at timeout', htlcScript, signWith([recipientKey]), claim(100), true);

// The defect: a claim must not be spendable once the refund path is valid.
both('claim after timeout is rejected', htlcScript, signWith([recipientKey]), claim(101), false);
// After the timeout only the owner branch is reachable: a valid preimage plus a
// recipient signature is inert unless the owner also signs, and then it is a
// refund, not a claim. Assert the branch precedence rather than an outcome.
both('after timeout the preimage branch is inert (owner-only refund)', htlcScript, signWith([ownerKey, recipientKey]), claim(101), true);

// Honest refund.
both('refund after timeout', htlcScript, signWith([ownerKey]), refund(101), true);
both('refund at timeout is rejected', htlcScript, signWith([ownerKey]), refund(100), false);
both('refund with recipient sig is rejected', htlcScript, signWith([recipientKey]), refund(101), false);

// Wrong signer / wrong secret.
both('claim with owner sig only is rejected', htlcScript, signWith([ownerKey]), claim(50), false);
both('claim with wrong preimage is rejected', htlcScript, signWith([recipientKey]), claim(50, '0x' + '00'.repeat(32)), false);
both('claim with no preimage is rejected', htlcScript, signWith([recipientKey]), spendCtx(50), false);
both('claim with tampered digest is rejected', htlcScript, signWith([recipientKey], new Uint8Array(32).fill(0x43)), claim(50), false);

// Representation check: the node/SDK hash raw preimage bytes. Hashing the
// UTF-8 hex *text* must not satisfy a hashlock committed over the bytes.
const utf8Hashlock = '0x' + hex(sha3_256(new TextEncoder().encode(preimage)));
const utf8Script = HTLCHelper.createHTLC(owner, recipient, utf8Hashlock, TIMEOUT, 'sha3').script;
check('byte-encoding: raw-byte hashlock and utf8-text hashlock differ', utf8Hashlock.toLowerCase() !== hashlock.toLowerCase());
both('byte-encoding: preimage bytes do not satisfy a utf8-text hashlock', utf8Script, signWith([recipientKey]), claim(50), false);

// ── Negative control: the legacy (pre-fix) template ─────────────────────────
// Proves the gate detects the defect rather than passing vacuously.
const legacyScript = `IF @BLOCK GT ${TIMEOUT} AND SIGNEDBY(0x${owner.slice(2)}) THEN RETURN TRUE ENDIF RETURN (SIGNEDBY(0x${recipient.slice(2)}) AND SHA3(STATE(1)) EQ 0x${hashlock.slice(2)})`;
both('legacy template ACCEPTS a claim after timeout (control)', legacyScript, signWith([recipientKey]), claim(101), true);

// ── Builder parity ──────────────────────────────────────────────────────────
// The descriptor builder and the helper must emit the same script; drift here
// means a claim descriptor can disagree with the funded coin's script.
const descriptor = createHTLCDescriptor(htlcAddress, owner, recipient, hashlock, TIMEOUT, false, preimage);
check('descriptor script matches createHTLC script', descriptor.script === htlcScript, 'descriptor and helper disagree');

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(`✗ ${failures} case(s) failed`);
  process.exit(1);
}
console.log('✓ all HTLC cases agree across Rust/WASM and TS');

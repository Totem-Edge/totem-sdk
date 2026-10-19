#!/usr/bin/env node
/**
 * P-EXIT exercise covenant — real-VM test (RFC-050 §3 / RFC-048 proof-ladder L3/L5).
 *
 * The P-EXIT primitive is the load-bearing gap for every non-trivial Eefi
 * product: a party must be able to exercise/settle **without the counterparty's
 * cooperation**. This gate runs the covenant through **both** the TypeScript and
 * the Rust/WASM KISSVM with **real `TreeKey` tree signatures** and asserts they
 * agree on:
 *
 *   - the beneficiary can exercise in [maturity, recovery) with its own signature;
 *   - the owner **cannot** exercise/redirect during the window (only the
 *     beneficiary's signature opens the exercise branch);
 *   - the owner can reclaim **only after** the recovery block;
 *   - before maturity (and after recovery) no exercise spend is possible;
 *   - a permissionless `condition` variant triggers the fixed beneficiary payout
 *     with no signature (liquidation shape);
 *   - a signature over a tampered digest is rejected.
 *
 * Requires: built dist (kissvm, core) AND the kissvm wasm nodejs build.
 * Usage: node scripts/exercise-exec-vm.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);
const require = createRequire(import.meta.url);

const WASM_PATH = join(ROOT, 'packages/kissvm/rust/pkg-node/kissvm_wasm.js');
if (!existsSync(WASM_PATH)) {
  console.error('✗ kissvm wasm nodejs build missing — run: (cd packages/kissvm/rust && wasm-pack build --target nodejs --out-dir pkg-node)');
  process.exit(1);
}
const wasm = require(WASM_PATH);

const CORE_WASM_BG = join(ROOT, 'packages/core-wasm/pkg-web/totemsdk_core_wasm_bg.wasm');
if (!existsSync(CORE_WASM_BG)) {
  console.error('✗ core-wasm web build missing — run the core-wasm wasm build first');
  process.exit(1);
}
const coreWasmMod = await load('packages/core-wasm/pkg-web/totemsdk_core_wasm.js');
await coreWasmMod.default(readFileSync(CORE_WASM_BG));

const { evaluateScript, toWasmWitness, buildExerciseCovenant, exerciseCovenantStateVariables, buildCollateralBondScript, buildOracleConditionScript, buildOracleExerciseCovenant, buildMmrMembershipCovenant } = await load('packages/kissvm/dist/index.js');
const { TreeKey, MMRTree, serializeMMRProof, hexToBytes, bytesToHex, createMMRDataLeafNode } = await load('packages/core/dist/index.js');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const hex = (u8) => Buffer.from(u8).toString('hex');
const pk = (treeKey) => '0x' + hex(treeKey.getPublicKey());
const mk = (fill) => new TreeKey(new Uint8Array(32).fill(fill), 64, 3);

const beneficiaryKey = mk(0xb2);
const recoveryKey = mk(0xa1);
const beneficiary = pk(beneficiaryKey);
const recovery = pk(recoveryKey);

const DIGEST = new Uint8Array(32).fill(0x42);
const COVENANT = '0x' + 'dd'.repeat(32);
const MATURITY = 500n;
const RECOVERY = 600n;

const covenant = buildExerciseCovenant({ kind: 'unilateral-exercise', beneficiary, recovery });
const stateVars = exerciseCovenantStateVariables({ maturityBlock: MATURITY, recoveryBlock: RECOVERY });
console.log('P-EXIT state variables:', JSON.stringify(stateVars, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

function signWith(keys, digest = DIGEST) {
  const m = new Map();
  for (const k of keys) m.set(hex(k.getPublicKey()), k.sign(digest));
  return m;
}
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
function tsEval(script, sigs, ctx) {
  return evaluateScript(script, { signatures: sigs }, { ...ctx, inputIndex: 0 }).passed === true;
}
function both(label, script, sigs, ctx, expected) {
  const w = wasmEval(script, sigs, ctx);
  const t = tsEval(script, sigs, ctx);
  check(`${label} [wasm=${w} ts=${t}]`, w === expected && t === expected, `expected ${expected}`);
}

const ctx = ({ block, to, amount = 1000 }) => ({
  block,
  txDigest: DIGEST,
  inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount, tokenId: '0x00' }],
  outputs: [{ address: to, amount, tokenId: '0x00', keepState: false }],
  state: { 100: MATURITY.toString(), 101: RECOVERY.toString() },
  prevState: { 100: MATURITY.toString(), 101: RECOVERY.toString() },
});

console.log('P-EXIT: beneficiary exercise window (real TreeSignature, Rust/WASM vs TS)');
both('beneficiary exercises in-window with real sig', covenant, signWith([beneficiaryKey]), ctx({ block: 550, to: beneficiary }), true);
both('rejected before maturity', covenant, signWith([beneficiaryKey]), ctx({ block: 400, to: beneficiary }), false);
both('owner cannot exercise/redirect in-window', covenant, signWith([recoveryKey]), ctx({ block: 550, to: beneficiary }), false);
both('rejected with no signature', covenant, signWith([]), ctx({ block: 550, to: beneficiary }), false);
both('rejected on tampered digest', covenant, signWith([beneficiaryKey], new Uint8Array(32).fill(0x43)), ctx({ block: 550, to: beneficiary }), false);
both('beneficiary cannot exercise after recovery (window closed)', covenant, signWith([beneficiaryKey]), ctx({ block: 600, to: beneficiary }), false);

console.log('P-EXIT: owner recovery branch');
both('owner reclaims after recovery (no signature required)', covenant, signWith([]), ctx({ block: 650, to: recovery }), true);
both('owner cannot reclaim before recovery', covenant, signWith([]), ctx({ block: 550, to: recovery }), false);

console.log('P-EXIT: permissionless condition variant (liquidation shape)');
const liquidation = buildExerciseCovenant({
  kind: 'liquidation',
  beneficiary,
  recovery,
  condition: '@BLOCK GTE 500',
  requireSignature: false,
});
both('permissionless trigger pays fixed beneficiary', liquidation, signWith([]), ctx({ block: 550, to: beneficiary }), true);
both('rejected before the condition holds', liquidation, signWith([]), ctx({ block: 400, to: beneficiary }), false);
both('payout cannot be redirected to the owner', liquidation, signWith([]), ctx({ block: 550, to: recovery }), false);

console.log('P-EXIT: partial payout + remainder');
function ctxOutputs({ block, outputs, amount = 1000 }) {
  return {
    block,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount, tokenId: '0x00' }],
    outputs,
    state: { 100: MATURITY.toString(), 101: RECOVERY.toString() },
    prevState: { 100: MATURITY.toString(), 101: RECOVERY.toString() },
  };
}
const out = (to, amt, keepState = false) => ({ address: to, amount: amt, tokenId: '0x00', keepState });
const partial = buildExerciseCovenant({ kind: 'unilateral-exercise', beneficiary, recovery, payout: 400n });
both('partial exercise pays fixed payout + remainder to owner', partial, signWith([beneficiaryKey]),
  ctxOutputs({ block: 550, outputs: [out(beneficiary, 400), out(recovery, 600, true)] }), true);
both('rejected if the remainder is misdirected', partial, signWith([beneficiaryKey]),
  ctxOutputs({ block: 550, outputs: [out(beneficiary, 400), out('0x' + '99'.repeat(32), 600, true)] }), false);
both('rejected when the payout exceeds the balance', partial, signWith([beneficiaryKey]),
  ctxOutputs({ block: 550, amount: 300, outputs: [out(beneficiary, 400)] }), false);

console.log('OMP-21: collateral bond — objective-condition liquidation (real TreeSignature)');
function bondCtx({ block, to, amount = 1000 }) {
  return {
    block,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount, tokenId: '0x00' }],
    outputs: [{ address: to, amount, tokenId: '0x00', keepState: false }],
    state: { 100: '600' },
    prevState: { 100: '600' },
  };
}
const bond = buildCollateralBondScript({ borrower: beneficiary, lender: recovery, liquidationCondition: '@BLOCK GTE 500' });
both('lender releases collateral after repayment', bond, signWith([recoveryKey]), bondCtx({ block: 550, to: beneficiary }), true);
both('objective default pre-maturity lets the lender seize', bond, signWith([]), bondCtx({ block: 550, to: recovery }), true);
both('borrower cannot reclaim pre-maturity without release', bond, signWith([]), bondCtx({ block: 550, to: beneficiary }), false);
both('post-maturity default: lender seizes, borrower cannot race', bond, signWith([]), bondCtx({ block: 650, to: recovery }), true);
both('post-maturity default: borrower spend rejected', bond, signWith([]), bondCtx({ block: 650, to: beneficiary }), false);
const bondNoDefault = buildCollateralBondScript({ borrower: beneficiary, lender: recovery, liquidationCondition: '@BLOCK GTE 999' });
both('post-maturity with no default: borrower reclaims', bondNoDefault, signWith([]), bondCtx({ block: 650, to: beneficiary }), true);

console.log('OMP-18/19: oracle condition witness — quorum + freshness (real TreeSignature)');
const oracleA = mk(0x51);
const oracleB = mk(0x52);
const oa = pk(oracleA);
const ob = pk(oracleB);
const FEED = '0x' + 'fe'.repeat(32);
function oracleCtx({ block, value = 1000, valid = 600, feedState = FEED, to = beneficiary }) {
  return {
    block,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount: 1000, tokenId: '0x00' }],
    outputs: [{ address: to, amount: 1000, tokenId: '0x00', keepState: false }],
    state: { 120: String(value), 121: '500', 122: String(valid), 123: feedState },
    prevState: { 120: String(value), 121: '500', 122: String(valid), 123: FEED },
  };
}
const oracleSingle = buildOracleConditionScript({ oracles: [oa], comparison: { op: 'GTE', valueAtoms: 1000n }, beneficiary });
both('fresh in-window observation accepted', oracleSingle, signWith([oracleA]), oracleCtx({ block: 550 }), true);
both('rejected without the oracle signature', oracleSingle, signWith([]), oracleCtx({ block: 550 }), false);
both('rejected when stale', oracleSingle, signWith([oracleA]), oracleCtx({ block: 700 }), false);
both('rejected when the value fails the condition', oracleSingle, signWith([oracleA]), oracleCtx({ block: 550, value: 999 }), false);
both('rejected when the feed commitment is mutated', oracleSingle, signWith([oracleA]), oracleCtx({ block: 550, feedState: '0x' + 'ab'.repeat(32) }), false);
const oracleQuorum = buildOracleConditionScript({ oracles: [oa, ob], threshold: 2, comparison: { op: 'GTE', valueAtoms: 1000n } });
both('quorum met with both oracle sigs', oracleQuorum, signWith([oracleA, oracleB]), oracleCtx({ block: 550 }), true);
both('quorum unmet with one oracle sig', oracleQuorum, signWith([oracleA]), oracleCtx({ block: 550 }), false);

console.log('P-EXIT × OMP-19: non-cooperative oracle exercise (beneficiary alone, no oracle liveness)');
function oexCtx({ block, value = 1000, observed = 500, valid = 600, to = beneficiary }) {
  return {
    block,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount: 1000, tokenId: '0x00' }],
    outputs: [{ address: to, amount: 1000, tokenId: '0x00', keepState: false }],
    state: { 100: '500', 101: '600', 120: String(value), 121: String(observed), 122: String(valid), 123: FEED },
    prevState: { 100: '500', 101: '600', 120: String(value), 121: String(observed), 122: String(valid), 123: FEED },
  };
}
const oex = buildOracleExerciseCovenant({ beneficiary, recovery, comparison: { op: 'GTE', valueAtoms: 1000n } });
both('beneficiary exercises alone (committed observation)', oex, signWith([beneficiaryKey]), oexCtx({ block: 550 }), true);
both('rejected before maturity', oex, signWith([beneficiaryKey]), oexCtx({ block: 400 }), false);
both('rejected when the committed observation is stale', oex, signWith([beneficiaryKey]), oexCtx({ block: 550, valid: 400 }), false);
both('rejected when the value condition fails', oex, signWith([beneficiaryKey]), oexCtx({ block: 550, value: 999 }), false);
both('owner cannot exercise in-window', oex, signWith([recoveryKey]), oexCtx({ block: 550 }), false);
both('owner reclaims after recovery', oex, signWith([]), oexCtx({ block: 650, to: recovery }), true);

console.log('MMR membership covenant — per-leaf inclusion in a committed root (RFC-048 §12.4)');
const memberA = mk(0x61);
const memberB = mk(0x62);
const memberC = mk(0x63);
const leafA = pk(memberA);
const leafB = pk(memberB);
const leafC = pk(memberC);
const partyTree = MMRTree.fromPublicKeys([hexToBytes(leafA.slice(2)), hexToBytes(leafB.slice(2))]);
const partyRoot = '0x' + bytesToHex(partyTree.getRoot().data).toLowerCase();
const proofA = '0x' + bytesToHex(serializeMMRProof(partyTree.getProof(0))).toLowerCase();
const membership = buildMmrMembershipCovenant({ rootPort: 111, leafPort: 112, proofPort: 113 });
function memberCtx({ leaf, proof, to = leaf }) {
  return {
    block: 550,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount: 1000, tokenId: '0x00' }],
    outputs: [{ address: to, amount: 1000, tokenId: '0x00', keepState: false }],
    state: { 111: partyRoot, 112: leaf, 113: proof },
    prevState: { 111: partyRoot },
  };
}
both('member proves inclusion and is paid', membership, signWith([memberA]), memberCtx({ leaf: leafA, proof: proofA }), true);
both('rejected when the signer is not the leaf', membership, signWith([memberB]), memberCtx({ leaf: leafA, proof: proofA }), false);
both('rejected on a tampered proof', membership, signWith([memberA]), memberCtx({ leaf: leafA, proof: '0x' + proofA.slice(2, -2) + 'ff' }), false);
both('rejected when the leaf is not in the committed root', membership, signWith([memberC]), memberCtx({ leaf: leafC, proof: proofA }), false);

console.log('Balance set-root — per-leaf (pubkey, balance) inclusion (RFC-048 §12.4)');
const balanceTree = new MMRTree();
balanceTree.addLeaf(createMMRDataLeafNode(hexToBytes(leafA.slice(2)), 700n));
balanceTree.addLeaf(createMMRDataLeafNode(hexToBytes(leafB.slice(2)), 300n));
const balanceRoot = '0x' + bytesToHex(balanceTree.getRoot().data).toLowerCase();
const balanceProof = '0x' + bytesToHex(serializeMMRProof(balanceTree.getProof(0))).toLowerCase();
const balanceCovenant = buildMmrMembershipCovenant({ rootPort: 111, leafPort: 112, proofPort: 113, leafSumPort: 114, rootSumPort: 115 });
function balanceCtx({ leaf, proof, leafSum = '700', rootSum = '1000', amount = 700, to = leaf }) {
  return {
    block: 550,
    txDigest: DIGEST,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: COVENANT, amount, tokenId: '0x00' }],
    outputs: [{ address: to, amount, tokenId: '0x00', keepState: false }],
    state: { 111: balanceRoot, 112: leaf, 113: proof, 114: leafSum, 115: rootSum },
    prevState: { 111: balanceRoot },
  };
}
both('party proves committed balance and is paid it', balanceCovenant, signWith([memberA]), balanceCtx({ leaf: leafA, proof: balanceProof }), true);
both('rejected when the claimed balance does not match the leaf sum', balanceCovenant, signWith([memberA]), balanceCtx({ leaf: leafA, proof: balanceProof, leafSum: '800' }), false);
both('rejected on a wrong signer', balanceCovenant, signWith([memberB]), balanceCtx({ leaf: leafA, proof: balanceProof }), false);
both('rejected when the leaf is not in the balance root', balanceCovenant, signWith([memberC]), balanceCtx({ leaf: leafC, proof: balanceProof }), false);

if (failures > 0) {
  console.error(`\nP-EXIT gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nP-EXIT gate: Rust/WASM and TS agree — exercise is enforceable, the owner cannot redirect, recovery is time-bounded.');

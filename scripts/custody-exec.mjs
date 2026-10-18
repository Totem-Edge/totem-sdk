#!/usr/bin/env node
/**
 * Custody execution gate (RFC-039 §4 "necessary, not sufficient" → executes).
 *
 * `custody-golden.mjs` pins script *text*; `validate-custody.mjs` greps it.
 * Neither executes the branch, which is how the CAN-005-adjacent
 * `STATE(200+k)`-read-then-`EQ 0` contradiction shipped (the owner-unilateral
 * exit was unsatisfiable). This gate **executes** the custody-critical escape
 * branch with a real KISSVM evaluation and asserts:
 *   (a) the unilateral owner exit is SATISFIABLE with the committed share, and
 *   (b) it is UNSATISFIABLE when the successor does not zero the share, and
 *   (c) it is UNSATISFIABLE without the owner's signature (exit confinement).
 *
 * Requires built dist of: @totemsdk/omnia-vtxo, @totemsdk/kissvm.
 * Usage: node scripts/custody-exec.mjs   (after `npm run build`)
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const { buildPoolScript } = await load('packages/omnia-vtxo/dist/index.js');
const { evaluateScript } = await load('packages/kissvm/dist/index.js');

const OP = '0x' + 'aa'.repeat(32);
const OWNER = '0x' + 'bb'.repeat(32);
const ownerKey = OWNER.slice(2).toLowerCase();
const opKey = OP.slice(2).toLowerCase();

const script = buildPoolScript({ operatorPublicKeyDigest: OP, holders: [OWNER], exitBlock: 100 });

/** Evaluate the pool owner-exit with a given spent/successor share + signer set. */
function evalExit({ spentShare, successorShare, signers }) {
  const ctx = {
    block: 200,
    inputIndex: 0,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: OWNER, amount: 1000n, tokenId: '0x00' }],
    outputs: [{ address: OWNER, amount: 1000n, tokenId: '0x00', keepState: false }],
    state: { 101: '1', 102: '0', 200: String(successorShare) },      // current/new state
    prevState: { 101: '0', 102: '100', 200: String(spentShare) },    // spent coin's state
    simulationMode: true,
  };
  const signatures = new Map();
  for (const k of signers) signatures.set(k, new Uint8Array(1));
  return evaluateScript(script, { signatures }, ctx);
}

console.log('custody-exec: omnia-vtxo pool owner exit');

// (a) satisfiable: spent coin holds the share, successor zeroes it, owner signs
check(
  'owner exit is satisfiable (spent share=1000, successor zeroed)',
  evalExit({ spentShare: 1000, successorShare: 0, signers: [ownerKey] }).passed === true,
);

// (b) successor must zero the share (the exact CAN-005-class regression)
check(
  'owner exit rejected when successor does not zero the share',
  evalExit({ spentShare: 1000, successorShare: 1000, signers: [ownerKey] }).passed === false,
);

// (c) exit confinement: no owner signature → not satisfiable
check(
  'owner exit rejected without the owner signature',
  evalExit({ spentShare: 1000, successorShare: 0, signers: [opKey] }).passed === false,
);

// (d) a holder with no committed share cannot withdraw (share=0)
check(
  'no withdrawal when the spent share is zero',
  evalExit({ spentShare: 0, successorShare: 0, signers: [ownerKey] }).passed === false,
);

if (failures > 0) {
  console.error(`\nCustody exec gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nCustody exec gate: escape branches execute as intended.');

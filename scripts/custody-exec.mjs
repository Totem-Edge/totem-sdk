#!/usr/bin/env node
/**
 * Custody execution gate (RFC-039 §4 "necessary, not sufficient" → executes).
 *
 * `custody-golden.mjs` pins script *text*; `validate-custody.mjs` greps it.
 * Neither executes the branch, which is how two classes of bug shipped:
 *   (1) the `STATE(200+k)`-read-then-`EQ 0` contradiction (kissvm `state` is the
 *       NEW/current state; committed values must be read from `PREVSTATE`), and
 *   (2) the remainder output index colliding with the payout (`VERIFYOUT(@INPUT …)`
 *       is index 0, the same index as the payout; the remainder is output 1).
 *
 * This gate EXECUTES the escape branch via a real KISSVM evaluation and asserts,
 * for both the VTXO pool and the factory, that:
 *   (a) the unilateral exit/escape is SATISFIABLE — full share AND partial share;
 *   (b) it is UNSATISFIABLE when the successor does not zero the share;
 *   (c) it is UNSATISFIABLE without the withdrawing party's signature.
 *
 * Requires built dist of: @totemsdk/omnia-vtxo, @totemsdk/omnia-factory, @totemsdk/kissvm.
 * Usage: node scripts/custody-exec.mjs   (after `npm run build`)
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}`); }
}

const { buildPoolScript } = await load('packages/omnia-vtxo/dist/index.js');
const { buildFactoryScript } = await load('packages/omnia-factory/dist/index.js');
const { evaluateScript } = await load('packages/kissvm/dist/index.js');

const OP = '0x' + 'aa'.repeat(32);
const OWNER = '0x' + 'bb'.repeat(32);
const ownerKey = OWNER.slice(2).toLowerCase();
const opKey = OP.slice(2).toLowerCase();
const POOL = '0x' + 'dd'.repeat(32);

function ev(script, ctx, signerKeys) {
  const signatures = new Map();
  for (const k of signerKeys) signatures.set(k, new Uint8Array(1));
  return evaluateScript(script, { signatures }, ctx).passed;
}

// ── omnia-vtxo pool owner exit ──────────────────────────────────────────────
const pool = buildPoolScript({ operatorPublicKeyDigest: OP, holders: [OWNER], exitBlock: 100 });
function poolExit({ spentShare, successorShare, amount, signers, remainder }) {
  const outputs = [{ address: OWNER, amount: BigInt(spentShare), tokenId: '0x00', keepState: false }];
  if (remainder) outputs.push({ address: POOL, amount: BigInt(remainder), tokenId: '0x00', keepState: true });
  return ev(pool, {
    block: 200, inputIndex: 0,
    inputs: [{ coinId: '0x' + 'cc'.repeat(32), address: POOL, amount: BigInt(amount), tokenId: '0x00' }],
    outputs,
    state: { 101: '1', 102: '0', 200: String(successorShare) },
    prevState: { 101: '0', 102: '100', 200: String(spentShare) },
    simulationMode: true,
  }, signers);
}
console.log('custody-exec: omnia-vtxo pool owner exit');
check('full-share exit is satisfiable', poolExit({ spentShare: 1000, successorShare: 0, amount: 1000, signers: [ownerKey] }));
check('partial-share exit is satisfiable (payout@0, remainder@1)',
  poolExit({ spentShare: 1000, successorShare: 0, amount: 1500, signers: [ownerKey], remainder: 500 }));
check('rejected when successor does not zero the share',
  !poolExit({ spentShare: 1000, successorShare: 1000, amount: 1000, signers: [ownerKey] }));
check('rejected without the owner signature',
  !poolExit({ spentShare: 1000, successorShare: 0, amount: 1000, signers: [opKey] }));
check('rejected when the spent share is zero',
  !poolExit({ spentShare: 0, successorShare: 0, amount: 1000, signers: [ownerKey] }));

// ── omnia-factory per-party escape ──────────────────────────────────────────
const A = '0x' + '11'.repeat(32);
const B = '0x' + '22'.repeat(32);
const aKey = A.slice(2).toLowerCase();
const FACTORY = 'FACTORY'; // input/output address (normalized consistently)
const factory = buildFactoryScript([
  { partyId: 'a', publicKeyDigest: A, addressIndex: 0, contributionAmount: 1000n, settlementAddress: A },
  { partyId: 'b', publicKeyDigest: B, addressIndex: 1, contributionAmount: 500n, settlementAddress: B },
]);
function factoryEscape({ amount, remainder, successorZero }) {
  const outputs = [{ address: A, amount: 1000n, tokenId: '0x00', keepState: false }];
  if (remainder) outputs.push({ address: FACTORY, amount: BigInt(remainder), tokenId: '0x00', keepState: true });
  return ev(factory, {
    block: 200, inputIndex: 0,
    inputs: [{ coinId: '0x' + 'ee'.repeat(32), address: FACTORY, amount: BigInt(amount), tokenId: '0x00' }],
    outputs,
    state: { 100: '0', 103: '0', 200: successorZero ? '0' : '1000', 201: '500' },
    prevState: { 100: '0', 103: '0', 200: '1000', 201: '500' },
    simulationMode: true,
  }, [aKey]);
}
console.log('custody-exec: omnia-factory per-party escape');
check('party escape is satisfiable (whole share)',
  factoryEscape({ amount: 1000, remainder: 0, successorZero: true }));
check('party escape is satisfiable (partial, payout@0 remainder@1)',
  factoryEscape({ amount: 1500, remainder: 500, successorZero: true }));
check('rejected when the successor does not zero the party share',
  !factoryEscape({ amount: 1000, remainder: 0, successorZero: false }));

if (failures > 0) {
  console.error(`\nCustody exec gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nCustody exec gate: escape branches execute as intended.');

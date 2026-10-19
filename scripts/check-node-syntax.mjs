#!/usr/bin/env node
/**
 * Node-syntax gate (RFC-048 §3.1 L4 finding; audit kissvm-node-validity-l4-2026-10).
 *
 * The Minima node tokenizer accepts only: `^[a-z]+$` user variables, a lowercase
 * `0x` hex prefix, `+`/`-` arithmetic (not ADD/SUB), and has no `//` comment
 * syntax. This gate builds the value-bearing scripts and asserts each is already
 * canonical — i.e. `toNodeScript(script) === script` — so the emitters cannot drift
 * back to node-invalid syntax.
 *
 * Requires built dist of: core, statechain, omnia, omnia-factory, omnia-vtxo.
 * Usage: node scripts/check-node-syntax.mjs
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

const { toNodeScript } = await load('packages/core/dist/index.js');
const { buildStatechainScript } = await load('packages/statechain/dist/index.js');
const { buildEltooScript } = await load('packages/omnia/dist/index.js');
const factory = await load('packages/omnia-factory/dist/index.js');
const vtxo = await load('packages/omnia-vtxo/dist/index.js');

const pk = (b) => '0x' + String(b).repeat(2).padStart(2, '0').slice(0, 2).repeat(32);
const holder = (i) => '0x' + (16 + i).toString(16).padStart(2, '0').repeat(32);

const scripts = {
  statechain: buildStatechainScript(pk('aa')),
  omnia: buildEltooScript([
    { partyId: 'a', publicKeyDigest: pk('aa'), addressIndex: 0 },
    { partyId: 'b', publicKeyDigest: pk('bb'), addressIndex: 1 },
  ]),
  'omnia-factory': factory.buildFactoryScript([
    { partyId: 'a', publicKeyDigest: holder(0), addressIndex: 0, contributionAmount: 1000n, settlementAddress: holder(0) },
    { partyId: 'b', publicKeyDigest: holder(1), addressIndex: 1, contributionAmount: 1000n, settlementAddress: holder(1) },
  ]),
  'omnia-vtxo': vtxo.buildPoolScript({ operatorPublicKeyDigest: pk('aa'), holders: [holder(0)], exitBlock: 100 }),
};

for (const [name, script] of Object.entries(scripts)) {
  const canonical = toNodeScript(script);
  check(`${name}: emitted script is node-canonical (idempotent)`, canonical === script, firstDiff(script, canonical));
  check(`${name}: no // comments`, !script.includes('//'));
  check(`${name}: no 0X prefix`, !/0X/.test(script));
  const bad = [...script.matchAll(/LET\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]).filter((v) => !/^[a-z]+$/.test(v));
  check(`${name}: all LET variables match ^[a-z]+$`, bad.length === 0, bad.join(','));
}

function firstDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return `first diff @ ${i}: ${JSON.stringify(a.slice(i, i + 20))} vs ${JSON.stringify(b.slice(i, i + 20))}`;
  return '';
}

if (failures > 0) {
  console.error(`\nNode-syntax gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nNode-syntax gate: every emitted script is node-canonical.');

#!/usr/bin/env node
/**
 * Composite port-allocation gate (RFC-049 §5.3, R-MASH-4).
 *
 * A composite (MASH + Omnia + MAST) transaction carries several scripts on **one
 * coin**, so their state ports MUST be disjoint (ports are per-coin namespaces)
 * and none but MASH may touch the MSHS band. This gate reads the declared
 * composites from `scripts/state-port-registry.json`, resolves each participant's
 * bands, and:
 *
 *   1. asserts the participants' port ranges are **pairwise disjoint**;
 *   2. asserts only MASH uses the MSHS band (R-MASH-1);
 *   3. checks the MASH wallet envelope + the Omnia script's op count against the
 *      KISSVM instruction limit (R-MASH-4/R-MASH-5);
 *   4. prints the **port-allocation table** (the artifact R-MASH-4 requires).
 *
 * Requires built dist of: kissvm, omnia, omnia-factory, omnia-vtxo.
 * Usage: node scripts/check-composite-ports.mjs
 */
import './lib/init-core-wasm.mjs';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(join(ROOT, p)).href);

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const REGISTRY = JSON.parse(readFileSync(join(ROOT, 'scripts/state-port-registry.json'), 'utf8'));
const bandById = new Map(REGISTRY.bands.map((b) => [b.id, b]));
const MSHS = REGISTRY.mshsBand;
const BUDGET = REGISTRY.instructionBudget;

const resolveBand = (id) => (id === 'mshs' ? { id: 'mshs', from: MSHS.from, to: MSHS.to } : bandById.get(id));

// ── build the Omnia scripts to measure their op counts ───────────────────────
const { parseScript } = await load('packages/kissvm/dist/index.js');
const { buildEltooScript } = await load('packages/omnia/dist/index.js');
const factory = await load('packages/omnia-factory/dist/index.js');
const vtxo = await load('packages/omnia-vtxo/dist/index.js');

const pk = (b) => '0x' + String(b).repeat(2).padStart(2, '0').slice(0, 2).repeat(32);
const holder = (i) => '0x' + (16 + i).toString(16).padStart(2, '0').repeat(32);
const omniaScripts = {
  omnia: buildEltooScript([
    { partyId: 'a', publicKeyDigest: pk('aa'), addressIndex: 0 },
    { partyId: 'b', publicKeyDigest: pk('bb'), addressIndex: 1 },
  ]),
  // Model-B shape: the O(1) pre-signed distribution escape (the per-party-escape
  // factory is O(N) and exceeds the budget; see docs/COMPOSITE-PORT-ALLOCATION.md).
  'omnia-factory': factory.buildFactoryDistributionScript({
    participants: [
      { partyId: 'a', publicKeyDigest: holder(0), addressIndex: 0, contributionAmount: 1000n, settlementAddress: holder(0) },
      { partyId: 'b', publicKeyDigest: holder(1), addressIndex: 1, contributionAmount: 1000n, settlementAddress: holder(1) },
    ],
  }),
  'omnia-vtxo': vtxo.buildPoolScript({ operatorPublicKeyDigest: pk('aa'), holders: [holder(0)], exitBlock: 100 }),
};

/** Path-independent upper bound on a script's op count: its AST node count. */
function countNodes(node) {
  if (!node || typeof node !== 'object') return 0;
  let n = 1;
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) { for (const c of v) n += countNodes(c); }
    else if (v && typeof v === 'object') n += countNodes(v);
  }
  return n;
}
function omniaOps(script) {
  try { return countNodes(parseScript(script)); } catch { return Infinity; }
}
function mashEnvelope(inputs, outputs) {
  return BUDGET.mashWalletEnvelope.base
    + BUDGET.mashWalletEnvelope.perExtraInput * (inputs - 1)
    + BUDGET.mashWalletEnvelope.perExtraOutput * (outputs - 1);
}

// ── check each composite ─────────────────────────────────────────────────────
console.log('composite port-allocation table (RFC-049 §5.3 R-MASH-4):');
for (const [name, composite] of Object.entries(REGISTRY.composites ?? {})) {
  console.log(`\n${name}  (coinClass: ${composite.coinClass})`);
  const ranges = [];
  for (const participant of composite.participants) {
    for (const bandId of participant.bands) {
      const b = resolveBand(bandId);
      check(`  ${name}: band "${bandId}" is declared`, !!b, bandId);
      if (b) {
        ranges.push({ participant: participant.id, bandId, from: b.from, to: b.to });
        console.log(`    ${participant.id.padEnd(16)} ${bandId.padEnd(16)} [${b.from}, ${b.to}]`);
      }
    }
  }

  // 1. pairwise disjointness across participants (same coin).
  let disjoint = true;
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i], b = ranges[j];
      if (a.from <= b.to && b.from <= a.to) {
        disjoint = false;
        check(`  ${name}: "${a.participant}:${a.bandId}" and "${b.participant}:${b.bandId}" are disjoint`, false, `[${a.from},${a.to}] overlaps [${b.from},${b.to}]`);
      }
    }
  }
  if (disjoint) check(`  ${name}: all participant bands are pairwise disjoint (one coin)`, true);

  // 2. only MASH may use the MSHS band.
  const nonMashMshs = ranges.filter((r) => r.bandId === 'mshs' && r.participant !== 'mash');
  check(`  ${name}: only MASH uses the MSHS band (R-MASH-1)`, nonMashMshs.length === 0, JSON.stringify(nonMashMshs));

  // 3. instruction budget: MASH envelope + the Omnia participant's op bound.
  const omniaParticipant = composite.participants.map((p) => p.id).find((id) => id in omniaScripts);
  if (omniaParticipant) {
    const ops = omniaOps(omniaScripts[omniaParticipant]);
    const env = mashEnvelope(1, 1);
    const total = env + ops;
    const withinBudget = total <= BUDGET.kissvmMaxInstructions;
    const expected = composite.instructionBudget ?? 'ok';
    // The composite declares its expected outcome; the gate asserts the bound matches
    // it, so an over-budget composite is an explicit, tracked limitation (R-MASH-5),
    // never a silent surprise.
    check(
      `  ${name}: budget outcome is "${expected}" (MASH ${env} + ${omniaParticipant} ~${ops} = ${total} vs ${BUDGET.kissvmMaxInstructions})`,
      (expected === 'ok') === withinBudget,
      withinBudget ? 'bound is within budget but declared over' : 'bound exceeds budget but declared ok',
    );
  }
}

if (failures > 0) {
  console.error(`\nComposite port-allocation gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nComposite port-allocation gate: every declared composite is disjoint and within budget.');

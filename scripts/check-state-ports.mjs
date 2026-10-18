#!/usr/bin/env node
/**
 * State-port gate (RFC-048 §12.6 / RFC-049 §5).
 *
 * Ports are bytes (0–255) and MSHS-2 (MASH) reserves the top band (floor 234).
 * Omnia's variable-length bands (party shares) must stay below that floor, no
 * `SAMESTATE` range may span it, and builders must refuse to emit out-of-band
 * ports. This gate builds the value-bearing scripts and asserts it.
 *
 * Requires built dist of: statechain, omnia, omnia-factory, omnia-vtxo.
 * Usage: node scripts/check-state-ports.mjs   (after `npm run build`)
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

const { buildStatechainScript } = await load('packages/statechain/dist/index.js');
const { buildEltooScript } = await load('packages/omnia/dist/index.js');
const factory = await load('packages/omnia-factory/dist/index.js');
const vtxo = await load('packages/omnia-vtxo/dist/index.js');

const AVG_HOLDER_COUNT = 3; // exercise multi-holder share ports
const pk = (b) => '0x' + String(b).repeat(2).padStart(2, '0').slice(0, 2).repeat(32);
const holder = (i) => '0x' + (16 + i).toString(16).padStart(2, '0').repeat(32);

const scripts = {
  statechain: buildStatechainScript(pk('aa')),
  omnia: buildEltooScript([
    { partyId: 'a', publicKeyDigest: pk('aa'), addressIndex: 0 },
    { partyId: 'b', publicKeyDigest: pk('bb'), addressIndex: 1 },
  ]),
  'omnia-factory': factory.buildFactoryScript(
    Array.from({ length: AVG_HOLDER_COUNT }, (_, i) => ({
      partyId: `p${i}`, publicKeyDigest: holder(i), addressIndex: i, contributionAmount: 1000n, settlementAddress: holder(i),
    })),
  ),
  'omnia-vtxo': vtxo.buildPoolScript({
    operatorPublicKeyDigest: pk('aa'),
    holders: Array.from({ length: AVG_HOLDER_COUNT }, (_, i) => holder(i)),
    exitBlock: 100,
  }),
};

const FLOOR = vtxo.MSHS_PORT_FLOOR;
check(`MSHS floor is ${FLOOR} (node RFC-0001: proof ports from 234)`, FLOOR === 234);

for (const [pkg, src] of Object.entries(scripts)) {
  const ports = [...src.matchAll(/(?:PREVSTATE|STATE)\((\d+)\)/g)].map((m) => Number(m[1]));
  const overFloor = ports.filter((p) => p >= FLOOR);
  const over255 = ports.filter((p) => p > 255);
  check(`${pkg}: all STATE/PREVSTATE ports < ${FLOOR}`, overFloor.length === 0, `found ${overFloor.join(',')}`);
  check(`${pkg}: all ports ≤ 255`, over255.length === 0);

  // SAMESTATE(from to): the range [from,to] must not span the MSHS band.
  const spans = [...src.matchAll(/SAMESTATE\((\d+)\s+(\d+)\)/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
    .filter(([, to]) => to >= FLOOR);
  check(`${pkg}: no SAMESTATE range spans the MSHS band`, spans.length === 0, JSON.stringify(spans));
}

// Builders must refuse to emit out-of-band ports.
check(
  `omnia-vtxo refuses > ${vtxo.POOL_MAX_HOLDERS} holders`,
  throws(() => vtxo.buildPoolScript({ operatorPublicKeyDigest: pk('aa'), holders: Array.from({ length: vtxo.POOL_MAX_HOLDERS + 1 }, (_, i) => holder(i % 240)), exitBlock: 1 })),
);
check(
  `omnia-factory refuses > ${factory.FACTORY_MAX_PARTICIPANTS} participants`,
  throws(() => factory.buildFactoryScript(Array.from({ length: factory.FACTORY_MAX_PARTICIPANTS + 1 }, (_, i) => ({ partyId: `p${i}`, publicKeyDigest: holder(i % 240), addressIndex: i, contributionAmount: 1n, settlementAddress: holder(i % 240) })))),
);

function throws(fn) { try { fn(); return false; } catch { return true; } }

if (failures > 0) {
  console.error(`\nState-port gate: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nState-port gate: all Omnia bands stay below the MSHS floor; ranges are clean.');

#!/usr/bin/env node
/**
 * OMN-064 — node parity for the KISSVM CHECKSIG fixtures.
 *
 * The fixtures in `tests/fixtures/kissvm/checksig-fixtures.ts` embed every
 * operand inline, so they need no witness and can be evaluated by the node's
 * own `runscript` command. This is the authoritative leg: the TypeScript and
 * Rust/WASM evaluators are compared against it, never the other way round.
 *
 * Usage:
 *   MINIMA_RPC_URL=http://127.0.0.1:9005 node scripts/kissvm-node-parity.mjs
 *   MINIMA_RPC_URL=... MINIMA_RPC_PASSWORD=... node scripts/kissvm-node-parity.mjs --json
 *
 * Exit codes: 0 all expectations matched, 1 a mismatch, 2 cannot run (no node).
 *
 * The fixture builder is TypeScript; this script compiles it on the fly through
 * `tsx`, which the repo already uses for the findings pipeline.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.MINIMA_RPC_URL;
if (!url) {
  process.stderr.write(
    'kissvm-node-parity: MINIMA_RPC_URL is not set; skipping the node leg.\n'
    + 'Run against a node to settle OMN-064 definitively.\n',
  );
  process.exit(2);
}

const asJson = process.argv.includes('--json');

// Build the fixtures with the repo's TypeScript toolchain (real crypto).
const script = `
import { buildChecksigFixtures } from ${JSON.stringify(join(ROOT, 'tests/fixtures/kissvm/checksig-fixtures.ts'))};
process.stdout.write(JSON.stringify(buildChecksigFixtures()));
`;
const fixtures = JSON.parse(
  execFileSync('npx', ['tsx', '-e', script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }),
);

async function rpc(command) {
  const body = JSON.stringify({ command });
  const headers = { 'content-type': 'application/json' };
  if (process.env.MINIMA_RPC_PASSWORD) {
    headers.authorization = 'Basic ' + Buffer.from(`minima:${process.env.MINIMA_RPC_PASSWORD}`).toString('base64');
  }
  const response = await fetch(url, { method: 'POST', headers, body });
  if (!response.ok) throw new Error(`node returned HTTP ${response.status}`);
  return response.json();
}

/** The node wraps results as { command, status, pending, response }. */
function interpret(reply) {
  const response = reply?.response ?? reply;
  if (response && typeof response === 'object' && 'result' in response) {
    return { evaluable: true, passed: response.result === true };
  }
  const message = typeof response?.message === 'string'
    ? response.message
    : typeof reply?.error === 'string'
      ? reply.error
      : JSON.stringify(response);
  return { evaluable: false, passed: false, message };
}

const rows = [];
let mismatches = 0;
for (const fixture of fixtures) {
  const reply = await rpc(`runscript script:"${fixture.script.replace(/"/g, '\\"')}"`);
  const outcome = interpret(reply);
  const ok = outcome.evaluable
    ? outcome.passed === fixture.expected
    : fixture.wasmSupport === 'pending-tree-signature' && fixture.expected === true
      // A tree-signature fixture is only evaluable if the node accepts it; a
      // node-side failure of a valid signature is itself a mismatch.
      ? false
      : fixture.expected === false;
  if (!ok) mismatches += 1;
  rows.push({
    name: fixture.name,
    expected: fixture.expected,
    node: outcome.evaluable ? outcome.passed : `error: ${outcome.message}`,
    ok,
  });
}

if (asJson) {
  process.stdout.write(JSON.stringify({ fixtures: rows.length, mismatches, rows }, null, 2) + '\n');
} else {
  for (const row of rows) {
    process.stdout.write(
      `${row.ok ? 'ok  ' : 'FAIL'} ${row.name.padEnd(34)} expected=${String(row.expected).padEnd(5)} node=${row.node}\n`,
    );
  }
  process.stdout.write(`\n${rows.length - mismatches}/${rows.length} fixtures matched the node.\n`);
}

process.exit(mismatches === 0 ? 0 : 1);

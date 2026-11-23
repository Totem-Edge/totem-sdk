#!/usr/bin/env node
/**
 * Transaction pipeline lock.
 *
 * The build → sign → finalize path is security-critical and was assembled
 * against the Java node's exact serialization. Accidental "cleanup" of any of
 * these files is how a working send turns into a 400 from the API or a
 * signature the node rejects.
 *
 * Usage:
 *   node scripts/lock-txn-pipeline.mjs           # verify
 *   node scripts/lock-txn-pipeline.mjs --update  # re-pin after a reviewed change
 *
 * `npm test` runs the verify path. A failure means: read PIPELINE-LOCK.md,
 * confirm the change is intentional and matches the Java reference, then
 * update the pin in the same commit as the change.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LOCK_FILE = join(ROOT, 'txn-pipeline.lock.json');

/**
 * Files whose byte content defines the transaction pipeline. Paths outside
 * this package are optional so the PWA can be checked out on its own.
 */
export const LOCKED_FILES = [
  'src/core/buildTxnRow.ts',
  'src/core/api.ts',
  'src/pages/Send.tsx',
  '../totem-extension/src/core/transaction/service.ts',
  '../totem-extension/src/core/transaction/MinimaTransactionBuilder.ts',
  '../totem-extension/src/core/transaction/useSendTransaction.ts',
  '../totem-extension/src/core/transaction/hawkTransactionService.ts',
  '../../../axia-platform/packages/axia-api/src/wots/finalize.ts',
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function computePins() {
  const pins = {};
  for (const relative of LOCKED_FILES) {
    const absolute = join(ROOT, relative);
    if (!existsSync(absolute)) continue;
    pins[relative] = sha256(absolute);
  }
  return pins;
}

export function readPins() {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    return JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/** Returns a list of human-readable mismatches. Empty means the lock holds. */
export function verifyPins() {
  const expected = readPins();
  const actual = computePins();
  if (!expected) return ['txn-pipeline.lock.json is missing'];

  const problems = [];
  for (const [file, hash] of Object.entries(actual)) {
    if (!expected[file]) {
      problems.push(`${file}: newly locked file has no pin`);
    } else if (expected[file] !== hash) {
      problems.push(`${file}: content changed (expected ${expected[file].slice(0, 12)}…, got ${hash.slice(0, 12)}…)`);
    }
  }
  for (const file of Object.keys(expected)) {
    if (!actual[file]) problems.push(`${file}: pinned file is missing`);
  }
  return problems;
}

export function writePins() {
  const pins = computePins();
  writeFileSync(LOCK_FILE, `${JSON.stringify(pins, null, 2)}\n`);
  return pins;
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--update')) {
    const pins = writePins();
    console.log(`Pinned ${Object.keys(pins).length} pipeline files in txn-pipeline.lock.json`);
  } else {
    const problems = verifyPins();
    if (problems.length === 0) {
      console.log('Transaction pipeline lock verified.');
    } else {
      console.error('Transaction pipeline lock FAILED:');
      for (const problem of problems) console.error(`  - ${problem}`);
      console.error('\nSee PIPELINE-LOCK.md. Only re-pin after a reviewed change.');
      process.exit(1);
    }
  }
}

#!/usr/bin/env node
/**
 * Custody conformance gate (RFC-039 / docs/CUSTODY-POLICY.md).
 *
 * A capability is non-custodial iff every holder has a unilateral, timelocked,
 * on-chain recovery path. This gate forbids `custodial` packages from shipping
 * and statically asserts the unilateral escape exists for value-bearing scripts.
 *
 * Usage:
 *   node scripts/validate-custody.mjs
 *
 * Reads: scripts/workspace-gates.config.json (custody source of truth),
 *        SDK_MANIFEST.json (parity).
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONFIG = JSON.parse(readFileSync(join(__dirname, 'workspace-gates.config.json'), 'utf8'));
const MANIFEST_PATH = join(ROOT, 'SDK_MANIFEST.json');
const VALID = new Set(['non-custodial', 'trust-minimised', 'custodial']);

// A recovery path: a timelock/coinage gate plus an authorization condition.
// Authorization may be single-signer (owner escape: SIGNEDBY) OR both-signer
// (co-signed close package broadcast unilaterally: BOTHSIGNED). This is a coarse
// existence check only — it cannot see a pre-signed close package, nor tell a
// constrained exit from an unconstrained one. The dynamic canary owns real
// conformance (see docs/CUSTODY-POLICY.md §4).
const TIMELOCK_RE = /@COINAGE\s+GTE|@BLOCK\s+GTE|@BLOCK\s+GT/;
const SIGNER_RE = /SIGNEDBY\(|BOTHSIGNED/;

const errors = [];
let checked = 0;
let valueBearing = 0;

function classify(dir, meta) {
  const c = meta.custody;
  if (!c) {
    errors.push(`${dir}: publishable but no custody classification`);
    return;
  }
  if (!VALID.has(c.classification)) {
    errors.push(`${dir}: invalid custody "${c.classification}"`);
    return;
  }
  if (c.classification === 'custodial') {
    errors.push(`${dir}: CUSTODIAL — do not ship (RFC-039). Provide a unilateral owner path.`);
  }
  if (c.classification === 'trust-minimised' && (!c.reason || !c.mitigation)) {
    errors.push(`${dir}: trust-minimised requires both reason and mitigation`);
  }
  if (c.script) {
    valueBearing += 1;
    const file = join(ROOT, c.script.file);
    if (!existsSync(file)) {
      errors.push(`${dir}: custody.script file not found: ${c.script.file}`);
      return;
    }
    if (c.classification === 'non-custodial') {
      const src = readFileSync(file, 'utf8');
      if (!TIMELOCK_RE.test(src)) {
        errors.push(`${dir}: non-custodial script ${c.script.file} has no timelock escape (@COINAGE GTE / @BLOCK GT)`);
      }
      if (!SIGNER_RE.test(src)) {
        errors.push(`${dir}: non-custodial script ${c.script.file} has no single-signer return (SIGNEDBY)`);
      }
    }
  }
  checked += 1;
}

for (const [dir, meta] of Object.entries(CONFIG.packages)) {
  if (meta.status !== 'publishable') continue;
  classify(dir, meta);
}

// Manifest parity (non-fatal if the manifest is mid-regeneration).
if (existsSync(MANIFEST_PATH)) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const byDirName = new Map();
  for (const [dir, meta] of Object.entries(CONFIG.packages)) {
    const pj = join(ROOT, dir, 'package.json');
    if (existsSync(pj)) byDirName.set(JSON.parse(readFileSync(pj, 'utf8')).name, meta);
  }
  for (const entry of manifest.packages ?? []) {
    const meta = byDirName.get(entry.name);
    if (meta?.custody && entry.custody?.classification !== meta.custody.classification) {
      errors.push(`${entry.name}: manifest custody ${entry.custody?.classification ?? '(none)'} ≠ config ${meta.custody.classification}`);
    }
  }
}

for (const msg of errors) console.error(`✗ ${msg}`);
if (errors.length > 0) {
  console.error(`\nCustody gate: ${errors.length} issue(s) across ${checked} packages.`);
  process.exit(1);
}
console.log(`Custody gate: ${checked} packages classified, ${valueBearing} value-bearing scripts verified non-custodial.`);

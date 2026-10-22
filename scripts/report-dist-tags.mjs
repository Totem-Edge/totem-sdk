#!/usr/bin/env node
/**
 * Report npm dist-tag drift against the RFC-063 maturity/support-tier model.
 *
 * Usage:
 *   node scripts/report-dist-tags.mjs           # report only
 *   node scripts/report-dist-tags.mjs --check   # exit 1 on drift
 *
 * This is intentionally read-only. Moving tags is a release action:
 *   npm dist-tag add <pkg>@<version> <tag>
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, 'SDK_MANIFEST.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));

const EXPECTED_TAG = {
  v1: 'latest',
  rc: 'next',
  beta: 'beta',
  alpha: 'alpha',
};

function shortName(name) {
  return name.replace(/^@totemsdk\//, '');
}

function readTags(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'dist-tags', '--json'], {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

const rows = [];
for (const pkg of manifest.packages) {
  const short = shortName(pkg.name);
  const meta = config.packages[`packages/${short}`] ?? {};
  const tier = meta.supportTier ?? 'outside';
  const level = meta.maturity ?? 'unclassified';
  const expected = EXPECTED_TAG[level] ?? '-';
  const tags = readTags(pkg.name);
  const latest = tags?.latest ?? null;
  const expectedVersion = tags?.[expected] ?? null;
  const drift = [];

  if (!tags) {
    drift.push('unpublished or registry unavailable');
  } else if (level === 'rc' || level === 'beta' || level === 'alpha') {
    if (latest) drift.push(`latest=${latest} (expected no latest; use ${expected})`);
    if (!expectedVersion) drift.push(`missing ${expected} tag`);
  } else if (level === 'v1') {
    if (!latest) drift.push('missing latest tag');
  }

  rows.push({
    tier,
    level,
    name: pkg.name,
    expected,
    latest,
    tags: tags ? Object.entries(tags).map(([k, v]) => `${k}=${v}`).join(', ') : 'ERROR',
    drift: drift.join('; '),
  });
}

rows.sort((a, b) => {
  const tier = String(a.tier).localeCompare(String(b.tier));
  if (tier !== 0) return tier;
  return a.name.localeCompare(b.name);
});

console.log('tier\tlevel\tpackage\texpected\tlatest\tdrift');
for (const row of rows) {
  console.log(`${row.tier}\t${row.level}\t${row.name}\t${row.expected}\t${row.latest ?? '-'}\t${row.drift || 'ok'}`);
}

const bad = rows.filter((row) => row.drift);
if (process.argv.includes('--check') && bad.length > 0) {
  console.error(`\n✗ dist-tag drift: ${bad.length} package(s)`);
  process.exit(1);
}
console.log(`\n${rows.length} packages checked; ${bad.length} with drift.`);

#!/usr/bin/env node
/**
 * RFC-063 Phase 0: fail when high-value public claims drift from the machine
 * readable source of truth. Keep this intentionally small; add a check only when
 * the claim has a single authoritative source.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'SDK_MANIFEST.json'), 'utf8'));
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

const publishable = Object.values(config.packages).filter((meta) => meta.status === 'publishable').length;
const domains = Object.keys(manifest.domains ?? {}).length;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    console.log(`ok: ${label}`);
  } else {
    failures.push(detail);
    console.error(`✗ ${label}: ${detail}`);
  }
}

check(
  'SDK_MANIFEST total',
  manifest.total === publishable && manifest.packages?.length === publishable,
  `manifest.total=${manifest.total}, packages=${manifest.packages?.length}, publishable=${publishable}`,
);

const countMatch = readme.match(/currently \*\*(\d+) packages across (\d+) domains\*\*/);
check(
  'README package/domain counts',
  Boolean(countMatch) && Number(countMatch[1]) === publishable && Number(countMatch[2]) === domains,
  countMatch
    ? `README says ${countMatch[1]} packages / ${countMatch[2]} domains; expected ${publishable} / ${domains}`
    : 'README is missing the "currently **N packages across M domains**" claim',
);

const manifestLine = readme.match(/Machine-readable package index — (\d+) packages/);
check(
  'README SDK Manifest count',
  Boolean(manifestLine) && Number(manifestLine[1]) === publishable,
  manifestLine
    ? `README says ${manifestLine[1]} packages; expected ${publishable}`
    : 'README SDK Manifest line is missing its package count',
);

check(
  'README links the generated maturity matrix',
  readme.includes('docs/maturity.md'),
  'README must link docs/maturity.md',
);

check(
  'README links RFC-063',
  readme.includes('RFC-063-PRODUCTION-READINESS-AND-MATURITY-PROMOTION.md'),
  'README must link RFC-063',
);

check(
  'generated maturity matrix exists',
  existsSync(join(ROOT, 'docs', 'maturity.md')),
  'docs/maturity.md is missing; run node scripts/report-maturity.mjs --write',
);

const security = readFileSync(join(ROOT, 'SECURITY.md'), 'utf8');
check(
  'SECURITY.md has no placeholder PGP block',
  !security.includes('(Contact security@totem.ing for the current PGP key)'),
  'replace the placeholder PGP block with the real reporting path',
);

if (failures.length > 0) {
  console.error(`\npublic claims drift: ${failures.length} issue(s)`);
  process.exit(1);
}
console.log(`public claims: ${publishable} packages across ${domains} domains in sync`);

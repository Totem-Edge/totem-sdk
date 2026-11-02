#!/usr/bin/env node
/**
 * Apply the RFC-063 dist-tag model to existing npm versions.
 *
 * Default is dry-run. Use --execute with an authenticated npm token.
 *
 * Usage:
 *   node scripts/apply-dist-tags.mjs
 *   node scripts/apply-dist-tags.mjs --execute
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(readFileSync(join(ROOT, 'SDK_MANIFEST.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));
const EXECUTE = process.argv.includes('--execute');

const EXPECTED_TAG = { v1: 'latest', rc: 'next', beta: 'beta', alpha: 'alpha' };
const VALID_TAGS = new Set(['latest', 'next', 'beta', 'alpha']);

function cliValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const onlyPackage = cliValue('--package');
const onlyVersion = cliValue('--version');
const onlyTag = cliValue('--tag');
const targeted = Boolean(onlyPackage || onlyVersion || onlyTag);

if (targeted && !(onlyPackage && onlyVersion && onlyTag)) {
  console.error(
    'Usage: node scripts/apply-dist-tags.mjs --package <name> --version <semver> --tag <latest|next|beta|alpha> [--execute]',
  );
  process.exit(1);
}

function readTags(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'dist-tags', '--json'], {
      encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function packageVersion(name) {
  const short = name.replace(/^@totemsdk\//, '');
  try {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'packages', short, 'package.json'), 'utf8'));
    return typeof manifest.version === 'string' ? manifest.version : null;
  } catch {
    return null;
  }
}

function isPublished(name, version) {
  try {
    execFileSync('npm', ['view', `${name}@${version}`, 'version'], {
      stdio: 'ignore', timeout: 15000,
    });
    return true;
  } catch {
    return false;
  }
}

function run(args) {
  const label = `npm ${args.join(' ')}`;
  console.log(`${EXECUTE ? 'RUN ' : 'DRY '} ${label}`);
  if (!EXECUTE) return true;
  try {
    execFileSync('npm', args, { stdio: 'inherit', env: process.env });
    return true;
  } catch {
    return false;
  }
}

let changes = 0;
let failures = 0;

// Targeted mode: promote one already-published version to one dist-tag. Used to
// bless a release as `latest` (for example after an rc package passes its
// release gates) without re-running the whole workspace sync.
if (targeted) {
  const pkg = manifest.packages.find((entry) => entry.name === onlyPackage);
  if (!pkg) {
    console.error(`FAIL ${onlyPackage}: not listed in SDK_MANIFEST.json`);
    process.exit(1);
  }
  if (!VALID_TAGS.has(onlyTag)) {
    console.error(`FAIL ${onlyTag}: expected one of ${[...VALID_TAGS].join(', ')}`);
    process.exit(1);
  }
  if (!isPublished(onlyPackage, onlyVersion)) {
    console.error(`FAIL ${onlyPackage}@${onlyVersion}: version is not published`);
    process.exit(1);
  }

  const tags = readTags(onlyPackage);
  if (!tags) {
    console.error(`FAIL ${onlyPackage}: registry read failed`);
    process.exit(1);
  }
  if (tags[onlyTag] === onlyVersion) {
    console.log(`OK   ${onlyPackage}: ${onlyTag} already ${onlyVersion}`);
    process.exit(0);
  }

  console.log(`PLAN ${onlyPackage}: ${onlyTag} ${tags[onlyTag] ?? '-'} → ${onlyVersion}`);
  const ok = run(['dist-tag', 'add', `${onlyPackage}@${onlyVersion}`, onlyTag]);
  console.log(`\n${ok ? 'Promoted' : 'FAILED'} ${onlyPackage}@${onlyVersion} → ${onlyTag}${EXECUTE ? '' : ' (dry-run)'}.`);
  process.exit(ok ? 0 : 1);
}

for (const pkg of manifest.packages) {
  const short = pkg.name.replace(/^@totemsdk\//, '');
  const meta = config.packages[`packages/${short}`] ?? {};
  const level = meta.maturity ?? 'unclassified';
  const expected = EXPECTED_TAG[level];
  if (!expected) {
    console.log(`SKIP ${pkg.name}: no dist-tag policy for level ${level}`);
    continue;
  }

  const tags = readTags(pkg.name);
  if (!tags) {
    console.error(`FAIL ${pkg.name}: registry read failed`);
    failures++;
    continue;
  }

  const declared = packageVersion(pkg.name);
  const version = declared && isPublished(pkg.name, declared)
    ? declared
    : tags[expected] ?? tags.latest;
  if (!version) {
    console.error(`FAIL ${pkg.name}: no published version to tag`);
    failures++;
    continue;
  }

  if (level === 'v1') {
    if (tags.latest) {
      console.log(`OK   ${pkg.name}: latest=${tags.latest}`);
    } else {
      console.log(`WARN ${pkg.name}: missing latest; no safe version selected`);
    }
    continue;
  }

  if (tags[expected] !== version) {
    changes++;
    if (!run(['dist-tag', 'add', `${pkg.name}@${version}`, expected])) failures++;
  } else {
    console.log(`OK   ${pkg.name}: ${expected}=${version}`);
  }
  if (tags.latest) {
    console.log(`     ${pkg.name}: latest=${tags.latest} (npm-required; not a production claim)`);
  }
}

console.log(`\n${changes} action(s), ${failures} failure(s)${EXECUTE ? '' : ' (dry-run)'}.`);
if (failures > 0) process.exit(1);

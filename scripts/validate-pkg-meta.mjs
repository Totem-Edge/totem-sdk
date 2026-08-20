#!/usr/bin/env node
/**
 * Validates that every public @totemsdk/* package has all required npm metadata
 * and that the repository metadata actually points at the real upstream remote.
 * Exits non-zero if any required field is missing or incorrect.
 * Usage: node scripts/validate-pkg-meta.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

const REQUIRED_FIELDS = ['author', 'license', 'repository', 'homepage', 'bugs', 'keywords', 'files'];

// Resolve the canonical upstream from the actual git remote so the check can
// never drift from the real repository.
const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' });
const CANONICAL_REPO = remote.status === 0 ? remote.stdout.trim().replace(/\.git$/, '') : 'https://github.com/Totem-Edge/totem-sdk';
const ISSUES_URL = `${CANONICAL_REPO}/issues`;

function normalizeUrl(url) {
  return String(url).replace(/\.git$/, '').replace(/^git\+/, '').replace(/^git:/, 'https:');
}

const pkgDirs = readdirSync(PACKAGES_DIR).filter(d => {
  if (d === 'sdk-tests') return false;
  return statSync(join(PACKAGES_DIR, d)).isDirectory();
});

let errors = 0;

for (const pkgDir of pkgDirs) {
  const pkgPath = join(PACKAGES_DIR, pkgDir, 'package.json');
  if (!existsSync(pkgPath)) {
    console.error(`✗ ${pkgDir}: package.json not found`);
    errors++;
    continue;
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    const val = pkg[field];
    if (val === undefined || val === null) {
      missing.push(field);
    } else if (field === 'keywords' && (!Array.isArray(val) || val.length === 0)) {
      missing.push(`${field} (empty array)`);
    } else if (field === 'files' && (!Array.isArray(val) || val.length === 0)) {
      missing.push(`${field} (empty array)`);
    }
  }

  // Correctness: repository/bugs must point at the canonical upstream and the
  // declared directory must match the package's location in the monorepo.
  const repoVal = pkg.repository;
  if (repoVal && typeof repoVal === 'object' && repoVal.url) {
    const repoUrl = normalizeUrl(repoVal.url);
    if (!repoUrl.startsWith(CANONICAL_REPO)) {
      missing.push(`repository.url (${repoUrl} ≠ ${CANONICAL_REPO})`);
    }
    const expectedDirectory = `packages/${pkgDir}`;
    if (repoVal.directory && repoVal.directory !== expectedDirectory) {
      missing.push(`repository.directory (${repoVal.directory} ≠ ${expectedDirectory})`);
    }
  }
  const bugsVal = pkg.bugs;
  if (bugsVal && typeof bugsVal === 'object' && bugsVal.url) {
    const bugsUrl = normalizeUrl(bugsVal.url);
    if (!bugsUrl.startsWith(`${CANONICAL_REPO}/issues`)) {
      missing.push(`bugs.url (${bugsUrl} ≠ ${ISSUES_URL})`);
    }
  }

  // License correctness: must be a well-formed SPDX identifier
  const licenseVal = pkg.license;
  if (typeof licenseVal !== 'string' || !/^[A-Za-z0-9.\-+ ]+$/.test(licenseVal)) {
    missing.push('license (not an SPDX expression)');
  }

  // Verify LICENSE file exists on disk
  const licensePath = join(PACKAGES_DIR, pkgDir, 'LICENSE');
  if (!existsSync(licensePath)) {
    missing.push('LICENSE file on disk');
  }

  // Verify README.md file exists on disk (required in files array)
  const readmePath = join(PACKAGES_DIR, pkgDir, 'README.md');
  if (!existsSync(readmePath)) {
    missing.push('README.md file on disk');
  }

  if (missing.length > 0) {
    console.error(`✗ ${pkg.name ?? pkgDir}: missing → ${missing.join(', ')}`);
    errors++;
  } else {
    console.log(`✓ ${pkg.name ?? pkgDir}`);
  }
}

if (errors > 0) {
  console.error(`\n${errors} package(s) failed metadata validation.`);
  process.exit(1);
} else {
  console.log(`\nAll ${pkgDirs.length} packages passed metadata validation.`);
}

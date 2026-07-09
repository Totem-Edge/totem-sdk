#!/usr/bin/env node
/**
 * Validates that every public @totemsdk/* package has all required npm metadata.
 * Exits non-zero if any required field is missing.
 * Usage: node packages/totem-sdk/scripts/validate-pkg-meta.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = join(__dirname, '..', 'packages');

const REQUIRED_FIELDS = ['author', 'license', 'repository', 'homepage', 'bugs', 'keywords', 'files'];

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

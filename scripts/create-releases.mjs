#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const gates = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'scripts/workspace-gates.config.json'), 'utf-8')
);

// Get all publishable packages
const packages = [];
for (const [pkgPath, meta] of Object.entries(gates.packages)) {
  if (meta.status !== 'publishable') continue;
  const manifestPath = path.join(REPO_ROOT, pkgPath, 'package.json');
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.private) continue;
  packages.push({
    name: manifest.name,
    slug: manifest.name.replace('@totemsdk/', ''),
    version: manifest.version,
    maturity: meta.maturity,
    dir: pkgPath
  });
}

// Topological sort by dependency
const nameToPkg = new Map(packages.map(p => [p.name, p]));
const visited = new Set();
const ordered = [];

function visit(pkg) {
  if (visited.has(pkg.name)) return;
  visited.add(pkg.name);
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, pkg.dir, 'package.json'), 'utf8'));
  const deps = {
    ...(manifest.dependencies || {}),
    ...(manifest.peerDependencies || {})
  };
  const siblingDeps = Object.keys(deps).filter(d => d.startsWith('@totemsdk/'));
  for (const depName of siblingDeps) {
    const dep = nameToPkg.get(depName);
    if (dep) visit(dep);
  }
  ordered.push(pkg);
}

for (const pkg of packages) visit(pkg);

// Get existing release tags
const releasedTags = new Set();
try {
  const result = execSync('git tag --list "totemsdk/*" --format="%(refname:short)"', {
    cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10000
  });
  for (const line of result.trim().split('\n')) {
    if (line) releasedTags.add(line);
  }
} catch {}

const HEAD = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' }).trim();
const toRelease = ordered.filter(p => !releasedTags.has(`totemsdk/${p.slug}-v${p.version}`));

console.log(`\n=== Release plan (${toRelease.length} packages) ===\n`);

let currentMaturity = null;
let count = 0;
for (const pkg of toRelease) {
  if (pkg.maturity !== currentMaturity) {
    currentMaturity = pkg.maturity;
    console.log(`\n${currentMaturity.toUpperCase()}:`);
  }
  count++;
  console.log(`  ${count}. ${pkg.name}@${pkg.version}`);
}

if (!process.argv.includes('--create')) {
  console.log(`\nRun with --create to execute releases in dependency order.`);
  process.exit(0);
}

console.log('\n=== Creating releases in dependency order ===\n');

for (const pkg of toRelease) {
  const tag = `totemsdk/${pkg.slug}-v${pkg.version}`;
  console.log(`Creating: ${pkg.name}@${pkg.version} → ${tag}`);

  // Create and push tag
  execSync(`git tag -a "${tag}" "${HEAD}" -m "Release ${pkg.name}@${pkg.version} (maturity: ${pkg.maturity})"`, {
    cwd: REPO_ROOT, stdio: 'pipe'
  });
  execSync(`git push origin "${tag}"`, { cwd: REPO_ROOT, stdio: 'pipe' });

  // Create GitHub release
  execSync(
    `gh release create ${tag} --title "${pkg.name} ${pkg.version}" --notes "Release ${pkg.name}@${pkg.version} (maturity: ${pkg.maturity})" --verify-tag`,
    { cwd: REPO_ROOT, stdio: 'inherit' }
  );

  console.log(`  ✅ Tagged and released ${pkg.name}@${pkg.version}\n`);
}

console.log('=== All tags and releases created! ===');
console.log(`GitHub Actions workflows are now running for each release.`);
console.log(`Go to https://github.com/Totem-Edge/totem-sdk/actions to approve npm-production deployments.`);

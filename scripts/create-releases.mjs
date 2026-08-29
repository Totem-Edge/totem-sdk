#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gates = JSON.parse(readFileSync(join(root, 'scripts/workspace-gates.config.json'), 'utf8'));

// Get all publishable packages with their versions
const packages = [];
for (const [dir, meta] of Object.entries(gates.packages)) {
  if (meta.status !== 'publishable') continue;
  const manifestPath = join(root, dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.private) continue;
  packages.push({
    name: manifest.name,
    slug: manifest.name.replace('@totemsdk/', ''),
    version: manifest.version,
    maturity: meta.maturity,
    dir
  });
}

// Get released tags (cached)
const releasedTags = new Set();
try {
  const result = execSync('git tag --list "totemsdk/*" --format="%(refname:short)"', {
    cwd: root,
    encoding: 'utf-8',
    timeout: 10000
  });
  for (const line of result.trim().split('\n')) {
    if (line) releasedTags.add(line);
  }
} catch {}

const HEAD = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf-8' }).trim();

// Split by maturity
const v1 = [];
const rc = [];
const other = [];

for (const pkg of packages) {
  const tag = `totemsdk/${pkg.slug}-v${pkg.version}`;
  if (releasedTags.has(tag)) continue;

  const entry = { pkg, tag, sha: HEAD };
  if (pkg.maturity === 'v1') v1.push(entry);
  else if (pkg.maturity === 'rc') rc.push(entry);
  else other.push(entry);
}

if (process.argv.includes('--create')) {
  const target = process.argv.includes('--v1') ? 'v1' : 
                 process.argv.includes('--rc') ? 'rc' : 
                 process.argv.includes('--all') ? 'all' : null;
  
  const queues = { v1, rc, other, all: [...v1, ...rc, ...other] };
  const toProcess = queues[target || 'v1'];
  
  if (!toProcess.length) {
    console.log(`No releases to create for ${target || 'v1'}.`);
    process.exit(0);
  }
  
  console.log(`=== Creating ${toProcess.length} releases (${target || 'v1'}) ===\n`);
  
  for (const { pkg, tag, sha } of toProcess) {
    console.log(`Creating: ${pkg.name}@${pkg.version}`);
    
    execSync(`git tag -a "${tag}" "${sha}" -m "Release ${pkg.name}@${pkg.version} (maturity: ${pkg.maturity})"`, {
      cwd: root,
      stdio: 'pipe'
    });
    
    execSync(`git push origin "${tag}"`, { cwd: root, stdio: 'pipe' });
    
    execSync(
      `gh release create ${tag} --title "${pkg.name} ${pkg.version}" --notes "Release ${pkg.name}@${pkg.version} (maturity: ${pkg.maturity})" --verify-tag`,
      { cwd: root, stdio: 'inherit' }
    );
    console.log(`  ✅`);
  }
  console.log('\n=== Done! ===');
  console.log('Note: Publish workflows will run and require approval from MrGheek.');
} else {
  console.log(`V1 packages needing release: ${v1.length}`);
  console.log(`RC packages needing release: ${rc.length}`);
  console.log(`Other packages needing release: ${other.length}`);
  console.log('\nCommands:');
  console.log(`  node scripts/create-releases.mjs --create --v1   (V1 releases first)`);
  console.log(`  node scripts/create-releases.mjs --create --rc    (RC releases)`);
  console.log(`  node scripts/create-releases.mjs --create --all   (all releases)`);
}

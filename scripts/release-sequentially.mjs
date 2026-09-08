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

// Filter to packages that have a release tag (i.e. we created a release for them)
const toRelease = ordered.filter(p => {
  const tag = `totemsdk/${p.slug}-v${p.version}`;
  return releasedTags.has(tag);
});

const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
const HEAD_SHA = '7bcf65a9a0c8539aac2138e85a2d96db2064e2b7';

function apiGet(url) {
  return execSync(
    `curl -s -H 'Authorization: token ${token}' -H 'Accept: application/vnd.github+json' '${url}'`,
    { encoding: 'utf-8' }
  );
}

function apiPost(url, body) {
  return execSync(
    `curl -s -X POST -H 'Authorization: token ${token}' -H 'Accept: application/vnd.github+json' -H 'Content-Type: application/json' -d '${body}' '${url}'`,
    { encoding: 'utf-8' }
  );
}

function getRunForPackage(slug, version) {
  const tag = `totemsdk/${slug}-v${version}`;
  const runs = JSON.parse(execSync(
    `gh run list --workflow publish-totemsdk.yml --limit 100 --json databaseId,displayTitle,status,conclusion,headSha,headBranch`,
    { encoding: 'utf-8' }
  ));
  // Find the run for this tag with the correct SHA
  return runs.find(r => r.headBranch === tag && r.headSha === HEAD_SHA) || null;
}

function approveRun(runId) {
  const pending = apiGet(`https://api.github.com/repos/Totem-Edge/totem-sdk/actions/runs/${runId}/pending_deployments`);
  const deps = JSON.parse(pending);
  if (!Array.isArray(deps) || deps.length === 0) return false;
  const envIds = deps.map(d => d.environment.id);
  const result = apiPost(
    `https://api.github.com/repos/Totem-Edge/totem-sdk/actions/runs/${runId}/pending_deployments`,
    JSON.stringify({ environment_ids: envIds, state: 'approved', comment: 'Approved for V1 release' })
  );
  return result.includes('npm-production');
}

function waitForCompletion(runId, timeoutSec = 1800) {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    const run = JSON.parse(apiGet(`https://api.github.com/repos/Totem-Edge/totem-sdk/actions/runs/${runId}`));
    if (run.status === 'completed') {
      return run.conclusion;
    }
    // Wait 15s between checks
    execSync('sleep 15');
  }
  return 'timeout';
}

console.log(`=== Sequential release pipeline (${toRelease.length} packages) ===\n`);

let successCount = 0;
let failCount = 0;
const failures = [];

for (const pkg of toRelease) {
  const tag = `totemsdk/${pkg.slug}-v${pkg.version}`;
  console.log(`\n[${pkg.name}@${pkg.version}] (maturity: ${pkg.maturity})`);

  // Find the workflow run for this package
  let run = getRunForPackage(pkg.slug, pkg.version);
  if (!run) {
    console.log(`  ⚠️  No workflow run found for ${tag}`);
    continue;
  }

  // If the run already completed successfully, skip
  if (run.status === 'completed' && run.conclusion === 'success') {
    console.log(`  ✅ Already published successfully`);
    successCount++;
    continue;
  }

  // If the run failed, we need to re-run it
  if (run.status === 'completed' && run.conclusion === 'failure') {
    console.log(`  🔄 Re-running failed workflow...`);
    execSync(`gh run rerun ${run.databaseId}`, { stdio: 'pipe' });
    // Wait for it to become waiting again
    execSync('sleep 20');
    run = getRunForPackage(pkg.slug, pkg.version);
  }

  // If the run is queued, wait for it to become waiting (needs approval)
  if (run.status === 'queued') {
    console.log(`  ⏳ Waiting for run to reach approval gate...`);
    let attempts = 0;
    while (attempts < 30) {
      execSync('sleep 10');
      run = getRunForPackage(pkg.slug, pkg.version);
      if (run && (run.status === 'waiting' || run.status === 'in_progress' || run.status === 'completed')) break;
      attempts++;
    }
  }

  // Approve the deployment
  if (run.status === 'waiting') {
    console.log(`  ✅ Approving deployment...`);
    const approved = approveRun(run.databaseId);
    if (!approved) {
      console.log(`  ❌ Failed to approve deployment`);
      failCount++;
      failures.push(pkg.name);
      continue;
    }
  }

  // Wait for completion
  console.log(`  ⏳ Waiting for publish to complete...`);
  const conclusion = waitForCompletion(run.databaseId);
  
  if (conclusion === 'success') {
    console.log(`  ✅ ${pkg.name}@${pkg.version} published successfully!`);
    successCount++;
  } else {
    console.log(`  ❌ ${pkg.name}@${pkg.version} ${conclusion}`);
    failCount++;
    failures.push(pkg.name);
  }
}

console.log(`\n=== Pipeline complete ===`);
console.log(`Success: ${successCount}`);
console.log(`Failed: ${failCount}`);
if (failures.length) {
  console.log(`Failures: ${failures.join(', ')}`);
}

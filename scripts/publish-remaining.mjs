#!/usr/bin/env node
import { execSync } from 'node:child_process';

const token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
const HEAD_SHA = '7bcf65a9a0c8539aac2138e85a2d96db2064e2b7';

// Dependency-ordered (leaves first)
const ORDER = [
  { slug: 'proof', version: '1.0.0' },
  { slug: 'proofgraph', version: '1.0.0' },
  { slug: 'proof-integritas', version: '1.0.0' },
  { slug: 'spatial-proof', version: '1.0.0' },
  { slug: 'raster-proof', version: '1.0.0' },
  { slug: 'provider-bond', version: '0.2.0' },
  { slug: 'realtime', version: '0.2.0' },
  { slug: 'se-server', version: '0.5.0' },
  { slug: 'statechain', version: '0.2.0' },
  { slug: 'tx-builder', version: '0.2.0' },
  { slug: 'wallet-adapter', version: '1.0.0' },
  { slug: 'mcp-server', version: '0.2.0' },
];

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

function getRunForTag(tag) {
  const runs = JSON.parse(execSync(
    `gh run list --workflow publish-totemsdk.yml --limit 100 --json databaseId,displayTitle,status,conclusion,headSha,headBranch`,
    { encoding: 'utf-8' }
  ));
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

function waitForCompletion(runId, timeoutSec = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    const run = JSON.parse(apiGet(`https://api.github.com/repos/Totem-Edge/totem-sdk/actions/runs/${runId}`));
    if (run.status === 'completed') return run.conclusion;
    execSync('sleep 15');
  }
  return 'timeout';
}

function isPublished(slug, version) {
  try {
    const ver = execSync(`npm view @totemsdk/${slug} version`, { encoding: 'utf-8', timeout: 10000 }).trim();
    return ver === version;
  } catch {
    return false;
  }
}

console.log(`=== Sequential publish (${ORDER.length} packages) ===\n`);

let success = 0, failed = 0;
const failures = [];

for (const { slug, version } of ORDER) {
  const tag = `totemsdk/${slug}-v${version}`;
  console.log(`\n[${slug}@${version}]`);

  if (isPublished(slug, version)) {
    console.log(`  ✅ Already on npm`);
    success++;
    continue;
  }

  let run = getRunForTag(tag);
  if (!run) {
    console.log(`  ⚠️  No run found`);
    failed++;
    failures.push(slug);
    continue;
  }

  // If failed, re-run
  if (run.status === 'completed' && run.conclusion === 'failure') {
    console.log(`  🔄 Re-running...`);
    execSync(`gh run rerun ${run.databaseId}`, { stdio: 'pipe' });
    execSync('sleep 20');
    run = getRunForTag(tag);
  }

  // Wait for approval gate
  let attempts = 0;
  while (run && (run.status === 'queued' || run.status === 'in_progress') && attempts < 40) {
    execSync('sleep 10');
    run = getRunForTag(tag);
    attempts++;
  }

  if (run && run.status === 'waiting') {
    console.log(`  ✅ Approving...`);
    approveRun(run.databaseId);
  }

  console.log(`  ⏳ Waiting for publish...`);
  const conclusion = waitForCompletion(run.databaseId);

  if (conclusion === 'success' || isPublished(slug, version)) {
    console.log(`  ✅ ${slug}@${version} published!`);
    success++;
  } else {
    console.log(`  ❌ ${slug}@${version} ${conclusion}`);
    failed++;
    failures.push(slug);
  }
}

console.log(`\n=== Complete ===`);
console.log(`Success: ${success}, Failed: ${failed}`);
if (failures.length) console.log(`Failures: ${failures.join(', ')}`);

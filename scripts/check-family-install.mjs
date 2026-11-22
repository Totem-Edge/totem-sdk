#!/usr/bin/env node
/**
 * CAN-008 (b) — flat whole-family install guard.
 *
 * Installs EVERY publishable @totemsdk package at its maturity dist-tag
 * (`latest` for v1, `next` for rc, `beta`, `alpha`) into one throwaway project
 * with default npm peer resolution (no `--legacy-peer-deps`, no overrides), so
 * any cross-package ERESOLVE (e.g. two packages demanding mutually exclusive
 * 0.x ranges of one dependency) fails the release instead of a consumer's
 * `npm install`. This is the SDK-side port of Canary scenario `00-install-smoke`.
 *
 * Usage: node scripts/check-family-install.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));

const EXPECTED_TAG = { v1: 'latest', rc: 'next', beta: 'beta', alpha: 'alpha' };

/** Post-publication mode: never defer a package that is ahead of the registry. */
const STRICT = process.env.STRICT_FAMILY_INSTALL === '1';

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

const entries = [];
const unpublished = [];
const pending = [];

/**
 * Is this exact version installable? `dist-tags` is not enough: an rc package
 * publishes on `next` and leaves `latest` behind, so comparing the workspace
 * version to `latest` reported the whole rc family as "pending" and silently
 * shrank this guard to a handful of packages.
 */
function versionPublished(name, version) {
  try {
    const out = execFileSync('npm', ['view', `${name}@${version}`, 'version'], {
      encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === version;
  } catch {
    return false;
  }
}

for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue;
  const pj = join(ROOT, dir, 'package.json');
  if (!existsSync(pj)) continue;
  const pkg = JSON.parse(readFileSync(pj, 'utf8'));
  if (!pkg.name) continue;
  const expected = EXPECTED_TAG[meta.maturity] ?? 'latest';
  const tags = readTags(pkg.name);
  // A package with no published version (new package or prerelease rename) cannot
  // be installed from the registry. Defer it explicitly; strict mode fails so
  // post-publication verification cannot silently skip it.
  if (!tags || !tags.latest) {
    unpublished.push(pkg.name);
    continue;
  }
  // A package whose workspace version is not on the registry at all is
  // mid-release-train: consumers cannot install the version this commit will
  // publish, so installing the stale tag would check a family that no longer
  // matches the tree (e.g. a peer range already bumped for the new version).
  // Defer it; the publish workflow's per-package `smoke-release-install.mjs`
  // is the authoritative registry check once the version exists.
  if (!STRICT && !versionPublished(pkg.name, pkg.version)) {
    pending.push(`${pkg.name}@${pkg.version} (not on npm)`);
    continue;
  }
  const tag = tags[expected] ? expected : 'latest';
  entries.push({ name: pkg.name, tag });
}
entries.sort((a, b) => a.name.localeCompare(b.name));

if (pending.length > 0) {
  console.log(`family install: deferring ${pending.length} package(s) ahead of their published version:`);
  for (const item of pending) console.log(`  - ${item}`);
}
if (unpublished.length > 0) {
  console.log(`family install: deferring ${unpublished.length} unpublished package(s): ${unpublished.join(', ')}`);
}
if (unpublished.length > 0 || pending.length > 0) {
  if (STRICT) {
    console.error('✗ strict family install requires every publishable package to be published at its workspace version');
    process.exit(1);
  }
}
if (entries.length === 0) {
  console.error('✗ no published publishable packages found');
  process.exit(1);
}
const specs = entries.map((entry) => `${entry.name}@${entry.tag}`);

const dir = mkdtempSync(join(tmpdir(), 'totem-family-install-'));
try {
  execFileSync('npm', ['init', '-y'], { cwd: dir, stdio: 'ignore' });
  console.log(`family install: installing ${entries.length} packages at maturity tags (${entries.filter(e => e.tag !== 'latest').length} non-latest) …`);
  execFileSync('npm', ['install', '--no-audit', '--no-fund', ...specs], {
    cwd: dir,
    stdio: 'inherit',
    // Default peer resolution: do NOT set legacy-peer-deps.
    env: { ...process.env, npm_config_legacy_peer_deps: 'false' },
  });
  console.log(`family install: OK — ${entries.length} packages co-install with default peer resolution.`);
} catch {
  console.error('✗ family install FAILED — likely ERESOLVE across the published family.');
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

#!/usr/bin/env node
/**
 * Emit a Totem SDK release-awareness feed (totemsdk-release-feed/v1).
 *
 * Awareness only: consumers decide whether to act. This script never publishes
 * packages; it only describes what exists.
 *
 * The signed source of truth is @totemsdk/manifest's release/advisory
 * announcements (kind 'sdk-release' / 'security-advisory'), which lookup nodes
 * replicate. This JSON is a CI artifact / offline snapshot for environments
 * that cannot reach a lookup node.
 *
 *   node scripts/emit-release-feed.mjs --out release-feed.json
 *   node scripts/emit-release-feed.mjs --packages @totemsdk/omnia-host,@totemsdk/chain-provider
 *   node scripts/emit-release-feed.mjs --channel next
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outPath = arg('out') ?? join(root, 'release-feed.json');
const only = arg('packages')?.split(',').map((s) => s.trim()).filter(Boolean);
// Dist-tag used as the production recommendation. Use 'next' for rc fleets.
const channel = arg('channel') ?? 'latest';

const gates = JSON.parse(readFileSync(join(root, 'scripts/workspace-gates.config.json'), 'utf8'));

function distTags(name) {
  try {
    const raw = execFileSync('npm', ['view', name, 'dist-tags', '--json'], { encoding: 'utf8' });
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const packages = [];
for (const [dir, meta] of Object.entries(gates.packages)) {
  if (meta.status !== 'publishable') continue;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (manifest.private) continue;
  if (only && !only.includes(manifest.name)) continue;
  const tags = distTags(manifest.name);
  const versions = new Set([manifest.version, ...Object.values(tags)]);
  packages.push({
    name: manifest.name,
    distTags: tags,
    recommended: tags[channel] ?? tags.latest ?? manifest.version,
    versions: [...versions].filter(Boolean).map((version) => ({ version })),
  });
}

const feed = {
  schema: 'totemsdk-release-feed/v1',
  generatedAt: new Date().toISOString(),
  packages,
  advisories: [],
};

writeFileSync(outPath, JSON.stringify(feed, null, 2) + '\n');
console.log(`wrote ${outPath} (${packages.length} packages)`);

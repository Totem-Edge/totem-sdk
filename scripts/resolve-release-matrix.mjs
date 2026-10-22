#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gates = JSON.parse(readFileSync(join(root, 'scripts/workspace-gates.config.json'), 'utf8'));
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
const match = /^totemsdk\/([^/]+)-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);

if (!match) throw new Error(`Invalid release tag '${tag}'. Expected totemsdk/<package>-v<semver>.`);

const slug = match[1];
const version = match[2];
const publishable = new Map();
for (const [dir, meta] of Object.entries(gates.packages)) {
  if (meta.status !== 'publishable') continue;
  const manifestPath = join(root, dir, 'package.json');
  if (!existsSync(manifestPath)) throw new Error(`${dir} is publishable but has no package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  publishable.set(manifest.name, { dir, meta, manifest });
}

const target = [...publishable.values()].find(({ manifest }) => manifest.name === `@totemsdk/${slug}`);
if (!target) throw new Error(`No publishable package matches release tag ${tag}`);
if (target.manifest.private) throw new Error(`${target.manifest.name} is private`);
if (target.manifest.version !== version) {
  throw new Error(`${target.manifest.name} version ${target.manifest.version} does not match tag ${version}`);
}
if (target.manifest.publishConfig?.access !== 'public') {
  throw new Error(`${target.manifest.name} must declare publishConfig.access=public`);
}
for (const required of ['build', 'test']) {
  if (!target.manifest.scripts?.[required]) throw new Error(`${target.manifest.name} is missing scripts.${required}`);
}

function workspaceDependencies(manifest) {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  }).filter((name) => publishable.has(name));
}

const closure = new Set();
function visit(name) {
  if (closure.has(name)) return;
  closure.add(name);
  for (const dependency of workspaceDependencies(publishable.get(name).manifest)) visit(dependency);
}
visit(target.manifest.name);

const needsWasm = [...closure].some((name) => {
  const scripts = publishable.get(name).manifest.scripts ?? {};
  return Object.values(scripts).some((script) => String(script).includes('wasm-pack'));
});

// Some packages declare rust wasm output (files: ["rust/pkg", ...]) and keep a
// `build:wasm` script, but no longer invoke it from `build` (RFC-031 Fix A made
// dev builds wasm-free). Publish must still produce those artifacts, or the
// verify-consumer-pack gate rejects the tarball for a missing declared file.
const buildWasm = Boolean(target.manifest.scripts?.['build:wasm']);

function distTag(meta) {
  switch (meta.maturity) {
    case 'v1': return 'latest';
    case 'rc': return 'next';
    case 'beta': return 'beta';
    case 'alpha': return 'alpha';
    default: return 'latest';
  }
}

process.stdout.write(JSON.stringify({
  include: [{
    pkg: slug,
    dir: target.dir,
    npm_name: target.manifest.name,
    version,
    dist_tag: distTag(target.meta),
    needs_wasm: needsWasm,
    build_wasm: buildWasm,
  }],
}));

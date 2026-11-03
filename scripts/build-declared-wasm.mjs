#!/usr/bin/env node
/**
 * Build every package that publishes Rust/WASM artifacts.
 *
 * Packages declare `files: ["rust/pkg", ...]` but RFC-031 Fix A keeps
 * `build:wasm` out of their normal `build` script, so a plain workspace build
 * leaves those directories absent. The release workflow builds them per
 * package; the pack and Bun gates need the same artifacts or they reject a
 * tarball / fail a load for a declared-but-missing file.
 *
 * Usage:
 *   node scripts/build-declared-wasm.mjs
 *   node scripts/build-declared-wasm.mjs --filter @totemsdk/omnia,@totemsdk/edge-mqtt
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const filterIndex = args.indexOf('--filter');
const requested = filterIndex >= 0 ? args[filterIndex + 1] : '';
const filters = new Set(
  requested
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('@') ? entry : `@totemsdk/${entry}`)),
);

const targets = [];
for (const entry of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(ROOT, 'packages', entry.name);
  const manifestPath = join(directory, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.some((file) => String(file).startsWith('rust/pkg'))) continue;
  if (!manifest.scripts?.['build:wasm']) continue;
  if (filters.size > 0 && !filters.has(manifest.name)) continue;
  targets.push({ name: manifest.name, directory });
}

if (targets.length === 0) {
  console.error('no packages declaring rust/pkg were selected');
  process.exit(1);
}

for (const target of targets) {
  console.log(`build wasm: ${target.name}`);
  execFileSync('npm', ['run', 'build:wasm'], { cwd: target.directory, stdio: 'inherit' });
  // wasm-pack writes a .gitignore into each output; the publish workflow strips
  // it so the tarball matches the declared file list.
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'clean-wasm-output-ignores.mjs')], {
    cwd: target.directory,
    stdio: 'inherit',
  });
}

console.log(`wasm build: ${targets.length} package(s)`);

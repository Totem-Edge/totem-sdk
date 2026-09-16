#!/usr/bin/env node
/**
 * `@totemsdk/storage` → `@totemsdk/core` DAG lint (RFC-007 §4.1).
 *
 * The dependency direction is one-way: storage → core. Core imports nothing from
 * storage, and storage depends on no other @totemsdk/* package. A cycle is a
 * build-order and layering violation and is forbidden by construction.
 *
 * Usage:
 *   node scripts/verify-storage-dag.mjs     # check only (exit 1 on violation)
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CORE_SRC = join(ROOT, 'packages', 'core', 'src');
const STORAGE_SRC = join(ROOT, 'packages', 'storage', 'src');
const STORAGE_PKG = join(ROOT, 'packages', 'storage', 'package.json');

const errors = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const imports = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*(?:import|export)\b.+?from\s+['"]([^'"]+)['"]/);
    if (m) imports.push(m[1]);
  }
  return imports;
}

function relativeSpec(spec, file, base) {
  if (!spec.startsWith('.')) return null;
  let target = resolve(dirname(file), spec);
  const idx = target.indexOf('#');
  if (idx !== -1) target = target.slice(0, idx);
  const rel = resolve(ROOT, target);
  return rel.startsWith(base) ? rel : null;
}

if (existsSync(CORE_SRC)) {
  for (const file of walk(CORE_SRC)) {
    for (const spec of importsOf(file)) {
      if (spec === '@totemsdk/storage') {
        errors.push(`${file}: core must not import @totemsdk/storage`);
      }
      if (spec.startsWith('@totemsdk/storage/')) {
        errors.push(`${file}: core must not import a @totemsdk/storage subpath`);
      }
      const rel = relativeSpec(spec, file, STORAGE_SRC);
      if (rel) {
        errors.push(`${file}: core source must not import a storage path`);
      }
    }
  }
}

if (existsSync(STORAGE_SRC)) {
  for (const file of walk(STORAGE_SRC)) {
    for (const spec of importsOf(file)) {
      if (spec.startsWith('@totemsdk/') && spec !== '@totemsdk/core') {
        errors.push(`${file}: storage must only import @totemsdk/core (got ${spec})`);
      }
    }
  }
}

if (existsSync(STORAGE_PKG)) {
  const pkg = JSON.parse(readFileSync(STORAGE_PKG, 'utf8'));
  const depGroups = [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies];
  for (const group of depGroups ?? []) {
    for (const name of Object.keys(group ?? {})) {
      if (name.startsWith('@totemsdk/') && name !== '@totemsdk/core') {
        errors.push(`packages/storage/package.json: declares @totemsdk/* dependency ${name} (only @totemsdk/core is allowed)`);
      }
    }
  }
}

for (const msg of errors) console.error(`✗ ${msg}`);
if (errors.length === 0) {
  console.log('storage→core DAG lint: PASS');
  process.exit(0);
} else {
  console.error(`storage→core DAG lint: FAIL (${errors.length} violation(s))`);
  process.exit(1);
}
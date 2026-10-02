#!/usr/bin/env node
/**
 * RFC-031 P3 — generate a Cargo.lock-derived SBOM (software bill of materials).
 *
 * Lists every crate the WASM artifact is built from, with version + checksum, so
 * the supply chain is auditable and drift-checked in CI. Regenerate after a
 * dependency change:
 *
 *   node scripts/write-sbom.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = readFileSync(join(root, 'Cargo.lock'), 'utf8');

const packages = [];
for (const block of lock.split('[[package]]').slice(1)) {
  const name = /name = "([^"]+)"/.exec(block)?.[1];
  const version = /version = "([^"]+)"/.exec(block)?.[1];
  const checksum = /checksum = "([^"]+)"/.exec(block)?.[1];
  if (!name || !version) continue;
  packages.push({ name, version, ...(checksum ? { checksum } : {}) });
}
packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const sbom = {
  format: 'totem-cargo-lock/v1',
  note: 'RFC-031 P3 SBOM. Regenerate: node scripts/write-sbom.mjs',
  component: '@totemsdk/core-wasm',
  generatedFrom: 'Cargo.lock',
  packageCount: packages.length,
  packages,
};

writeFileSync(join(root, 'sbom.json'), JSON.stringify(sbom, null, 2) + '\n');
console.log(`wrote sbom.json: ${packages.length} crates`);

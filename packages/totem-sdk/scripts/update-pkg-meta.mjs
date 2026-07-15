#!/usr/bin/env node
/**
 * One-shot script to apply all npm metadata fixes to every @totemsdk/* package.
 * Run: node packages/totem-sdk/scripts/update-pkg-meta.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = join(__dirname, '..', 'packages');

const MIT_LICENSE = `MIT License

Copyright (c) 2024 Totem SDK Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const BASE_KEYWORDS = [
  'totem', 'totemsdk', 'minima', 'blockchain',
  'quantum-resistant', 'wots', 'kissvm', 'utxo',
];

const EXTRA_KEYWORDS = {
  'statechain':       ['statechain'],
  'omnia':            ['omnia', 'payment-channel', 'eltoo'],
  'omnia-factory':    ['omnia', 'payment-channel', 'eltoo'],
  'omnia-router':     ['omnia', 'payment-channel', 'eltoo'],
  'stream-transport': ['transport', 'stream', 'p2p'],
  'pubsub-transport': ['transport', 'pubsub', 'mqtt'],
  'omnia-splice':     ['omnia', 'payment-channel', 'eltoo'],
  'lookup-client':    ['hyperswarm', 'p2p'],
  'lookup-node':      ['hyperswarm', 'p2p'],
  'lookup-protocol':  ['hyperswarm', 'p2p'],
  'pear':             ['pear', 'bare'],
  'root-identity':    ['identity', 'did'],
  'identity':         ['identity', 'did'],
};

const SHARED_META = {
  author: 'Totem SDK',
  homepage: 'https://totem.ing',
  bugs: { url: 'https://github.com/MrGheek/totem-sdk/issues' },
};

function repoFor(pkgDir) {
  return {
    type: 'git',
    url: 'git+https://github.com/MrGheek/totem-sdk.git',
    directory: `packages/totem-sdk/packages/${pkgDir}`,
  };
}

function keywordsFor(pkgDir) {
  const extras = EXTRA_KEYWORDS[pkgDir] || [];
  return [...new Set([...BASE_KEYWORDS, ...extras])];
}

const STALE_CORE_RE    = /workspace:\^1\.0\.[4-8](?!\d)/g;
const STALE_TXPOW_RE   = /workspace:\^0\.1\.2(?!\d)/g;

import { readdirSync, statSync } from 'fs';

const pkgDirs = readdirSync(PACKAGES_DIR).filter(d => {
  if (d === 'sdk-tests') return false;
  return statSync(join(PACKAGES_DIR, d)).isDirectory();
});

for (const pkgDir of pkgDirs) {
  const pkgPath = join(PACKAGES_DIR, pkgDir, 'package.json');
  if (!existsSync(pkgPath)) continue;

  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw);

  // 1. Shared metadata
  Object.assign(pkg, SHARED_META);
  pkg.license = 'MIT';
  pkg.repository = repoFor(pkgDir);

  // 2. Keywords — preserve existing extras, dedupe
  const existing = Array.isArray(pkg.keywords) ? pkg.keywords : [];
  const base = keywordsFor(pkgDir);
  pkg.keywords = [...new Set([...base, ...existing])];

  // 3. files array
  pkg.files = ['dist', 'README.md', 'LICENSE'];

  // 4. Fix stale workspace semver ranges in dependencies and devDependencies
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (!pkg[field]) continue;
    for (const [dep, ver] of Object.entries(pkg[field])) {
      if (typeof ver !== 'string') continue;
      let updated = ver;
      if (dep === '@totemsdk/core')  updated = updated.replace(STALE_CORE_RE,  'workspace:^1.0.9');
      if (dep === '@totemsdk/txpow') updated = updated.replace(STALE_TXPOW_RE, 'workspace:^0.1.3');
      if (updated !== ver) {
        pkg[field][dep] = updated;
        console.log(`  [${pkgDir}] ${dep}: ${ver} → ${updated}`);
      }
    }
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // 5. Create LICENSE file
  const licensePath = join(PACKAGES_DIR, pkgDir, 'LICENSE');
  writeFileSync(licensePath, MIT_LICENSE);

  console.log(`✓ ${pkgDir}`);
}

console.log('\nDone. All packages updated.');

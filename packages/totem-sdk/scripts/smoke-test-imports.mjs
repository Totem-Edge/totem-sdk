#!/usr/bin/env node
/**
 * Smoke test: dynamically import each package's dist entry point and validate
 * known named exports. Also verifies require() compatibility via createRequire
 * for Node 22+ ESM-require support.
 *
 * Run before publishing to catch:
 * - CJS/ESM mismatches (missing "export" statements)
 * - Missing dist files
 * - Version-skew: missing exports that appear in src but not published dist
 * - @noble/hashes v2 subpath breakage
 *
 * Usage:
 *   node packages/totem-sdk/scripts/smoke-test-imports.mjs
 *
 * Requires Node >= 22 (ESM require support). Exit 0 = all pass.
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packagesDir = resolve(__dirname, '../packages');

/**
 * Named exports to verify per package.
 * These are the specific symbols that caused import failures in the bug report.
 */
const NAMED_EXPORT_CHECKS = {
  '@totemsdk/txpow': ['verifyTxPoWWork', 'verifyProofOfWork', 'mineTxPoW', 'serializeTxPoW'],
  '@totemsdk/core': ['wotsVerifyDigest', 'wotsSign', 'wotsKeypairFromSeed', 'TreeKey'],
  '@totemsdk/node': ['MinimaClient', 'MinimaWallet', 'MinimaProvider'],
  '@totemsdk/stream-transport': [
    // IStreamTransport is a TS interface — no runtime value; skip
    'NodeStreamTransport', 'WebSocketTransport',
    'InMemoryTransport', 'createInMemoryPair', 'channelTopic', 'peerTopic', 'broadcastTopic',
  ],
  '@totemsdk/pubsub-transport': [
    // IPubSubTransport and PubSubMessage are TS interfaces — no runtime value; skip
    'EventEmitterTransport', 'MockPubSubTransport', 'createPairedEventEmitterTransports',
  ],
};

const PACKAGES = [
  { pkg: 'core', name: '@totemsdk/core' },
  { pkg: 'node', name: '@totemsdk/node' },
  { pkg: 'tx-builder', name: '@totemsdk/tx-builder' },
  { pkg: 'realtime', name: '@totemsdk/realtime' },
  { pkg: 'txpow', name: '@totemsdk/txpow' },
  { pkg: 'kissvm', name: '@totemsdk/kissvm' },
  { pkg: 'statechain', name: '@totemsdk/statechain' },
  { pkg: 'omnia', name: '@totemsdk/omnia' },
  { pkg: 'omnia-factory', name: '@totemsdk/omnia-factory' },
  { pkg: 'stream-transport', name: '@totemsdk/stream-transport' },
  { pkg: 'pubsub-transport', name: '@totemsdk/pubsub-transport' },
  { pkg: 'omnia-splice', name: '@totemsdk/omnia-splice' },
  { pkg: 'lookup-node', name: '@totemsdk/lookup-node' },
];

const req = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
const failures = [];

const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
const supportsRequireESM = nodeVersion >= 22;

for (const { pkg, name } of PACKAGES) {
  const pkgDir = resolve(packagesDir, pkg);
  const pkgJsonPath = resolve(pkgDir, 'package.json');

  if (!existsSync(pkgJsonPath)) {
    console.warn(`  SKIP  ${name} (no package.json found)`);
    continue;
  }

  let pkgJson;
  try {
    pkgJson = req(pkgJsonPath);
  } catch {
    console.warn(`  SKIP  ${name} (could not read package.json)`);
    continue;
  }

  const mainField =
    pkgJson.exports?.['.']?.import ||
    pkgJson.exports?.import ||
    pkgJson.main;

  if (!mainField) {
    console.warn(`  SKIP  ${name} (no main/exports entry)`);
    continue;
  }

  const entryPath = resolve(pkgDir, mainField);

  if (!existsSync(entryPath)) {
    failures.push({ pkg: name, error: `dist entry not found: ${mainField}` });
    console.error(`  FAIL  ${name} — dist entry missing: ${mainField}`);
    failed++;
    continue;
  }

  let mod;
  try {
    mod = await import(entryPath);
    console.log(`  PASS  ${name} (ESM import)`);
    passed++;
  } catch (err) {
    failures.push({ pkg: name, error: `ESM import failed: ${err.message}` });
    console.error(`  FAIL  ${name} — ESM import: ${err.message}`);
    failed++;
    continue;
  }

  const requiredExports = NAMED_EXPORT_CHECKS[name];
  if (requiredExports) {
    for (const exportName of requiredExports) {
      if (!(exportName in mod)) {
        const msg = `missing named export: ${exportName}`;
        failures.push({ pkg: name, error: msg });
        console.error(`  FAIL  ${name} — ${msg}`);
        failed++;
      } else {
        console.log(`  PASS  ${name} exports.${exportName}`);
        passed++;
      }
    }
  }

  if (supportsRequireESM && pkgJson.exports?.['.']?.default) {
    try {
      const requirePath = resolve(pkgDir, pkgJson.exports['.'].default);
      req(requirePath);
      console.log(`  PASS  ${name} (require() compat)`);
      passed++;
    } catch (err) {
      if (err.code === 'ERR_REQUIRE_ESM') {
        console.warn(`  WARN  ${name} — require() returned ERR_REQUIRE_ESM (Node ${nodeVersion}; Node 22+ needed for stable ESM require)`);
      } else {
        failures.push({ pkg: name, error: `require() failed: ${err.message}` });
        console.error(`  FAIL  ${name} — require(): ${err.message}`);
        failed++;
      }
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\nFailed packages:');
  for (const { pkg, error } of failures) {
    console.error(`  ${pkg}: ${error}`);
  }
  process.exit(1);
}

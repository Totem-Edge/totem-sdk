#!/usr/bin/env node
/**
 * Wallet-adapter ⇄ connect parity gate.
 *
 * Ensures the SDK wallet base class is bound to the shared
 * `@totemsdk/connect/wallet` runtime (so every canonical connect method has an
 * explicit supported/unsupported disposition) and that the runtime's method
 * inventory has not drifted from the dApp-facing connect methods.
 *
 * Source-based: runs in the lint job without a workspace build.
 *
 * Usage: node scripts/check-wallet-adapter-parity.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const connectSrc = read('packages/connect/src/index.ts');
const walletSrc = read('packages/connect/src/wallet.ts');
const adapterSrc = read('packages/wallet-adapter/src/index.ts');

const unique = (values) => [...new Set(values)];
const clientMethods = unique(
  [...connectSrc.matchAll(/method:\s*'([A-Za-z_]+)'/g)].map((match) => match[1]),
).sort();
const descriptorMethods = new Set(
  [...walletSrc.matchAll(/\bd\('([A-Za-z_]+)'/g)].map((match) => match[1]),
);

const failures = [];

if (!adapterSrc.includes("from '@totemsdk/connect/wallet'")) {
  failures.push("wallet-adapter must consume the shared '@totemsdk/connect/wallet' runtime");
}
if (!adapterSrc.includes('createWalletRuntime')) {
  failures.push('wallet-adapter must compose createWalletRuntime (no hand-rolled dispatch)');
}
if (!walletSrc.includes('createDefaultHandlers')) {
  failures.push('connect/wallet must expose createDefaultHandlers');
}

for (const method of clientMethods) {
  if (!descriptorMethods.has(method)) {
    failures.push(`connect method ${method} has no WALLET_METHODS descriptor`);
  }
}
for (const method of descriptorMethods) {
  if (!clientMethods.includes(method)) {
    failures.push(`WALLET_METHODS descriptor ${method} is not a connect client method`);
  }
}

if (failures.length > 0) {
  console.error('✗ wallet-adapter parity gate:');
  for (const failure of failures) console.error('  - ' + failure);
  process.exit(1);
}

console.log(
  `wallet-adapter parity: ${clientMethods.length} connect methods match ${descriptorMethods.size} runtime descriptors; adapter bound to createWalletRuntime.`,
);

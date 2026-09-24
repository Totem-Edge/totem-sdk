#!/usr/bin/env node
/**
 * Wallet ⇄ connect parity audit (machine-checkable).
 *
 * Extracts the dApp-facing methods published by `@totemsdk/connect` and compares
 * them against what the Totem Extension and the Totem PWA actually handle, stub,
 * or silently ignore. Designed to run in CI so the manual string tables in both
 * wallets can never drift unnoticed.
 *
 * Usage:
 *   node scripts/audit-wallet-connect-parity.mjs            # markdown table
 *   node scripts/audit-wallet-connect-parity.mjs --json     # JSON
 *   node scripts/audit-wallet-connect-parity.mjs --check    # exit 1 on drift
 *
 * "Drift" (fails --check):
 *   1. a wallet references a `TOTEM_*`/`totem_*` method that connect does not
 *      define and that is not a known wallet-internal verb; or
 *   2. a connect method is neither handled nor stubbed nor listed in
 *      KNOWN_GAPS for that wallet (i.e. a newly added connect method was not
 *      triaged).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONNECT = join(ROOT, 'packages/connect/src/index.ts');
const EXT = join(ROOT, 'extensions/totem-extension/src/background/index.ts');
const PWA = join(ROOT, 'extensions/totem-pwa-wallet/src/provider/provider-entry.ts');

const read = (p) => readFileSync(p, 'utf8');
const uniq = (xs) => [...new Set(xs)];
const allMatches = (text, re) => uniq([...text.matchAll(re)].map((m) => m[1]));

// ── connect methods ──────────────────────────────────────────────────────────
const connect = uniq(allMatches(read(CONNECT), /method:\s*'([A-Za-z_]+)'/g)).sort();

// Wallet-internal verbs that are intentionally not connect methods.
const WALLET_INTERNAL = new Set([
  'TOTEM_CONNECT_APPROVE', 'TOTEM_DISCONNECT', 'TOTEM_PROVE_OWNERSHIP',
  'WOTS_SEND', 'WOTS_SIGN_DATA', 'RPC_COMMAND', 'START_STREAM', 'STOP_STREAM',
  'GET_SNAPSHOT', 'GET_BALANCE_SNAPSHOT', 'PORTFOLIO_SNAPSHOT',
  'GET_CONNECTED_SITES', 'DISCONNECT_SITE', 'DISCONNECT_ALL_SITES', 'GET_RPC_ENDPOINT',
]);

// ── extension ────────────────────────────────────────────────────────────────
const extensionHandled = new Set(
  allMatches(read(EXT), /case\s+'([A-Za-z_]+)'/g),
);

// ── PWA ──────────────────────────────────────────────────────────────────────
const pwaSrc = read(PWA);
// Restrict the unsupported set to the actual array literal.
const unsupportedBlock = /unsupportedMethods\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(pwaSrc);
const pwaStubbed = new Set(
  unsupportedBlock ? allMatches(unsupportedBlock[1], /'([A-Za-z_]+)'/g) : [],
);
const pwaInline = new Set(allMatches(pwaSrc, /method\s*===\s*'([A-Za-z_]+)'/g));
const pwaSwitch = /function methodToPath[\s\S]*?switch \(method\) \{([\s\S]*?)default:/.exec(pwaSrc);
const pwaRouted = new Set();
if (pwaSwitch) {
  for (const m of pwaSwitch[1].matchAll(/case\s+'([A-Za-z_]+)':/g)) pwaRouted.add(m[1]);
}

function pwaStatus(method) {
  if (pwaStubbed.has(method) && !pwaInline.has(method)) return 'stub';
  if (pwaInline.has(method) || pwaRouted.has(method)) return 'handled';
  return 'missing';
}

// ── classify ─────────────────────────────────────────────────────────────────
const rows = connect.map((method) => ({
  method,
  extension: extensionHandled.has(method) ? 'handled' : 'missing',
  pwa: pwaStatus(method),
}));

// Known gaps: the audited set of connect methods a wallet does not yet serve.
// This list is intentionally STATIC. When a new connect method is added that a
// wallet does not serve, --check fails until it is implemented or triaged here.
// (Audited 2026-09-24 — see docs/audits/wallet-connect-parity-2026-09.md.)
const KNOWN_GAPS = {
  extension: [
    'totem_agentCreateReceipt', 'totem_agentExplainTransaction', 'totem_agentProposePayment',
    'totem_broadcastTxPoW', 'totem_createPaymentRequest', 'totem_getCapabilities',
    'totem_getProviderStatus', 'totem_getReceipt', 'totem_getTransactionStatus', 'totem_getWotsStatus',
    'totem_kissvmSimulate', 'totem_kissvmValidate', 'totem_mineTxPoW', 'totem_omniaCloseChannel',
    'totem_omniaCloseFactory', 'totem_omniaCreateFactory', 'totem_omniaGetChannels', 'totem_omniaGetRoute',
    'totem_omniaGetSwapRate', 'totem_omniaOpenChannel', 'totem_omniaOpenVirtualChannel', 'totem_omniaPay',
    'totem_omniaPayMultiHop', 'totem_omniaSettle', 'totem_omniaSpliceIn', 'totem_omniaSpliceOut',
    'totem_payPaymentRequest', 'totem_releaseWotsLease', 'totem_reserveWotsLease', 'totem_setChainProvider',
    'totem_signTransaction', 'totem_statechainClaim', 'totem_statechainCreate', 'totem_statechainTransfer',
    'totem_statechainVerify',
  ],
  pwa: [
    'totem_agentCreateReceipt', 'totem_agentExplainTransaction', 'totem_agentProposePayment',
    'totem_createPaymentRequest', 'totem_getReceipt', 'totem_getTransactionStatus',
    'totem_kissvmSimulate', 'totem_kissvmValidate', 'totem_mineTxPoW', 'totem_omniaCloseChannel',
    'totem_omniaCloseFactory', 'totem_omniaCreateFactory', 'totem_omniaGetChannels', 'totem_omniaGetRoute',
    'totem_omniaGetSwapRate', 'totem_omniaOpenChannel', 'totem_omniaOpenVirtualChannel', 'totem_omniaPay',
    'totem_omniaPayMultiHop', 'totem_omniaSettle', 'totem_omniaSpliceIn', 'totem_omniaSpliceOut',
    'totem_payPaymentRequest', 'totem_statechainClaim', 'totem_statechainCreate', 'totem_statechainTransfer',
    'totem_statechainVerify',
  ],
};

// ── output ───────────────────────────────────────────────────────────────────
const asJson = process.argv.includes('--json');
const check = process.argv.includes('--check');

if (asJson) {
  console.log(JSON.stringify({ connect, rows, KNOWN_GAPS }, null, 2));
} else {
  console.log('| connect method | extension | pwa |');
  console.log('|---|---|---|');
  for (const r of rows) console.log(`| \`${r.method}\` | ${r.extension} | ${r.pwa} |`);
  const extMiss = rows.filter((r) => r.extension === 'missing').length;
  const pwaBad = rows.filter((r) => r.pwa !== 'handled').length;
  console.log(`\nconnect methods: ${connect.length}`);
  console.log(`extension: ${connect.length - extMiss} handled / ${extMiss} missing`);
  console.log(`pwa: ${connect.length - pwaBad} handled / ${pwaBad} stub+missing`);
}

if (check) {
  const problems = [];

  // 1. Unknown methods referenced by a wallet (method-handling contexts only).
  const walletVerbs = uniq([
    ...allMatches(read(EXT), /case\s+'((?:TOTEM_|totem_)[A-Za-z_]+)'/g),
    ...allMatches(pwaSrc, /method\s*===\s*'((?:TOTEM_|totem_)[A-Za-z_]+)'/g),
    ...(unsupportedBlock ? allMatches(unsupportedBlock[1], /'((?:TOTEM_|totem_)[A-Za-z_]+)'/g) : []),
    ...(pwaSwitch ? allMatches(pwaSwitch[1], /case\s+'((?:TOTEM_|totem_)[A-Za-z_]+)'/g) : []),
  ]);
  const connectSet = new Set(connect);
  for (const v of walletVerbs) {
    if (!connectSet.has(v) && !WALLET_INTERNAL.has(v)) {
      problems.push(`unknown method referenced by a wallet: ${v}`);
    }
  }

  // 2. Newly-missing connect methods must be triaged into KNOWN_GAPS.
  const currentExtMissing = rows.filter((r) => r.extension === 'missing').map((r) => r.method).sort();
  const currentPwaGaps = rows.filter((r) => r.pwa === 'missing' || r.pwa === 'stub').map((r) => r.method).sort();
  const diff = (a, b) => a.filter((x) => !b.includes(x));
  for (const m of diff(currentExtMissing, [...KNOWN_GAPS.extension].sort())) {
    problems.push(`extension newly ignores connect method (triage me): ${m}`);
  }
  for (const m of diff(currentPwaGaps, [...KNOWN_GAPS.pwa].sort())) {
    problems.push(`pwa newly ignores connect method (triage me): ${m}`);
  }

  if (problems.length > 0) {
    console.error('\nPARITY CHECK FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\nPARITY CHECK PASSED');
}

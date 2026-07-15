#!/usr/bin/env node
/**
 * Totem Edge SDK Docs — generate script
 *
 * Steps:
 * 1. Clear docs/api/<slug>/ dirs
 * 2. Run TypeDoc per-package WITH typedoc-plugin-markdown (up to 4 parallel)
 *    → real class/interface/function/type pages in docs/api/<slug>/
 * 3. Post-process: fix YAML frontmatter quoting (@/ in values)
 * 4. Curated stub for any package where TypeDoc fails
 * 5. Extract exported symbols from generated file tree (no separate JSON run)
 * 6. Generate static/llms.txt, llms-full.txt, docs-manifest.json
 */

import { spawnSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const API_DIR = path.join(DOCS_DIR, 'api');
const STATIC_DIR = path.join(ROOT, 'static');
const TSCONFIG_FALLBACK = path.join(ROOT, 'tsconfig.typedoc.json');

// ---------------------------------------------------------------------------
// Read site identity
// ---------------------------------------------------------------------------
const _require = createRequire(import.meta.url);
const siteConfig = _require('../site.config.json');
const SITE_URL = (siteConfig.url + (siteConfig.baseUrl && siteConfig.baseUrl !== '/' ? siteConfig.baseUrl : '')).replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Package manifest
// entryPoint: path relative to REPO_ROOT (null = always write curated stub)
// ---------------------------------------------------------------------------
const PACKAGES = [
  { slug: 'totemsdk-core',             name: '@totemsdk/core',             desc: 'WOTS cryptography, TreeKey derivation, and Streamable serialization primitives',                entryPoint: 'packages/totem-sdk/packages/core/src/index.ts' },
  { slug: 'totemsdk-connect',          name: '@totemsdk/connect',          desc: 'Browser dApp to Totem wallet extension provider bridge (TOTEM_CONNECT v4.1)',                   entryPoint: 'packages/totem-sdk/packages/connect/src/index.ts' },
  { slug: 'totemsdk-root-identity',    name: '@totemsdk/root-identity',    desc: 'Root identity controlling up to 64 on-chain addresses',                                         entryPoint: 'packages/totem-sdk/packages/root-identity/src/index.ts' },
  { slug: 'totemsdk-server',           name: '@totemsdk/server',           desc: 'Node.js server SDK — wallet, transaction building, and Axia API client',                       entryPoint: 'packages/totem-sdk/packages/server/src/index.ts' },
  { slug: 'totemsdk-wallet-adapter',   name: '@totemsdk/wallet-adapter',   desc: 'Abstract base class for building Totem-compatible wallets',                                    entryPoint: 'packages/totem-sdk/packages/wallet-adapter/src/index.ts' },
  { slug: 'totemsdk-agent-policy',     name: '@totemsdk/agent-policy',     desc: 'QVAC AI bridge — policy evaluation seam between agents and the wallet',                        entryPoint: 'packages/totem-sdk/packages/agent-policy/src/index.ts' },
  { slug: 'totemsdk-manifest',         name: '@totemsdk/manifest',         desc: 'Canonical signed declarations for apps, AI capabilities, dApps, and edge services',            entryPoint: 'packages/totem-sdk/packages/manifest/src/index.ts' },
  { slug: 'totemsdk-omnia',            name: '@totemsdk/omnia',            desc: 'Eltoo payment channel state machine',                                                           entryPoint: 'packages/totem-sdk/packages/omnia/src/index.ts' },
  { slug: 'totemsdk-omnia-factory',    name: '@totemsdk/omnia-factory',    desc: 'N-of-N group channel factory',                                                                  entryPoint: 'packages/totem-sdk/packages/omnia-factory/src/index.ts' },
  { slug: 'totemsdk-omnia-router',     name: '@totemsdk/omnia-router',     desc: 'Multi-hop pathfinding and fee computation',                                                     entryPoint: 'packages/totem-sdk/packages/omnia-router/src/index.ts' },
  { slug: 'totemsdk-omnia-splice',     name: '@totemsdk/omnia-splice',     desc: 'Channel resizing without closing',                                                              entryPoint: 'packages/totem-sdk/packages/omnia-splice/src/index.ts' },
  { slug: 'totemsdk-omnia-vtxo',       name: '@totemsdk/omnia-vtxo',       desc: 'Virtual UTXO claim layer — cash-like off-chain balances backed by Merkle commitment trees',    entryPoint: 'packages/totem-sdk/packages/omnia-vtxo/src/index.ts' },
  { slug: 'totemsdk-edge',             name: '@totemsdk/edge',             desc: 'Unified developer-facing runtime for Totem Edge — port-injected, adapter-neutral',             entryPoint: 'packages/totem-sdk/packages/edge/src/index.ts' },
  { slug: 'totemsdk-edge-adapters',    name: '@totemsdk/edge-adapters',    desc: 'Reference adapters bridging Totem SDK packages to edge port interfaces',                       entryPoint: 'packages/totem-sdk/packages/edge-adapters/src/index.ts' },
  { slug: 'totemsdk-edge-mqtt',        name: '@totemsdk/edge-mqtt',        desc: 'MQTT adapter for Totem Edge — sensor bridges, gateways, MachinePay',                          entryPoint: 'packages/totem-sdk/packages/edge-mqtt/src/index.ts' },
  { slug: 'totemsdk-identity',         name: '@totemsdk/identity',         desc: 'Canonical identity and claims layer — identity documents, signed claims, graph resolution',    entryPoint: 'packages/totem-sdk/packages/identity/src/index.ts' },
  { slug: 'totemsdk-proof',            name: '@totemsdk/proof',            desc: 'Portable proof layer — create, sign, verify, and anchor WOTS-signed proof envelopes',         entryPoint: 'packages/totem-sdk/packages/proof/src/index.ts' },
  { slug: 'totemsdk-proof-integritas', name: '@totemsdk/proof-integritas', desc: 'Integritas v2 proof provider — on-chain hash stamping and verification',                      entryPoint: 'packages/totem-sdk/packages/proof-integritas/src/index.ts' },
  { slug: 'totemsdk-proofgraph',       name: '@totemsdk/proofgraph',       desc: 'Local deterministic proof relationship graph — content-addressed DAG',                        entryPoint: 'packages/totem-sdk/packages/proofgraph/src/index.ts' },
  { slug: 'totemsdk-provider-bond',    name: '@totemsdk/provider-bond',    desc: 'Provider trust layer — prove, record, score and filter infrastructure providers',             entryPoint: 'packages/totem-sdk/packages/provider-bond/src/index.ts' },
  { slug: 'totemsdk-liquidity-bond',   name: '@totemsdk/liquidity-bond',   desc: 'Deterministic LP position and productive liquidity record package',                           entryPoint: 'packages/totem-sdk/packages/liquidity-bond/src/index.ts' },
  { slug: 'totemsdk-lookup-client',    name: '@totemsdk/lookup-client',    desc: 'Hyperswarm client for Totem lookup nodes — chain queries and real-time updates',              entryPoint: 'packages/totem-sdk/packages/lookup-client/src/index.ts' },
  { slug: 'totemsdk-lookup-node',      name: '@totemsdk/lookup-node',      desc: 'Always-on personal lookup node — Hyperswarm, SQLite, WOTS lease coordination',               entryPoint: 'packages/totem-sdk/packages/lookup-node/src/index.ts' },
  { slug: 'totemsdk-lookup-protocol',  name: '@totemsdk/lookup-protocol',  desc: 'Wire protocol types, message framing, and auth for lookup node communication',                entryPoint: 'packages/totem-sdk/packages/lookup-protocol/src/index.ts' },
  { slug: 'totemsdk-txpow',            name: '@totemsdk/txpow',            desc: 'TxPoW proof-of-work mining, serialization, and verification',                                  entryPoint: 'packages/totem-sdk/packages/txpow/src/index.ts' },
  { slug: 'totemsdk-wots-lease',       name: '@totemsdk/wots-lease',       desc: 'WOTS key-use coordination — canonical v3 watermark and lease safety layers',                  entryPoint: 'packages/totem-sdk/packages/wots-lease/src/index.ts' },
  { slug: 'totemsdk-tx-builder',       name: '@totemsdk/tx-builder',       desc: 'Transaction builder — coin selection, multisig, and WOTS signing',                            entryPoint: 'packages/totem-sdk/packages/tx-builder/src/index.ts' },
  { slug: 'totemsdk-kissvm',           name: '@totemsdk/kissvm',           desc: 'KISSVM script lexer, parser, AST, and evaluator',                                              entryPoint: 'packages/totem-sdk/packages/kissvm/src/index.ts' },
  { slug: 'totemsdk-statechain',       name: '@totemsdk/statechain',       desc: 'Mercury-protocol state chain — privacy-preserving off-chain UTXO custody transfer',           entryPoint: 'packages/totem-sdk/packages/statechain/src/index.ts' },
  { slug: 'totemsdk-se-server',        name: '@totemsdk/se-server',        desc: 'Self-hostable Statechain Entity server — blind co-signer for Mercury protocol',              entryPoint: 'packages/totem-sdk/packages/se-server/src/index.ts' },
  { slug: 'totemsdk-chain-provider',   name: '@totemsdk/chain-provider',   desc: 'Unified chain data provider — hosted, RPC, and P2P lookup backends',                          entryPoint: 'packages/totem-sdk/packages/chain-provider/src/index.ts' },
  { slug: 'totemsdk-realtime',         name: '@totemsdk/realtime',         desc: 'Real-time balance streaming with WebSocket and HTTP fallback',                                 entryPoint: 'packages/totem-sdk/packages/realtime/src/index.ts' },
  { slug: 'totemsdk-pear',             name: '@totemsdk/pear',             desc: 'Pear/Holepunch runtime integration — storage, networking, lifecycle',                         entryPoint: 'packages/totem-sdk/packages/pear/src/index.ts' },
  { slug: 'totemsdk-pureminima-rpc',   name: '@totemsdk/pureminima-rpc',   desc: 'Fetch-based PureMinima RPC client — Bare/Pear/Node/browser compatible',                      entryPoint: 'packages/totem-sdk/packages/pureminima-rpc/src/index.ts' },
  { slug: 'totemsdk-pubsub-transport', name: '@totemsdk/pubsub-transport', desc: 'Pub/sub transport interfaces — MQTT-compatible, transport-agnostic',                          entryPoint: 'packages/totem-sdk/packages/pubsub-transport/src/index.ts' },
  { slug: 'totemsdk-stream-transport', name: '@totemsdk/stream-transport', desc: 'Stream transport adapters — WebSocket, WebRTC, Hyperswarm, stdio',                           entryPoint: 'packages/totem-sdk/packages/stream-transport/src/index.ts' },
  { slug: 'totem-observability',       name: '@totemsdk/observability',    desc: 'Drop-in observability for Totem-based dApps — trace propagation and batched telemetry',       entryPoint: 'packages/observability/src/index.js' },
  { slug: 'totem-extension-keyring',   name: 'totem-extension/keyring',    desc: 'Totem Extension public keyring API — signing validator types and security boundary utilities', entryPoint: 'packages/totem-extension/src/keyring.ts' },
];

// ---------------------------------------------------------------------------
// Canonical page order
// ---------------------------------------------------------------------------
const SIDEBAR_PAGE_ORDER = [
  'concepts/agent-policy-overview',
  'concepts/wots-key-management',
  'concepts/omnia-channels',
  'concepts/omnia-vtxo',
  'concepts/relay-modes',
  'concepts/totem-connect',
  'guides/tessa-pay',
  'guides/totem-personal-node',
  'guides/kissvm-studio',
  'guides/statechain-pass',
  'guides/omnia-pocket',
  'guides/channel-factory-wallet',
  'guides/omnia-router-node',
  'guides/totem-community-node',
  'guides/machinepay-edge',
  'api/index',
  ...PACKAGES.map(p => `api/${p.slug}/index`),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build TypeDoc args for a single package markdown run. */
function typedocArgs(pkg) {
  const outDir = path.join(API_DIR, pkg.slug);
  const entryAbs = path.resolve(REPO_ROOT, pkg.entryPoint);
  const pkgTsconfig = path.join(path.dirname(path.dirname(entryAbs)), 'tsconfig.json');
  const tsconfig = fs.existsSync(pkgTsconfig) ? pkgTsconfig : TSCONFIG_FALLBACK;

  return {
    outDir,
    entryAbs,
    tsconfig,
    args: [
      'typedoc',
      '--plugin', 'typedoc-plugin-markdown',
      '--out', outDir,
      '--entryPoints', entryAbs,
      '--entryPointStrategy', 'resolve',
      '--tsconfig', tsconfig,
      '--name', pkg.name,
      '--skipErrorChecking',
      '--excludePrivate',
      '--excludeInternal',
      '--readme', 'none',
      '--githubPages', 'false',
      '--hideGenerator',
      '--entryFileName', 'index.md',
      '--disableSources',
    ],
  };
}

/** Fix YAML frontmatter: quote values containing @ or / (YAML special chars). */
function fixFrontmatter(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return; }
  if (!raw.startsWith('---')) return;
  const fmEnd = raw.indexOf('\n---', 3);
  if (fmEnd === -1) return;
  const fmRaw = raw.slice(0, fmEnd + 4);
  const body = raw.slice(fmEnd + 4);
  const fixed = fmRaw.replace(
    /^(title|sidebar_label|description):\s*(?!")(.+)/gm,
    (_, key, val) => {
      if (/[@/]/.test(val) || /^[{[\|>&*!,#?]/.test(val.trim())) {
        return `${key}: "${val.trim().replace(/"/g, '\\"')}"`;
      }
      return `${key}: ${val}`;
    }
  );
  if (fixed !== fmRaw) fs.writeFileSync(filePath, fixed + body);
}

function fixAllFrontmatter(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) fixAllFrontmatter(full);
    else if (entry.name.endsWith('.md')) fixFrontmatter(full);
  }
}

function countMdFiles(dir) {
  let n = 0;
  if (!fs.existsSync(dir)) return n;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countMdFiles(path.join(dir, e.name));
    else if (e.name.endsWith('.md')) n++;
  }
  return n;
}

/** Write a curated stub index.md (TypeDoc failed or entryPoint missing). */
function writeCuratedStub(pkg) {
  const dir = path.join(API_DIR, pkg.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.md'), `---
title: "${pkg.name}"
sidebar_label: "${pkg.name}"
description: "${pkg.desc}"
---

# \`${pkg.name}\`

> ${pkg.desc}

:::info Curated Reference
Full API reference for this package requires TypeDoc regeneration.
Run \`npm run generate\` from \`TotemEdgeSDKDocs/\` after installing deps.
:::

## Install

\`\`\`bash
npm install ${pkg.name}
\`\`\`

← [Back to Package Index](/api)
`);
}

/**
 * Extract exported symbols for docs-manifest by scanning generated .md file tree.
 * Groups files by their parent folder (classes, interfaces, functions, type-aliases,
 * variables, enumerations) — matches TypeDoc markdown plugin v4 output layout.
 */
function extractSymbolsFromFileTree(slug) {
  const dir = path.join(API_DIR, slug);
  if (!fs.existsSync(dir)) return [];
  const CATEGORIES = ['classes', 'interfaces', 'functions', 'type-aliases', 'variables', 'enumerations'];
  const symbols = [];
  for (const cat of CATEGORIES) {
    const catDir = path.join(dir, cat);
    if (!fs.existsSync(catDir)) continue;
    const kind = cat.replace(/-/g, '_').replace(/s$/, ''); // classes→class, type-aliases→type_alias
    for (const file of fs.readdirSync(catDir)) {
      if (file.endsWith('.md')) {
        symbols.push({ name: file.replace(/\.md$/, ''), kind });
      }
    }
  }
  return symbols;
}

// ---------------------------------------------------------------------------
// 1. Clear package subdirs
// ---------------------------------------------------------------------------
console.log('[generate] Clearing docs/api package subdirs...');
for (const pkg of PACKAGES) {
  const dir = path.join(API_DIR, pkg.slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}
for (const stale of ['@totemsdk', '@totem', 'README.md']) {
  const p = path.join(API_DIR, stale);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
console.log('[generate] Cleared.');

// ---------------------------------------------------------------------------
// 2. Run TypeDoc per-package in parallel batches (CONCURRENCY = 4)
// ---------------------------------------------------------------------------
const CONCURRENCY = 4;

console.log(`[generate] Running per-package TypeDoc (${PACKAGES.length} packages, concurrency=${CONCURRENCY})...`);

const typedocResults = {};  // slug → true (OK) | false (stub)

// Filter to packages with valid entryPoints
const pkgsToProcess = PACKAGES.filter(pkg => {
  const entryAbs = path.resolve(REPO_ROOT, pkg.entryPoint);
  if (!fs.existsSync(entryAbs)) {
    console.log(`[generate]   ${pkg.slug}: entryPoint not found → stub`);
    writeCuratedStub(pkg);
    typedocResults[pkg.slug] = false;
    return false;
  }
  return true;
});

// Process in parallel batches
for (let i = 0; i < pkgsToProcess.length; i += CONCURRENCY) {
  const batch = pkgsToProcess.slice(i, i + CONCURRENCY);
  const batchNames = batch.map(p => p.slug).join(', ');
  process.stdout.write(`[generate]   batch [${batchNames}] ... `);

  // Spawn all in batch in parallel using Promise + statically-imported spawn
  const results = await Promise.all(batch.map(pkg => new Promise(resolve => {
    const { outDir, args } = typedocArgs(pkg);
    fs.mkdirSync(outDir, { recursive: true });
    const proc = spawn('npx', args, { cwd: ROOT, stdio: 'pipe' });
    const timer = setTimeout(() => { try { proc.kill('SIGTERM'); } catch {} }, 28000);
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ pkg, success: code === 0 });
    });
    proc.on('error', () => { clearTimeout(timer); resolve({ pkg, success: false }); });
  })));

  const counts = results.map(r => {
    const ok = r.success && fs.existsSync(path.join(API_DIR, r.pkg.slug, 'index.md'));
    typedocResults[r.pkg.slug] = ok;
    if (ok) {
      // Ensure README.md → index.md if TypeDoc emitted README instead
      const readme = path.join(API_DIR, r.pkg.slug, 'README.md');
      if (fs.existsSync(readme) && !fs.existsSync(path.join(API_DIR, r.pkg.slug, 'index.md'))) {
        fs.renameSync(readme, path.join(API_DIR, r.pkg.slug, 'index.md'));
      }
      fixAllFrontmatter(path.join(API_DIR, r.pkg.slug));
      return countMdFiles(path.join(API_DIR, r.pkg.slug));
    } else {
      writeCuratedStub(r.pkg);
      return 'stub';
    }
  });
  console.log(counts.join(', '));
}

const succeededCount = Object.values(typedocResults).filter(Boolean).length;
console.log(`[generate] Per-package TypeDoc done: ${succeededCount}/${PACKAGES.length} with real docs.`);

// ---------------------------------------------------------------------------
// 3. Extract symbols from generated file tree
// ---------------------------------------------------------------------------
const symbolsByPackage = {};
for (const pkg of PACKAGES) {
  symbolsByPackage[pkg.slug] = extractSymbolsFromFileTree(pkg.slug);
}
const totalSymbols = Object.values(symbolsByPackage).reduce((s, a) => s + a.length, 0);
console.log(`[generate] Extracted ${totalSymbols} symbols from generated file tree.`);

// ---------------------------------------------------------------------------
// 4. Read all docs pages for llms.txt / llms-full.txt
// ---------------------------------------------------------------------------
function readPage(relPath) {
  const mdPath = path.join(DOCS_DIR, `${relPath}.md`);
  const mdxPath = path.join(DOCS_DIR, `${relPath}.mdx`);
  const filePath = fs.existsSync(mdPath) ? mdPath : fs.existsSync(mdxPath) ? mdxPath : null;
  if (!filePath) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = raw.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  const title = titleMatch ? titleMatch[1].trim() : relPath.split('/').pop();
  const description = descMatch ? descMatch[1].trim() : (() => {
    const m = raw.replace(/^---[\s\S]*?---/, '').match(/[A-Z][^.!?]{15,}[.!?]/);
    return m ? m[0].trim() : title;
  })();
  const body = raw.replace(/^---[\s\S]*?---\n/, '').trim();
  return { title, description, url: `${SITE_URL}/${relPath}`, relPath, body };
}

function collectAllPages(dir, base = '') {
  const pages = [];
  if (!fs.existsSync(dir)) return pages;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, e.name);
    if (e.isDirectory()) pages.push(...collectAllPages(path.join(dir, e.name), rel));
    else if (e.name.endsWith('.md') || e.name.endsWith('.mdx'))
      pages.push(rel.replace(/\\/g, '/').replace(/\.mdx?$/, ''));
  }
  return pages;
}

const allDocPaths = collectAllPages(DOCS_DIR);
const orderedPaths = [
  ...SIDEBAR_PAGE_ORDER,
  ...allDocPaths.filter(p => !SIDEBAR_PAGE_ORDER.includes(p)),
];
const allPages = orderedPaths.map(p => readPage(p)).filter(Boolean);
console.log(`[generate] Collected ${allPages.length} pages total.`);

// ---------------------------------------------------------------------------
// 5. static/llms.txt
// ---------------------------------------------------------------------------
fs.mkdirSync(STATIC_DIR, { recursive: true });
fs.writeFileSync(path.join(STATIC_DIR, 'llms.txt'), [
  '# Totem Edge SDK — Page Index',
  '# Generated by TotemEdgeSDKDocs/scripts/generate.mjs',
  `# Last updated: ${new Date().toISOString()}`,
  '#',
  '# Format: title | url | description',
  '',
  ...allPages.map(p => `${p.title} | ${p.url} | ${p.description}`),
].join('\n') + '\n');
console.log('[generate] Wrote static/llms.txt');

// ---------------------------------------------------------------------------
// 6. static/llms-full.txt
// ---------------------------------------------------------------------------
const parts = [
  '# Totem Edge SDK — Complete Knowledge Base',
  '# Generated by TotemEdgeSDKDocs/scripts/generate.mjs',
  `# Last updated: ${new Date().toISOString()}`,
  '',
];
for (const page of allPages) {
  parts.push(`## Page: ${page.title}`, `URL: ${page.url}`, '', page.body, '', '---', '');
}
fs.writeFileSync(path.join(STATIC_DIR, 'llms-full.txt'), parts.join('\n') + '\n');
console.log('[generate] Wrote static/llms-full.txt');

// ---------------------------------------------------------------------------
// 7. static/docs-manifest.json
// ---------------------------------------------------------------------------
fs.writeFileSync(
  path.join(STATIC_DIR, 'docs-manifest.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    packages: PACKAGES.map(pkg => ({
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.desc,
      apiReferenceUrl: `${SITE_URL}/api/${pkg.slug}/`,
      hasFullDocs: typedocResults[pkg.slug] === true,
      exports: symbolsByPackage[pkg.slug] || [],
    })),
    pages: allPages.map(p => ({ title: p.title, url: p.url, description: p.description })),
    totalPages: allPages.length,
  }, null, 2) + '\n'
);
console.log('[generate] Wrote static/docs-manifest.json');
console.log('[generate] Done.');

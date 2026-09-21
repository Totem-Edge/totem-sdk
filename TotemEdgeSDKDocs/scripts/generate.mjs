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
// Package inventory — MANIFEST-DERIVED (RFC website-reorg §2.3)
//
// Source of truth: SDK_MANIFEST.json (packages/domains) + the workspace gates
// config (maturity). The docs package index, sidebar order, TypeDoc runs and
// docs-manifest all derive from these files — no hand-maintained package list.
//
// Entry point rule: a manifest package resolves to `packages/<short>/src/index.ts`
// when that file exists; otherwise (Rust/WASM-only packages, today: core-wasm)
// it falls to the curated stub. The two extension surfaces (observability,
// totem-extension/keyring) are the only hand-authored entries, kept separate
// and explicitly flagged.
// ---------------------------------------------------------------------------
const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'SDK_MANIFEST.json'), 'utf8'));
const gatesConfig = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'workspace-gates.config.json'), 'utf8'));
  } catch {
    return { packages: {} };
  }
})();

const entryPointFor = (short) => {
  const candidate = path.join('packages', short, 'src', 'index.ts');
  return fs.existsSync(path.resolve(REPO_ROOT, candidate)) ? candidate : null;
};

const EXTENSIONS = [
  { slug: 'totem-observability',       name: '@totemsdk/observability',    desc: 'Drop-in observability for Totem-based dApps — trace propagation and batched telemetry',       entryPoint: 'extensions/observability/src/index.js' },
  { slug: 'totem-extension-keyring',   name: 'totem-extension/keyring',    desc: 'Totem Extension public keyring API — signing validator types and security boundary utilities', entryPoint: 'extensions/totem-extension/src/keyring.ts' },
];

const DOMAIN_LABELS = {
  'cryptographic-foundation': 'Cryptographic Foundation',
  'sovereignty-stack': 'Sovereignty Stack',
  'payment-network': 'Payment Network',
  'edge-computing': 'Edge Computing',
  'verifiable-claims': 'Verifiable Claims',
  'intelligence': 'Intelligence',
  'storage': 'Storage',
};

const PACKAGES = [
  ...manifest.packages.map((p) => {
    const short = p.name.replace(/^@totemsdk\//, '');
    const gate = gatesConfig.packages?.[`packages/${short}`] ?? {};
    return {
      slug: `totemsdk-${short}`,
      name: p.name,
      desc: p.description,
      maturity: gate.maturity ?? null,
      domain: p.domain ?? null,
      entryPoint: entryPointFor(short),
    };
  }),
  ...EXTENSIONS,
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
        return `${key}: ${JSON.stringify(val.trim())}`;
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
  const maturationLine = pkg.maturity ? `Maturity: \`${pkg.maturity}\`` : 'Maturity: not classified';
  fs.writeFileSync(path.join(dir, 'index.md'), `---
title: "${pkg.name}"
sidebar_label: "${pkg.name}"
description: "${pkg.desc}"
---

# \`${pkg.name}\`

> ${pkg.desc}

**${maturationLine}**

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
const currentSlugs = new Set(PACKAGES.map(p => p.slug));
if (fs.existsSync(API_DIR)) {
  for (const entry of fs.readdirSync(API_DIR, { withFileTypes: true })) {
    const dir = path.join(API_DIR, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === 'index.md') continue;
    // Remove every subdir not produced by the current manifest-derived set —
    // this is what drops stale packages (e.g. pureminima-rpc) automatically
    if (!currentSlugs.has(entry.name)) {
      console.log(`[generate]   removing stale api dir: ${entry.name}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
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
  if (pkg.entryPoint === null) {
    console.log(`[generate]   ${pkg.slug}: null entryPoint → stub`);
    writeCuratedStub(pkg);
    typedocResults[pkg.slug] = false;
    return false;
  }
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
// 2aa. Inject maturity line into real TypeDoc index pages (RFC §2.3 item 6)
//      Alpha/beta/rc/v1 from the gates config, mirrored here so the docs label
//      readiness exactly like the edge mirror — alpha is never promoted.
// ---------------------------------------------------------------------------
for (const pkg of PACKAGES) {
  if (!pkg.maturity || typedocResults[pkg.slug] !== true) continue;
  const idx = path.join(API_DIR, pkg.slug, 'index.md');
  if (!fs.existsSync(idx)) continue;
  const before = fs.readFileSync(idx, 'utf8');
  if (before.includes('**Maturity:**')) continue;
  const inject = `**Maturity: ${pkg.maturity}**\n\n`;
  const bodyStart = before.indexOf('\n# ');
  const after = bodyStart === -1 ? before : before.slice(0, bodyStart) + '\n' + inject + before.slice(bodyStart + 1);
  fs.writeFileSync(idx, after);
}
console.log('[generate] Injected maturity into TypeDoc index pages.');

// ---------------------------------------------------------------------------
// 2b. Write package index page (docs/api/index.md)
//     Referenced explicitly by sidebars.ts as the "Package Index" doc, so it
//     must be regenerated on every run or the Docusaurus build fails.
// ---------------------------------------------------------------------------
fs.writeFileSync(
  path.join(API_DIR, 'index.md'),
  [
    '---',
    'title: API Reference',
    'sidebar_label: Package Index',
    'description: "Auto-generated API reference for all @totemsdk/* packages."',
    '---',
    '',
    '# API Reference',
    '',
    'Auto-generated from TypeScript sources via TypeDoc. Run `npm run generate` from `TotemEdgeSDKDocs/` to regenerate.',
    '',
    '| Package | Description | Maturity |',
    '|---------|-------------|----------|',
    ...PACKAGES.map(pkg => `| [\`${pkg.name}\`](${pkg.slug}/index.md) | ${pkg.desc} | ${pkg.maturity ?? '—'} |`),
    '',
  ].join('\n')
);
console.log('[generate] Wrote docs/api/index.md');

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
      domain: pkg.domain,
      maturity: pkg.maturity,
      apiReferenceUrl: `${SITE_URL}/api/${pkg.slug}/`,
      hasFullDocs: typedocResults[pkg.slug] === true,
      exports: symbolsByPackage[pkg.slug] || [],
    })),
    pages: allPages.map(p => ({ title: p.title, url: p.url, description: p.description })),
    totalPages: allPages.length,
  }, null, 2) + '\n'
);
console.log('[generate] Wrote static/docs-manifest.json');

// ---------------------------------------------------------------------------
// 8. static/package-catalog.json — manifest-derived sidebar grouping
//    Consumed by sidebars.ts (RFC website-reorg §2.3 item 4) so the API sidebar
//    mirrors the seven-domain taxonomy instead of a hand-typed category list.
// ---------------------------------------------------------------------------
const catalogDomains = manifest.domains && typeof manifest.domains === 'object'
  ? Object.entries(manifest.domains).map(([id]) => {
      const pkgs = PACKAGES.filter(p => p.domain === id && !p.name.includes('@totemsdk/observability') && !p.name.includes('keyring'));
      return { id, label: DOMAIN_LABELS[id] ?? id, packages: pkgs.map(p => ({ slug: p.slug, name: p.name, maturity: p.maturity })) };
    })
  : [];

fs.writeFileSync(
  path.join(STATIC_DIR, 'package-catalog.json'),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    domains: catalogDomains,
    extensions: EXTENSIONS.map(p => ({ slug: p.slug, name: p.name, desc: p.desc })),
  }, null, 2) + '\n'
);
console.log('[generate] Wrote static/package-catalog.json');
console.log('[generate] Done.');

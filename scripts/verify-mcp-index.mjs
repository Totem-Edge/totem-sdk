#!/usr/bin/env node
/**
 * MCP catalog parity gate.
 *
 * Guarantees the `@totemsdk/mcp-server` index is complete and correctly
 * classified, so AI clients always see the current package set and docs:
 *
 *   1. publishable filesystem packages == SDK_MANIFEST packages == MCP index packages
 *   2. every indexed package has a domain declared in SDK_MANIFEST.domains (never 'other')
 *   3. every indexed package exposes at least one symbol (except allow-listed binary packages)
 *   4. global symbol floor (regression tripwire)
 *   5. every docs/rfc/RFC-*.md and docs/audits/*.md is discoverable as a resource
 *
 * Requires the mcp-server to be built (dist/ present) — run after
 * `verify-workspace --typecheck`.
 *
 * Usage: node scripts/verify-mcp-index.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const require = createRequire(import.meta.url)

const SYMBOL_FLOOR = 2500
const NO_EXPORT_ALLOWLIST = new Set(['@totemsdk/core-wasm'])

const errors = []
const fail = (m) => errors.push(m)

// ── inputs ───────────────────────────────────────────────────────────────────
const config = JSON.parse(readFileSync(join(__dirname, 'workspace-gates.config.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(ROOT, 'SDK_MANIFEST.json'), 'utf8'))

const publishable = new Set()
for (const [dir, meta] of Object.entries(config.packages)) {
  if (meta.status !== 'publishable') continue
  const pj = join(ROOT, dir, 'package.json')
  if (!existsSync(pj)) continue
  const pkg = JSON.parse(readFileSync(pj, 'utf8'))
  if (pkg.name) publishable.add(pkg.name)
}

const manifestNames = new Set(manifest.packages.map((p) => p.name))
const declaredDomains = new Set(Object.keys(manifest.domains ?? {}))

// ── MCP dist ─────────────────────────────────────────────────────────────────
const distDir = join(ROOT, 'packages', 'mcp-server', 'dist')
if (!existsSync(join(distDir, 'indexer.js')) || !existsSync(join(distDir, 'resources.js'))) {
  console.error('✗ @totemsdk/mcp-server is not built (dist/ missing). Run verify-workspace --typecheck first.')
  process.exit(1)
}
const { buildIndex } = require(join(distDir, 'indexer.js'))
const { listResources } = require(join(distDir, 'resources.js'))
const index = buildIndex()

// ── 1. set parity ────────────────────────────────────────────────────────────
const indexNames = new Set(Object.keys(index.packages))
for (const name of manifestNames) {
  if (!indexNames.has(name)) fail(`MCP index is missing manifest package ${name}`)
}
for (const name of indexNames) {
  if (!manifestNames.has(name)) fail(`MCP index contains non-manifest package ${name}`)
}
for (const name of publishable) {
  if (!manifestNames.has(name)) fail(`publishable package ${name} is missing from SDK_MANIFEST.json`)
}
for (const name of manifestNames) {
  if (!publishable.has(name)) fail(`manifest package ${name} is not classified publishable`)
}

// ── 2 + 3. domain + exports per package ──────────────────────────────────────
for (const [name, pkg] of Object.entries(index.packages)) {
  if (pkg.domain === 'other') {
    fail(`${name}: domain is 'other' (missing/invalid manifest domain)`)
  } else if (!declaredDomains.has(pkg.domain)) {
    fail(`${name}: domain '${pkg.domain}' is not declared in SDK_MANIFEST.domains`)
  }
  const e = pkg.exports
  const total = e.functions.length + e.types.length + e.classes.length + e.interfaces.length + e.consts.length
  if (total === 0 && !NO_EXPORT_ALLOWLIST.has(name)) {
    fail(`${name}: exposes no symbols (index/barrel resolution regression?)`)
  }
}

// ── 4. symbol floor ──────────────────────────────────────────────────────────
const symbolCount = Object.keys(index.symbolIndex).length
if (symbolCount < SYMBOL_FLOOR) {
  fail(`symbol count ${symbolCount} is below the floor (${SYMBOL_FLOOR})`)
}

// ── 5. docs parity (auto-discovery) ──────────────────────────────────────────
const resourceUris = new Set(listResources(index).map((r) => r.uri))
const expectedDocUris = []
const rfcDir = join(ROOT, 'docs', 'rfc')
if (existsSync(rfcDir)) {
  for (const f of readdirSync(rfcDir)) {
    const m = f.match(/^RFC-(\d+)-(.+)\.md$/)
    if (m) expectedDocUris.push(`totemsdk://rfc/${m[1]}`)
  }
}
const auditDir = join(ROOT, 'docs', 'audits')
if (existsSync(auditDir)) {
  for (const f of readdirSync(auditDir)) {
    if (!f.endsWith('.md')) continue
    const slug = f.replace(/\.md$/, '').replace(/-\d{4}-\d{2}$/, '')
    expectedDocUris.push(`totemsdk://audit/${slug}`)
  }
}
for (const uri of expectedDocUris) {
  if (!resourceUris.has(uri)) fail(`doc resource ${uri} is not exposed by the MCP server`)
}

// ── report ───────────────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error(`✗ MCP catalog parity gate: ${errors.length} issue(s)`)
  for (const m of errors) console.error(`  - ${m}`)
  process.exit(1)
}
console.log(
  `MCP catalog parity gate: ${indexNames.size} packages, ${Object.keys(index.domainMap).length} domains, ` +
  `${symbolCount} symbols, ${expectedDocUris.length} docs — all in sync`,
)

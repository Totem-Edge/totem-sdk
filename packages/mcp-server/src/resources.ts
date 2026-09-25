import type { SdkIndex } from './types.js'
import { getAllTemplates } from './template-catalog.js'
import * as fs from 'fs'
import * as path from 'path'

function findRepoRoot(): string {
  let dir = path.resolve(__dirname)
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = path.dirname(dir)
  }
  return dir
}

const REPO_ROOT = findRepoRoot()

const PAPERS: Array<{ uri: string; name: string; description: string; file: string }> = [
  {
    uri: 'totemsdk://papers/yellow',
    name: 'Core Yellow Paper',
    description: 'WOTS+ signatures, TreeKey hierarchy, MMR proofs, byte-exact serialization, lease/watermark coordination, Rust/WASM engine',
    file: 'TOTEM_CORE_YELLOW_PAPER.md',
  },
  {
    uri: 'totemsdk://papers/red',
    name: 'Connect Red Paper',
    description: 'dApp-wallet wire protocol specification — every method, parameter, response shape, error code and the security model',
    file: 'TOTEM_CONNECT_RED_PAPER.md',
  },
  {
    uri: 'totemsdk://papers/blue',
    name: 'Omnia Blue Paper',
    description: 'P2P payment channels, eltoo state machine, multi-hop routing, channel factories, VTXO accounting, statechain prepaid passes, lending/borrowing, off-chain tokens, privacy by design, scaling to billions of devices',
    file: 'TOTEM_OMNIA_BLUE_PAPER.md',
  },
  {
    uri: 'totemsdk://papers/green',
    name: 'Governance Green Paper',
    description: 'Authority mandates, delegation chains, recursive MAST 7-layer policy trees, quadratic voting, liquid democracy, QVAC agent policy, modular governance patterns',
    file: 'TOTEM_GOVERNANCE_GREEN_PAPER.md',
  },
  {
    uri: 'totemsdk://papers/grey',
    name: 'Edge Grey Paper',
    description: 'Port-injected transport-agnostic edge runtime, 11 protocol adapters, MachinePay credit gating, offline operation, industrial action, sensor-to-settlement bridge',
    file: 'TOTEM_EDGE_GREY_PAPER.md',
  },
  {
    uri: 'totemsdk://papers/gold',
    name: 'Network Economics Gold Paper',
    description: 'Progressive decentralisation; MINIMA as settlement/native collateral where appropriate; $TOTEM as a potential network coordination and service-assurance asset (provider bonding, DAO stewardship, community-heavy genesis); no token assumed — network must earn the right to need one',
    file: 'TOTEM_NETWORK_ECONOMICS_GOLD_PAPER.md',
  },
]

/** Derive a name/description for a doc from its first heading + first paragraph. */
function docMeta(file: string, fallbackName: string): { name: string; description: string } {
  const content = readRepoFile(file) ?? ''
  const lines = content.split('\n')
  const titleIdx = lines.findIndex(l => l.startsWith('# '))
  const name = titleIdx >= 0 ? lines[titleIdx].replace(/^#\s+/, '').trim() : fallbackName
  let description = ''
  for (let i = titleIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (!t || t.startsWith('#') || t.startsWith('**Status') || t.startsWith('---') || t.startsWith('>')) continue
    description = t.replace(/[*_`]/g, '').trim()
    break
  }
  return { name: name || fallbackName, description: description || name || fallbackName }
}

/**
 * RFCs and audits are discovered from disk, so a new `docs/rfc/RFC-*.md` or
 * `docs/audits/*.md` is exposed automatically — there is no hand-maintained
 * list to forget.
 */
function discoverDocs(): Array<{ uri: string; name: string; description: string; file: string }> {
  const docs: Array<{ uri: string; name: string; description: string; file: string }> = []

  const rfcDir = path.join(REPO_ROOT, 'docs', 'rfc')
  if (fs.existsSync(rfcDir)) {
    for (const f of fs.readdirSync(rfcDir).sort()) {
      const m = f.match(/^RFC-(\d+)-(.+)\.md$/)
      if (!m) continue
      const file = path.join('docs', 'rfc', f)
      const meta = docMeta(file, `RFC-${m[1]}`)
      docs.push({ uri: `totemsdk://rfc/${m[1]}`, ...meta, file })
    }
  }

  const auditDir = path.join(REPO_ROOT, 'docs', 'audits')
  if (fs.existsSync(auditDir)) {
    for (const f of fs.readdirSync(auditDir).sort()) {
      if (!f.endsWith('.md')) continue
      const base = f.replace(/\.md$/, '')
      const slug = base.replace(/-\d{4}-\d{2}$/, '')
      const file = path.join('docs', 'audits', f)
      const meta = docMeta(file, base)
      docs.push({ uri: `totemsdk://audit/${slug}`, ...meta, file })
    }
  }

  return docs
}

const DOCS = discoverDocs()

/** Generated structured catalogs (parsed from source, not stored). */
const CATALOGS: Array<{ uri: string; name: string; description: string }> = [
  { uri: 'totemsdk://connect/methods', name: 'Connect Methods', description: 'The dApp-wallet wire protocol method catalog (@totemsdk/connect)' },
  { uri: 'totemsdk://edge/capabilities', name: 'Edge Capabilities', description: 'Canonical EdgeCapability strings (@totemsdk/edge)' },
  { uri: 'totemsdk://rfc', name: 'RFC Index', description: 'Index of SDK RFCs' },
]

function readRepoFile(rel: string): string | null {
  const p = path.join(REPO_ROOT, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Extract a markdown section by heading slug/text (for `totemsdk://rfc/014#6-design`). */
export function extractSection(markdown: string, anchor: string): string | null {
  const lines = markdown.split('\n')
  const decoded = anchor.replace(/%20/g, ' ').toLowerCase()
  let start = -1
  let level = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/)
    if (!m) continue
    const text = m[2].trim()
    if (slugify(text) === slugify(anchor) || text.toLowerCase().includes(decoded)) {
      start = i
      level = m[1].length
      break
    }
  }
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/)
    if (m && m[1].length <= level) { end = i; break }
  }
  return lines.slice(start, end).join('\n').trim()
}

function connectMethods(): string[] {
  const src = readRepoFile(path.join('packages', 'connect', 'src', 'index.ts'))
  if (!src) return []
  return [...new Set([...src.matchAll(/method:\s*'([A-Za-z_]+)'/g)].map(m => m[1]))].sort()
}

function edgeCapabilities(): string[] {
  const src = readRepoFile(path.join('packages', 'edge', 'src', 'capabilities.ts'))
  if (!src) return []
  return [...new Set([...src.matchAll(/'([a-z][a-z0-9-]*:[a-z0-9-]+)'/g)].map(m => m[1]))].sort()
}

/** MIME type for a resource URI. */
export function resourceMimeType(uri: string): string {
  const base = uri.split('#')[0]
  if (base === 'totemsdk://conventions' || base === 'totemsdk://templates') return 'text/markdown'
  if (/^totemsdk:\/\/(papers|rfc|audit)\/[^/]+$/.test(base)) return 'text/markdown'
  if (base === 'totemsdk://packages' || base === 'totemsdk://domain-map' || base === 'totemsdk://rfc') return 'application/json'
  if (/^totemsdk:\/\/(packages|symbol|connect|edge)(\/|$)/.test(base)) return 'application/json'
  return 'text/plain'
}

const CONVENTIONS = `# Totem SDK Conventions

## Package Structure
- src/index.ts - barrel exports
- src/types.ts - all type definitions
- src/canonical.ts - canonicalJson, toHex, hashCanonical
- src/ids.ts - ID computation (domain-prefixed SHA3-256)
- src/errors.ts - error class hierarchy
- src/__tests__/ - Jest tests

## ID Format
- totem:<package>:<kind>:<sha3-256-hex>
- Example: totem:ia:proposal:<hex>, totem:gov:proposal:<hex>, edge:device:<hex>

## Canonical JSON
- Recursive deterministic JSON with sorted object keys
- Used as input to all hashing and signing operations
- Shared: import { canonicalJson, hashCanonical, toHex, sha3_256 } from '@totemsdk/core'

## Hashing
- SHA3-256 via @totemsdk/core
- Domain-separated: hashCanonical('<DOMAIN>_V1', data) == sha3-256(domain + canonicalJson(data))
- Domain constants like 'TOTEM_GOVERNANCE_PROPOSAL_V1'

## Signing
- WOTS (Winternitz One-Time Signatures) via @totemsdk/core-wasm WASM
- @totemsdk/wots-lease for key-use coordination

## Error Handling
- Hierarchical Error subclasses with code strings
- EdgeOperationResult<T> = { ok: boolean, data?: T, error?: string, errorCode?: string }

## Time
- Unix milliseconds (Date.now())
- Optional now parameter for determinism in testing

## Validation
- Custom guard functions returning string[]
- No external schema libraries (no zod/io-ts/ajv)

## Async
- Promise<T> everywhere, typed event emitters, no Observables
- Action lifecycle: propose -> reserve -> execute -> confirm/fail/unknown`

export function handleResourceRead(uri: string, index: SdkIndex): string | null {
  if (uri === 'totemsdk://connect/methods') return JSON.stringify(connectMethods(), null, 2)
  if (uri === 'totemsdk://edge/capabilities') return JSON.stringify(edgeCapabilities(), null, 2)
  if (uri === 'totemsdk://rfc') {
    return JSON.stringify(
      DOCS.filter(d => d.uri.startsWith('totemsdk://rfc/')).map(d => ({ uri: d.uri, name: d.name, description: d.description })),
      null,
      2,
    )
  }

  const base = uri.split('#')[0]
  const readable = [...PAPERS, ...DOCS].find(d => d.uri === base)
  if (readable) {
    const filePath = path.join(REPO_ROOT, readable.file)
    if (!fs.existsSync(filePath)) return `Document not found: ${readable.file}`
    const content = fs.readFileSync(filePath, 'utf-8')
    const hash = uri.indexOf('#')
    if (hash >= 0) {
      const section = extractSection(content, uri.slice(hash + 1))
      return section ?? `Section not found: ${uri.slice(hash + 1)}`
    }
    return content
  }

  if (uri === 'totemsdk://packages') {
    return JSON.stringify(Object.values(index.packages).map(p => ({
      name: p.name,
      version: p.version,
      domain: p.domain,
      description: p.description,
      hasRust: p.hasRust,
      hasGo: p.hasGo,
      hasTests: p.hasTests,
    })), null, 2)
  }

  if (uri === 'totemsdk://conventions') return CONVENTIONS

  if (uri === 'totemsdk://templates') {
    const all = getAllTemplates()
    return all.map(t => {
      const pkgs = Array.isArray(t.package) ? t.package : t.package ? [t.package] : []
      return {
        template: t.template,
        functions: t.functions,
        configTypes: t.configTypes,
        package: pkgs.length > 0 ? pkgs.map(p => `@totemsdk/${p}`) : ['@totemsdk/kissvm'],
        description: t.description,
      }
    }).map(t => `## ${t.template}\n\n${t.description}\n\n**Package:** ${t.package.join(', ')}\n\n**Functions:**\n${t.functions.map(f => `  - \`import { ${f} } from '@totemsdk/kissvm'\``).join('\n')}\n`).join('\n---\n')
  }

  if (uri === 'totemsdk://domain-map') {
    return JSON.stringify(index.domainMap, null, 2)
  }

  const pkgMatch = uri.match(/^totemsdk:\/\/packages\/([^/]+)$/)
  if (pkgMatch) {
    const pkg = index.packages[pkgMatch[1]]
    return pkg ? JSON.stringify(pkg, null, 2) : null
  }

  const pkgExportsMatch = uri.match(/^totemsdk:\/\/packages\/([^/]+)\/exports$/)
  if (pkgExportsMatch) {
    const pkg = index.packages[pkgExportsMatch[1]]
    return pkg ? JSON.stringify(pkg.exports, null, 2) : null
  }

  const pkgDepsMatch = uri.match(/^totemsdk:\/\/packages\/([^/]+)\/dependencies$/)
  if (pkgDepsMatch) {
    const pkg = index.packages[pkgDepsMatch[1]]
    if (!pkg) return null
    return JSON.stringify({ dependencies: pkg.dependencies, devDependencies: pkg.devDependencies }, null, 2)
  }

  const domainMatch = uri.match(/^totemsdk:\/\/packages\/by-domain\/(.+)$/)
  if (domainMatch) {
    const pkgs = index.domainMap[domainMatch[1]]
    return pkgs ? JSON.stringify(pkgs.map(n => index.packages[n]).filter(Boolean), null, 2) : null
  }

  const symbolMatch = uri.match(/^totemsdk:\/\/symbol\/(.+)$/)
  if (symbolMatch) {
    const entries = index.symbolIndex[symbolMatch[1]]
    return entries ? JSON.stringify(entries, null, 2) : null
  }

  return null
}

export function listResources(index: SdkIndex): Array<{ uri: string; name: string; description: string }> {
  const resources: Array<{ uri: string; name: string; description: string }> = [
    { uri: 'totemsdk://packages', name: 'All Packages', description: `List of all ${Object.keys(index.packages).length} SDK packages with metadata` },
    { uri: 'totemsdk://templates', name: 'All KISSVM Templates', description: `All ${getAllTemplates().length} KISSVM script templates with import paths and descriptions` },
    { uri: 'totemsdk://conventions', name: 'Coding Conventions', description: 'Totem SDK coding conventions and patterns' },
    { uri: 'totemsdk://domain-map', name: 'Domain Map', description: 'Packages grouped by domain layer' },
    ...PAPERS.map(p => ({ uri: p.uri, name: p.name, description: p.description })),
    ...DOCS.map(d => ({ uri: d.uri, name: d.name, description: d.description })),
    ...CATALOGS,
  ]

  for (const [domain, pkgs] of Object.entries(index.domainMap)) {
    resources.push({
      uri: `totemsdk://packages/by-domain/${domain}`,
      name: `Domain: ${domain}`,
      description: `${pkgs.length} packages in ${domain}`,
    })
  }

  for (const [name, pkg] of Object.entries(index.packages)) {
    resources.push({
      uri: `totemsdk://packages/${encodeURIComponent(name)}`,
      name: `Package: ${name}`,
      description: pkg.description,
    })
    resources.push({
      uri: `totemsdk://packages/${encodeURIComponent(name)}/exports`,
      name: `Exports: ${name}`,
      description: `Exported symbols from ${name}`,
    })
    resources.push({
      uri: `totemsdk://packages/${encodeURIComponent(name)}/dependencies`,
      name: `Dependencies: ${name}`,
      description: `Dependencies of ${name}`,
    })
  }

  const topSymbols = Object.entries(index.symbolIndex)
    .filter(([_, v]) => v.length <= 3)
    .slice(0, 200)
  for (const [symbol, entries] of topSymbols) {
    resources.push({
      uri: `totemsdk://symbol/${symbol}`,
      name: `Symbol: ${symbol}`,
      description: `Found in ${entries.map(e => e.package).join(', ')}`,
    })
  }

  return resources
}

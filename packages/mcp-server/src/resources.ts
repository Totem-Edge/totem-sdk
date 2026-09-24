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

/** RFCs and audits that AI agents should be able to read. */
const DOCS: Array<{ uri: string; name: string; description: string; file: string }> = [
  { uri: 'totemsdk://rfc/008', name: 'RFC-008 Federated Statechain', description: 'Leased-WOTS SE identity, federation, threshold SE, registry', file: 'docs/rfc/RFC-008-FEDERATED-STATECHAIN.md' },
  { uri: 'totemsdk://rfc/009', name: 'RFC-009 KISSVM Signature Fidelity', description: 'Minima-faithful TreeKey SignatureProof verification', file: 'docs/rfc/RFC-009-KISSVM-SIGNATURE-FIDELITY.md' },
  { uri: 'totemsdk://rfc/010', name: 'RFC-010 Industrial Action RC', description: 'Industrial action on the governed edge runtime', file: 'docs/rfc/RFC-010-INDUSTRIAL-ACTION-RC.md' },
  { uri: 'totemsdk://rfc/011', name: 'RFC-011 Industrial Action Domain Model', description: 'Units, resources, interlocks, composition, vertical profiles', file: 'docs/rfc/RFC-011-INDUSTRIAL-ACTION-DOMAIN-MODEL.md' },
  { uri: 'totemsdk://rfc/012', name: 'RFC-012 Decision Runtime', description: 'Bounded semantic choice as a first-class Edge service', file: 'docs/rfc/RFC-012-DECISION-RUNTIME.md' },
  { uri: 'totemsdk://rfc/013', name: 'RFC-013 Wallet Self-Hosted Mode', description: 'Axia-relay default, chain-provider opt-out, wallet-side WOTS lease', file: 'docs/rfc/RFC-013-WALLET-SELF-HOSTED-MODE.md' },
  { uri: 'totemsdk://rfc/014', name: 'RFC-014 Wallet Connect Parity', description: 'Shared execution bridge, Edge-routed families, capability manifest', file: 'docs/rfc/RFC-014-WALLET-CONNECT-PARITY.md' },
  { uri: 'totemsdk://rfc/015', name: 'RFC-015 Axia API Alignment', description: 'Wallet capability, SE registry, lease, status, metering', file: 'docs/rfc/RFC-015-AXIA-API-ALIGNMENT.md' },
  { uri: 'totemsdk://audit/wallet-connect-parity', name: 'Wallet ⇄ connect parity audit', description: 'Extension vs PWA coverage of connect methods; task list T1–T5', file: 'docs/audits/wallet-connect-parity-2026-09.md' },
]

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
- Each package has its own canonicalJson() (no shared util)

## Hashing
- SHA3-256 via @totemsdk/core
- Domain-prefixed: sha3-256(domain + canonicalJson(data))
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
  const readable = [...PAPERS, ...DOCS].find(d => d.uri === uri)
  if (readable) {
    const filePath = path.join(REPO_ROOT, readable.file)
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : `Document not found: ${readable.file}`
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

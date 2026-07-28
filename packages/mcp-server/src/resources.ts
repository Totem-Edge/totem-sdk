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
    description: 'dApp-wallet wire protocol specification — all 49 methods, every parameter, every response shape, error codes, security model',
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
    name: 'Tokenomics Gold Paper',
    description: 'Two-asset model — MINIMA as sovereign collateral backbone (Colour Coins, The Burn, Provider Bonds), TOTEM as service revenue token (staking, fee distribution, slashing, treasury)',
    file: 'TOTEM_TOKENOMICS_GOLD_PAPER.md',
  },
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
  const paperMatch = uri.match(/^totemsdk:\/\/papers\/(\w+)$/)
  if (paperMatch) {
    const paper = PAPERS.find(p => p.uri === uri)
    if (paper) {
      const filePath = path.join(REPO_ROOT, paper.file)
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8')
      }
      return `Paper file not found: ${paper.file}`
    }
    return null
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
    { uri: 'totemsdk://packages', name: 'All Packages', description: 'List of all 53 SDK packages with metadata' },
    { uri: 'totemsdk://templates', name: 'All KISSVM Templates', description: 'All 45 KISSVM script templates with import paths and descriptions' },
    { uri: 'totemsdk://conventions', name: 'Coding Conventions', description: 'Totem SDK coding conventions and patterns' },
    { uri: 'totemsdk://domain-map', name: 'Domain Map', description: 'Packages grouped by domain layer' },
    ...PAPERS.map(p => ({ uri: p.uri, name: p.name, description: p.description })),
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

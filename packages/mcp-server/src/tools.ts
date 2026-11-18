import type { DependencyEdge, DependencyKind, SdkIndex, ToolDefinition, ToolResponse, ValidImportResult, ScaffoldResult } from './types.js'
import { searchTemplates, getTemplatesForPackage } from './template-catalog.js'
import { readSourceFile } from './indexer.js'
import { refreshIndex } from './index-store.js'
import { planComposition, scaffoldApp } from './composition.js'
import { inspectContract } from './contracts.js'

/**
 * The single source of truth for the MCP tool catalog. `index.ts` advertises
 * these and `handleToolCall` dispatches them; the `mcp.test.ts` drift guard
 * asserts the two never diverge.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { name: 'search-symbol', description: 'Search for a symbol (function, type, class) across all packages', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Partial symbol name to search' } }, required: ['query'] } },
  { name: 'find-type', description: 'Find type definitions (interfaces, classes, type aliases) matching a pattern', inputSchema: { type: 'object', properties: { pattern: { type: 'string', description: 'Type name pattern to search' } }, required: ['pattern'] } },
  { name: 'dependency-graph', description: 'Get dependency graph for a package — inbound dependents, outbound dependencies, typed edge kinds/ranges, cycles and SCCs', inputSchema: { type: 'object', properties: { package: { type: 'string', description: 'Package name (e.g. @totemsdk/edge-opcua)' }, direction: { type: 'string', enum: ['in', 'out', 'all'], description: 'Dependency direction' }, format: { type: 'string', enum: ['text', 'json'], description: 'Output format (default text)' } }, required: ['package'] } },
  { name: 'validate-import', description: 'Check whether a cross-package import is valid, including dependency kind, export subpath and condition', inputSchema: { type: 'object', properties: { from: { type: 'string', description: 'Source package name' }, to: { type: 'string', description: 'Target package name' }, symbol: { type: 'string', description: 'Optional: specific symbol to check' }, subpath: { type: 'string', description: 'Optional export subpath (e.g. ./artifacts)' }, condition: { type: 'string', description: 'Optional runtime condition (e.g. import, require, types)' } }, required: ['from', 'to'] } },
  { name: 'scaffold-adapter', description: 'Generate boilerplate for a new edge protocol adapter', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Package name suffix' }, protocol: { type: 'string', description: 'Protocol name (PascalCase)' }, commands: { type: 'array', items: { type: 'string' }, description: 'Transport port methods' } }, required: ['name', 'protocol'] } },
  { name: 'scaffold-package', description: 'Generate boilerplate for a new @totemsdk package', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Package name (without @totemsdk/ prefix)' }, deps: { type: 'array', items: { type: 'string' }, description: 'Dependency package names' } }, required: ['name'] } },
  { name: 'package-stats', description: 'Get statistics about a package — export counts, Rust/Go, tests, deps', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Package name' } }, required: ['name'] } },
  { name: 'list-exports', description: 'List exports of a package', inputSchema: { type: 'object', properties: { package: { type: 'string', description: 'Package name' }, kind: { type: 'string', enum: ['function', 'type', 'interface', 'class', 'const', ''], description: 'Filter by export kind' }, filter: { type: 'string', description: 'Filter by name substring' } }, required: ['package'] } },
  { name: 'suggest-template', description: 'Suggest KISSVM script templates matching a use case — describes what you want to do and returns matching templates with import paths', inputSchema: { type: 'object', properties: { usecase: { type: 'string', description: 'Describe what you want to do (e.g. "time-lock funds until a block height", "vote tally with quorum", "identity verification")' } }, required: ['usecase'] } },
  { name: 'read-source', description: "Read a source file from a package's src/ directory (e.g. package '@totemsdk/core', path 'treekey.ts')", inputSchema: { type: 'object', properties: { package: { type: 'string', description: 'Package name (e.g. @totemsdk/core)' }, path: { type: 'string', description: 'Path relative to the package src/ directory' } }, required: ['package', 'path'] } },
  { name: 'list-packages', description: 'List SDK packages, optionally filtered by domain or text', inputSchema: { type: 'object', properties: { domain: { type: 'string', description: 'Optional domain filter. Matched case-insensitively and partially, so "edge" resolves to "edge-computing"; several may be comma-separated. See totemsdk://domain-map for the known domains.' }, filter: { type: 'string', description: 'Optional substring filter across package name, domain and keywords' } } } },
  { name: 'search-packages', description: 'Search packages by keyword across name, description, keywords and exports (e.g. "wots lease coordination")', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Free-text query' }, domain: { type: 'string', description: 'Optional domain filter. Matched case-insensitively and partially, so "edge" resolves to "edge-computing".' }, limit: { type: 'number', description: 'Max results (default 15)' } }, required: ['query'] } },
  { name: 'inspect-contract', description: 'Inspect bounded package contract metadata by package, export subpath and symbol', inputSchema: { type: 'object', properties: { package: { type: 'string' }, subpath: { type: 'string', description: 'Export subpath, default "."' }, symbol: { type: 'string', description: 'Exact symbol name' }, offset: { type: 'number' }, limit: { type: 'number', description: 'Max 100' }, includeDocs: { type: 'boolean' } }, required: ['package'] } },
  { name: 'plan-composition', description: 'Plan a justified SDK composition across the full catalogue, with per-package dispositions, dependency closure, capability map, maturity and warnings', inputSchema: { type: 'object', properties: { brief: { type: 'string' }, runtime: { type: 'string', enum: ['node-cjs', 'node-esm', 'bare', 'browser', 'unknown'] }, requiredPackages: { type: 'array', items: { type: 'string' } }, suggestedPackages: { type: 'array', items: { type: 'string' } }, optionalPackages: { type: 'array', items: { type: 'string' } }, excludedPackages: { type: 'array', items: { type: 'string' } }, requiredCapabilities: { type: 'array', items: { type: 'string' } } } } },
  { name: 'scaffold-app', description: 'Generate a structured application file map from a composition plan (generator only; no writes or installs)', inputSchema: { type: 'object', properties: { appName: { type: 'string' }, runtime: { type: 'string', enum: ['node-cjs', 'node-esm'] }, plan: { type: 'object' } }, required: ['plan'] } },
  { name: 'refresh-index', description: 'Rebuild the SDK index from the filesystem (development convenience) and report counts', inputSchema: { type: 'object', properties: {} } },
]

export function handleToolCall(name: string, args: any, index: SdkIndex): ToolResponse {
  switch (name) {
    case 'search-symbol': return searchSymbol(args, index)
    case 'find-type': return findType(args, index)
    case 'dependency-graph': return dependencyGraph(args, index)
    case 'validate-import': return validateImport(args, index)
    case 'scaffold-adapter': return scaffoldAdapter(args)
    case 'scaffold-package': return scaffoldPackage(args)
    case 'package-stats': return packageStats(args, index)
    case 'list-exports': return listExports(args, index)
    case 'suggest-template': return suggestTemplate(args)
    case 'read-source': return readSource(args, index)
    case 'list-packages': return listPackages(args, index)
    case 'search-packages': return searchPackages(args, index)
    case 'inspect-contract': {
      const resolved = resolvePackageName(args.package, index)
      if (args.package && !resolved.name) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            ok: false,
            code: 'package-not-found',
            message: `Package '${args.package}' is not in the selected SDK index`,
            ...(resolved.candidates.length > 0 ? { didYouMean: resolved.candidates } : {}),
          }, null, 2) }],
          isError: true,
        }
      }
      return inspectContract({ ...args, package: resolved.name ?? args.package }, index)
    }
    case 'plan-composition': return jsonResult(planComposition(args, index))
    case 'scaffold-app':
      if (!args.plan || typeof args.plan !== 'object') {
        return { content: [{ type: 'text', text: 'plan is required (call plan-composition first)' }], isError: true }
      }
      return jsonResult(scaffoldApp(args, index))
    case 'refresh-index': return refreshIndexTool()
    default: return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  }
}

function jsonResult(value: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

function refreshIndexTool(): ToolResponse {
  const idx = refreshIndex()
  return {
    content: [{
      type: 'text',
      text: `Index rebuilt: ${Object.keys(idx.packages).length} packages, ${Object.keys(idx.symbolIndex).length} symbols, ${Object.keys(idx.domainMap).length} domains.`,
    }],
  }
}

/** All domain layer names present in the index, sorted. */
function knownDomains(index: SdkIndex): string[] {
  return Object.keys(index.domainMap).sort()
}

/** Normalize a domain token — case and any of space/underscore/slash collapse to `-`. */
function normalizeDomain(token: string): string {
  return token.toLowerCase().trim().replace(/[\s_/]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Resolve one requested domain token to concrete domain layers. Exact matches
 * win; otherwise a partial token resolves to every domain that contains it
 * ("edge" -> "edge-computing") or is contained by it.
 */
function matchDomains(requested: string, domains: string[]): string[] {
  const want = normalizeDomain(requested)
  if (!want) return []
  const pairs = domains.map(raw => ({ raw, norm: normalizeDomain(raw) }))
  const exact = pairs.filter(p => p.norm === want).map(p => p.raw)
  if (exact.length > 0) return exact
  return pairs.filter(p => p.norm.includes(want) || want.includes(p.norm)).map(p => p.raw)
}

/**
 * Resolve a domain filter (comma or space separated) into concrete domains,
 * reporting tokens that match no domain so callers are never silently empty.
 */
function resolveDomainFilter(requested: string | undefined, index: SdkIndex): { domains: string[]; unresolved: string[] } {
  if (!requested || !requested.trim()) return { domains: [], unresolved: [] }
  const domains = knownDomains(index)
  const resolved = new Set<string>()
  const unresolved: string[] = []
  for (const token of requested.split(/[,\s]+/).filter(Boolean)) {
    const matches = matchDomains(token, domains)
    if (matches.length === 0) unresolved.push(token)
    for (const match of matches) resolved.add(match)
  }
  return { domains: [...resolved].sort(), unresolved }
}

/** Explicit, actionable answer for a domain filter that matched nothing. */
function unknownDomainResponse(unresolved: string[], index: SdkIndex): ToolResponse {
  const domains = knownDomains(index)
  const quoted = unresolved.map(t => `'${t}'`).join(', ')
  const near = [...new Set(unresolved.flatMap(token => {
    const want = normalizeDomain(token)
    return domains
      .map(d => ({ d, norm: normalizeDomain(d) }))
      .filter(({ norm }) => {
        for (let n = Math.min(want.length, norm.length); n >= 3; n--) {
          if (norm.slice(0, n) === want.slice(0, n)) return true
        }
        return false
      })
      .map(({ d }) => d)
  }))].slice(0, 3)

  return {
    content: [{
      type: 'text',
      text: [
        `No domain matched ${quoted}.`,
        'Domains are matched partially, so a shorter token works (e.g. "edge" resolves to "edge-computing").',
        '',
        `Known domains (${domains.length}): ${domains.join(', ')}`,
        ...(near.length > 0 ? ['', `Did you mean: ${near.join(', ')}?`] : []),
        '',
        'For free-text search across package names, keywords and descriptions use search-packages.',
      ].join('\n'),
    }],
    isError: true,
  }
}

/** Closest package names to `name` — substring first, then shared name parts. */
function nearestPackages(name: string, index: SdkIndex, limit = 5): string[] {
  const want = String(name ?? '').toLowerCase().replace(/^@?totemsdk\//, '').trim()
  if (!want) return []
  return Object.keys(index.packages)
    .map((full) => {
      const short = full.replace('@totemsdk/', '').toLowerCase()
      let score = 0
      if (short === want) score = 100
      else if (short.includes(want)) score = 60 - Math.min(20, short.length - want.length)
      else if (want.includes(short)) score = 40
      else score = want.split(/[-_/]+/).filter(Boolean).filter(part => short.includes(part)).length * 10
      return { full, score }
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.full.localeCompare(b.full))
    .slice(0, limit)
    .map(entry => entry.full)
}

/**
 * Resolve a user-supplied package reference to an exact index key.
 *
 * Accepts the canonical name (`@totemsdk/core`), a bare name (`core`), any
 * casing, and a version suffix (`@totemsdk/core@0.6.0` — the form list-packages
 * prints, so its own output is valid input). It never guesses between several
 * plausible packages: an ambiguous reference resolves to no name and returns
 * candidates for the caller to report.
 */
function resolvePackageName(raw: unknown, index: SdkIndex): { name: string | null; candidates: string[] } {
  const input = String(raw ?? '').trim().replace(/\/+$/, '')
  if (!input) return { name: null, candidates: [] }

  // Strip a trailing version: `@totemsdk/core@0.6.0` and `core@0.6.0` both keep the name.
  const withoutVersion = input.includes('@', 1) ? input.slice(0, input.lastIndexOf('@')) : input

  const variants = new Set<string>()
  for (const value of [withoutVersion, input]) {
    const lower = value.trim().toLowerCase()
    if (!lower) continue
    const bare = lower.replace(/^@totemsdk\//, '')
    variants.add(lower)
    variants.add(bare)
    variants.add(`@totemsdk/${bare}`)
  }

  const byName = new Map(Object.keys(index.packages).map(name => [name.toLowerCase(), name]))
  for (const variant of variants) {
    const hit = byName.get(variant)
    if (hit) return { name: hit, candidates: [] }
  }
  return { name: null, candidates: nearestPackages(withoutVersion, index) }
}

/** Explicit, actionable answer for a package reference that is not in the index. */
function packageNotFound(raw: unknown, index: SdkIndex, label = 'Package', candidates?: string[]): ToolResponse {
  const nearest = candidates && candidates.length > 0 ? candidates : nearestPackages(String(raw ?? ''), index)
  return {
    content: [{
      type: 'text',
      text: [
        `${label} '${String(raw ?? '')}' not found in the SDK index (${Object.keys(index.packages).length} packages).`,
        ...(nearest.length > 0 ? ['', 'Did you mean:', ...nearest.map(n => `  - ${n}`)] : []),
        '',
        'Package names may be given with or without the "@totemsdk/" scope (e.g. "core" or "@totemsdk/core").',
        'Use list-packages or search-packages to find the exact name.',
      ].join('\n'),
    }],
    isError: true,
  }
}


function searchPackages(args: any, index: SdkIndex): ToolResponse {
  const query = String(args.query || '').toLowerCase().trim()
  if (!query) return { content: [{ type: 'text', text: 'query is required' }], isError: true }
  const { domains, unresolved } = resolveDomainFilter(args.domain as string | undefined, index)
  if (unresolved.length > 0) return unknownDomainResponse(unresolved, index)
  const requestedLimit = Number(args.limit)
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 15
  const terms = query.split(/\s+/).filter(Boolean)

  const scored = Object.values(index.packages)
    .filter(p => domains.length === 0 || domains.includes(p.domain))
    .map(p => {
      const haystackName = p.name.toLowerCase()
      const haystackDesc = p.description.toLowerCase()
      const haystackKw = (p.keywords ?? []).join(' ').toLowerCase()
      const haystackExports = [
        ...p.exports.functions, ...p.exports.types, ...p.exports.classes, ...p.exports.interfaces, ...p.exports.consts,
      ].join(' ').toLowerCase()
      let score = 0
      for (const t of terms) {
        if (haystackName.includes(t)) score += 4
        if (haystackKw.includes(t)) score += 3
        if (haystackExports.includes(t)) score += 2
        if (haystackDesc.includes(t)) score += 1
      }
      return { p, score }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)

  if (scored.length === 0) {
    const scope = domains.length > 0 ? ` within domain '${domains.join(', ')}'` : ''
    const domainNote = domains.length > 0
      ? `That domain has ${Object.values(index.packages).filter(p => domains.includes(p.domain)).length} package(s); drop the domain filter to search the whole index.`
      : `The index holds ${Object.keys(index.packages).length} packages.`
    return {
      content: [{
        type: 'text',
        text: [
          `No packages matched '${query}'${scope}.`,
          domainNote,
          '',
          'Try list-packages to browse by domain, or search-symbol to search exported names.',
        ].join('\n'),
      }],
    }
  }
  return {
    content: [{
      type: 'text',
      text: `Found ${scored.length} package(s) for '${query}'${domains.length > 0 ? ` in ${domains.join(', ')}` : ''}:\n\n` +
        scored.map(r => `  ${r.p.name}@${r.p.version} [${r.p.domain}] (score ${r.score}) — ${r.p.description}`).join('\n'),
    }],
  }
}

function readSource(args: any, index: SdkIndex): ToolResponse {
  const file = args.path
  if (!args.package || !file) return { content: [{ type: 'text', text: 'package and path are required' }], isError: true }
  const resolved = resolvePackageName(args.package, index)
  if (!resolved.name) return packageNotFound(args.package, index, 'Package', resolved.candidates)
  const pkg = resolved.name
  const content = readSourceFile(pkg, file)
  if (content === null) {
    const indexed = index.packages[pkg]
    const contractUri = `totemsdk://packages/${encodeURIComponent(pkg)}/contracts`
    return {
      content: [{
        type: 'text',
        text: `Source unavailable: ${pkg}/src/${file}. `
          + (indexed
            ? `This build does not ship implementation source; read the exact contracts at ${contractUri}.`
            : `Package '${pkg}' is not in the selected SDK index.`),
      }],
      isError: true,
    }
  }
  return { content: [{ type: 'text', text: content }] }
}

function listPackages(args: any, index: SdkIndex): ToolResponse {
  const requestedDomain = typeof args.domain === 'string' ? args.domain : undefined
  const filter = (args.filter as string | undefined)?.toLowerCase().trim()
  const { domains, unresolved } = resolveDomainFilter(requestedDomain, index)
  if (unresolved.length > 0) return unknownDomainResponse(unresolved, index)

  const matches = (p: SdkIndex['packages'][string]): boolean => {
    if (domains.length > 0 && !domains.includes(p.domain)) return false
    if (!filter) return true
    return p.name.toLowerCase().includes(filter)
      || p.domain.toLowerCase().includes(filter)
      || (p.keywords ?? []).join(' ').toLowerCase().includes(filter)
  }
  const rows = Object.values(index.packages).filter(matches).sort((a, b) => a.name.localeCompare(b.name))

  const criteria = [
    ...(requestedDomain ? [`domain: ${domains.join(', ')}`] : []),
    ...(filter ? [`filter: '${filter}'`] : []),
  ]

  if (rows.length === 0) {
    return {
      content: [{
        type: 'text',
        text: [
          `No packages matched${criteria.length > 0 ? ` (${criteria.join('; ')})` : ''}.`,
          domains.length > 0
            ? `'${domains.join(', ')}' has ${Object.values(index.packages).filter(p => domains.includes(p.domain)).length} package(s) in total.`
            : `The index holds ${Object.keys(index.packages).length} packages.`,
          '',
          'Omit "filter" to list every package in a domain, or use search-packages for free-text search.',
        ].join('\n'),
      }],
    }
  }
  return {
    content: [{
      type: 'text',
      text: `${rows.length} package(s)${criteria.length > 0 ? ` [${criteria.join('; ')}]` : ''}:\n\n` +
        rows.map(p => `  ${p.name}@${p.version} [${p.domain}] — ${p.description}`).join('\n'),
    }],
  }
}

function searchSymbol(args: any, index: SdkIndex): ToolResponse {
  const query = (args.query || '').toLowerCase()
  if (!query) return { content: [{ type: 'text', text: 'query is required' }], isError: true }

  const results: Array<{ symbol: string; package: string; kind: string; signature?: string; deprecated?: boolean }> = []
  for (const [symbol, entries] of Object.entries(index.symbolIndex)) {
    if (symbol.toLowerCase().includes(query)) {
      for (const entry of entries) {
        results.push({
          symbol,
          package: entry.package,
          kind: entry.kind,
          ...(entry.signature !== undefined ? { signature: entry.signature } : {}),
          ...(entry.deprecated ? { deprecated: true } : {}),
        })
      }
    }
  }
  results.sort((a, b) => a.symbol.localeCompare(b.symbol))

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No symbols found matching '${query}'` }] }
  }
  return {
    content: [{
      type: 'text',
      text: `Found ${results.length} match(es) for '${query}':\n\n` +
        results
          .map(r => `  ${r.symbol} (${r.kind}) — ${r.package}${r.deprecated ? ' [deprecated]' : ''}` +
            (r.signature ? `\n      ${r.signature}` : ''))
          .join('\n'),
    }],
  }
}

function findType(args: any, index: SdkIndex): ToolResponse {
  const pattern = (args.pattern || '').toLowerCase()
  if (!pattern) return { content: [{ type: 'text', text: 'pattern is required' }], isError: true }

  const results: Array<{ package: string; type: string; kind: string; signature?: string; deprecated?: boolean }> = []
  for (const [pkgName, pkg] of Object.entries(index.packages)) {
    for (const entry of typeEntries(pkg)) {
      if (entry.name.toLowerCase().includes(pattern)) {
        results.push({
          package: pkgName,
          type: entry.name,
          kind: entry.kind,
          ...(entry.signature !== undefined ? { signature: entry.signature } : {}),
          ...(entry.deprecated ? { deprecated: true } : {}),
        })
      }
    }
  }
  results.sort((a, b) => a.type.localeCompare(b.type))

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No types found matching '${pattern}'` }] }
  }
  return {
    content: [{
      type: 'text',
      text: `Found ${results.length} type(s) for '${pattern}':\n\n` +
        results
          .map(r => `  ${r.type} (${r.kind}) — ${r.package}${r.deprecated ? ' [deprecated]' : ''}` +
            (r.signature ? `\n      ${r.signature}` : ''))
          .join('\n'),
    }],
  }
}

/** Type/interface/class entries for a package (uses `symbols` when present, else `exports`). */
function typeEntries(pkg: SdkIndex['packages'][string]): Array<{ name: string; kind: string; signature?: string; deprecated?: boolean }> {
  if (pkg.symbols && Object.keys(pkg.symbols).length > 0) {
    return Object.entries(pkg.symbols)
      .filter(([, m]) => m.kind === 'type' || m.kind === 'interface' || m.kind === 'class')
      .map(([name, m]) => ({
        name,
        kind: m.kind,
        ...(m.signature !== undefined ? { signature: m.signature } : {}),
        ...(m.deprecated ? { deprecated: true } : {}),
      }))
  }
  return [
    ...pkg.exports.interfaces.map(n => ({ name: n, kind: 'interface' })),
    ...pkg.exports.types.map(n => ({ name: n, kind: 'type' })),
    ...pkg.exports.classes.map(n => ({ name: n, kind: 'class' })),
  ]
}

function dependencyEdges(index: SdkIndex, name: string, direction: 'in' | 'out' | 'all'): DependencyEdge[] {
  const edges: DependencyEdge[] = []
  const kinds: DependencyKind[] = ['runtime', 'peer', 'optional', 'dev']
  if (direction === 'out' || direction === 'all') {
    const pkg = index.packages[name]
    for (const kind of kinds) {
      for (const [to, range] of Object.entries(pkg?.dependencyGroups?.[kind] ?? {})) {
        edges.push({ from: name, to, kind, range: String(range) })
      }
    }
  }
  if (direction === 'in' || direction === 'all') {
    for (const [from, pkg] of Object.entries(index.packages)) {
      for (const kind of kinds) {
        const range = pkg.dependencyGroups?.[kind]?.[name]
        if (range !== undefined) edges.push({ from, to: name, kind, range: String(range) })
      }
    }
  }
  return edges
}

function stronglyConnected(index: SdkIndex): string[][] {
  const nodes = Object.keys(index.packages)
  const adjacency = new Map<string, string[]>()
  for (const name of nodes) {
    const out = new Set<string>()
    for (const kind of ['runtime', 'peer', 'optional'] as DependencyKind[]) {
      for (const dep of Object.keys(index.packages[name]?.dependencyGroups?.[kind] ?? {})) {
        if (index.packages[dep]) out.add(dep)
      }
    }
    adjacency.set(name, [...out])
  }
  let counter = 0
  const indices = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []
  const visit = (node: string): void => {
    indices.set(node, counter); low.set(node, counter); counter++
    stack.push(node); onStack.add(node)
    for (const next of adjacency.get(node) ?? []) {
      if (!indices.has(next)) { visit(next); low.set(node, Math.min(low.get(node)!, low.get(next)!)) }
      else if (onStack.has(next)) low.set(node, Math.min(low.get(node)!, indices.get(next)!))
    }
    if (low.get(node) === indices.get(node)) {
      const component: string[] = []
      let current: string
      do { current = stack.pop()!; onStack.delete(current); component.push(current) } while (current !== node)
      if (component.length > 1 || (adjacency.get(node) ?? []).includes(node)) components.push(component.sort())
    }
  }
  for (const node of nodes) if (!indices.has(node)) visit(node)
  return components.sort((a, b) => a[0].localeCompare(b[0]))
}

function dependencyGraph(args: any, index: SdkIndex): ToolResponse {
  const resolved = resolvePackageName(args.package, index)
  if (!resolved.name) return packageNotFound(args.package, index, 'Package', resolved.candidates)
  const pkgName = resolved.name
  const direction = args.direction || 'out'
  if (!['in', 'out', 'all'].includes(direction)) {
    return { content: [{ type: 'text', text: 'Invalid direction. Use "in", "out", or "all".' }], isError: true }
  }
  const edges = dependencyEdges(index, pkgName, direction)
  if (args.format === 'json') {
    return { content: [{ type: 'text', text: JSON.stringify({
      package: pkgName,
      direction,
      edges,
      nodes: [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))].sort(),
      stronglyConnectedComponents: stronglyConnected(index),
    }, null, 2) }] }
  }
  const group = (kind: DependencyKind): string => {
    const list = edges.filter((edge) => edge.kind === kind)
    if (list.length === 0) return ''
    const heading = direction === 'in' && kind === 'runtime'
      ? 'Inbound runtime'
      : `${kind[0].toUpperCase()}${kind.slice(1)}`
    return `**${heading}:**\n${list.map((edge) => `  - ${edge.from} → ${edge.to} (${edge.range})`).join('\n')}\n`
  }
  return { content: [{ type: 'text', text: `# ${pkgName} — Dependencies (${direction})\n\n` +
    ((['runtime', 'peer', 'optional', 'dev'] as DependencyKind[]).map(group).filter(Boolean).join('\n') || '_(none)_') }] }
}

function hasExportPath(exportsMap: Record<string, unknown> | undefined, subpath: string, condition?: string): boolean {
  if (!exportsMap) return subpath === '.'
  const value = exportsMap[subpath]
  if (value === undefined) return false
  if (condition === undefined) return true
  const visit = (node: unknown): boolean => {
    if (typeof node === 'string' || node === null) return true
    if (Array.isArray(node)) return node.some(visit)
    if (typeof node !== 'object') return false
    const record = node as Record<string, unknown>
    if (record[condition] !== undefined) return true
    return false
  }
  return visit(value)
}

function validateImport(args: any, index: SdkIndex): ToolResponse {
  const { symbol, subpath, condition } = args
  if (!args.from || !args.to) {
    return { content: [{ type: 'text', text: 'from and to package names are required' }], isError: true }
  }
  const fromResolved = resolvePackageName(args.from, index)
  const toResolved = resolvePackageName(args.to, index)
  if (!fromResolved.name) return packageNotFound(args.from, index, 'Source package', fromResolved.candidates)
  if (!toResolved.name) return packageNotFound(args.to, index, 'Target package', toResolved.candidates)
  const fromPkg = fromResolved.name
  const toPkg = toResolved.name
  const fromPkgData = index.packages[fromPkg]
  const toPkgData = index.packages[toPkg]
  if (!fromPkgData) return packageNotFound(args.from, index, 'Source package', fromResolved.candidates)
  if (!toPkgData) return packageNotFound(args.to, index, 'Target package', toResolved.candidates)

  let dependencyKind: ValidImportResult['dependencyKind'] = 'none'
  for (const kind of ['runtime', 'peer', 'optional', 'dev'] as DependencyKind[]) {
    if (fromPkgData.dependencyGroups?.[kind]?.[toPkg] !== undefined) { dependencyKind = kind; break }
  }
  const result: ValidImportResult = {
    valid: dependencyKind !== 'none' && dependencyKind !== 'dev',
    importPath: subpath ? `${toPkg}/${subpath.replace(/^\.\//, '')}` : toPkg,
    symbolFound: false,
    dependencyKind,
    ...(subpath ? { subpath } : {}),
    ...(condition ? { condition } : {}),
  }
  if (dependencyKind === 'none') result.reason = `'${fromPkg}' does not depend on '${toPkg}'`
  else if (dependencyKind === 'dev') result.reason = `'${toPkg}' is a development-only dependency of '${fromPkg}'`
  if (result.valid && subpath) {
    if (!hasExportPath(toPkgData.exportsMap, subpath, condition)) {
      result.valid = false
      result.reason = `'${toPkg}' does not export subpath '${subpath}'${condition ? ` under condition '${condition}'` : ''}`
    }
  }
  if (result.valid && symbol) {
    const allExports = [
      ...toPkgData.exports.functions, ...toPkgData.exports.types, ...toPkgData.exports.classes,
      ...toPkgData.exports.interfaces, ...toPkgData.exports.consts,
    ]
    result.symbolFound = allExports.includes(symbol)
    if (!result.symbolFound) { result.valid = false; result.reason = `'${toPkg}' does not export '${symbol}'` }
  }
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}

function scaffoldAdapter(args: any): ToolResponse {
  const { name, protocol, commands } = args
  if (!name || !protocol) {
    return { content: [{ type: 'text', text: 'name and protocol are required' }], isError: true }
  }

  const cmdList = Array.isArray(commands) ? commands : ['connect', 'disconnect', 'read', 'write']

  const files: ScaffoldResult['files'] = []

  files.push({
    path: `src/index.ts`,
    content: [
      `export type { ${protocol}TransportPort } from './transport.js'`,
      `export { create${protocol}Gateway } from './gateway.js'`,
      `export type { ${protocol}GatewayConfig, ${protocol}Gateway } from './gateway.js'`,
      `export { create${protocol}SensorBridge } from './sensor-bridge.js'`,
      `export type { ${protocol}SensorBinding, ${protocol}SensorBridgeConfig } from './sensor-bridge.js'`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/transport.ts`,
    content: [
      `export interface ${protocol}TransportPort {`,
      ...cmdList.map(c => `  ${c}(...args: unknown[]): Promise<unknown>;`),
      `  onError(handler: (err: Error) => void): () => void;`,
      `}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/gateway.ts`,
    content: [
      `import type { ${protocol}TransportPort } from './transport.js'`,
      `import type { EdgeRuntime } from '@totemsdk/edge'`,
      ``,
      `export interface ${protocol}GatewayConfig {`,
      `  runtime: EdgeRuntime`,
      `  transport: ${protocol}TransportPort`,
      `}`,
      ``,
      `export interface ${protocol}Gateway {`,
      `  start(): Promise<void>`,
      `  stop(): Promise<void>`,
      `}`,
      ``,
      `export function create${protocol}Gateway(config: ${protocol}GatewayConfig): ${protocol}Gateway {`,
      `  return {`,
      `    async start() { /* TODO: implement */ },`,
      `    async stop() { /* TODO: implement */ },`,
      `  }`,
      `}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/sensor-bridge.ts`,
    content: [
      `import type { ${protocol}TransportPort } from './transport.js'`,
      `import type { ${protocol}Gateway } from './gateway.js'`,
      `import type { EdgeRuntime } from '@totemsdk/edge'`,
      ``,
      `export interface ${protocol}SensorBinding {`,
      `  sensorId: string`,
      `  intervalMs: number`,
      `  dataType?: string`,
      `  unit?: string`,
      `}`,
      ``,
      `export interface ${protocol}SensorBridgeConfig {`,
      `  runtime: EdgeRuntime`,
      `  transport: ${protocol}TransportPort`,
      `  gateway: ${protocol}Gateway`,
      `  bindings: ${protocol}SensorBinding[]`,
      `}`,
      ``,
      `export interface ${protocol}SensorBridge {`,
      `  start(): Promise<void>`,
      `  stop(): Promise<void>`,
      `}`,
      ``,
      `export function create${protocol}SensorBridge(config: ${protocol}SensorBridgeConfig): ${protocol}SensorBridge {`,
      `  return {`,
      `    async start() { /* TODO: implement */ },`,
      `    async stop() { /* TODO: implement */ },`,
      `  }`,
      `}`,
      ``,
    ].join('\n'),
  })

  return {
    content: [{
      type: 'text',
      text: `# Scaffolded ${protocol} Edge Adapter\n\nCreated ${files.length} files:\n\n` +
        files.map(f => `**${f.path}**\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n'),
    }],
  }
}

function scaffoldPackage(args: any): ToolResponse {
  const { name, deps } = args
  if (!name) return { content: [{ type: 'text', text: 'name is required' }], isError: true }

  const depList = Array.isArray(deps) ? deps : ['@totemsdk/core']

  const files: ScaffoldResult['files'] = []

  files.push({
    path: `package.json`,
    content: JSON.stringify({
      name: `@totemsdk/${name}`,
      version: '0.1.0',
      description: `TODO: describe ${name}`,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          require: './dist/index.js',
          import: './dist/index.js',
        },
      },
      scripts: { build: 'tsc', clean: 'rm -rf dist', test: 'jest --passWithNoTests' },
      files: ['dist', 'README.md', 'LICENSE', 'NOTICE'],
      dependencies: Object.fromEntries(depList.map(d => [d, '^0.1.0'])),
      devDependencies: {
        '@types/jest': '^30.0.0',
        '@types/node': '^20.0.0',
        jest: '^30.4.2',
        typescript: '^7.0.2',
      },
      publishConfig: { access: 'public' },
      license: 'Apache-2.0',
    }, null, 2),
  })

  files.push({
    path: `NOTICE`,
    content: [
      `Totem SDK`,
      `Copyright 2024-2026 Totem SDK Contributors`,
      ``,
      `This package is licensed under the Apache License, Version 2.0.`,
      `See LICENSE and the repository NOTICE for third-party attributions.`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `tsconfig.json`,
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        declaration: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: 'bundler',
        resolveJsonModule: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts'],
    }, null, 2),
  })

  files.push({
    path: `src/index.ts`,
    content: [
      `export {}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/types.ts`,
    content: [
      `export {}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/canonical.ts`,
    content: [
      `import { sha3_256 } from '@totemsdk/core'`,
      ``,
      `export function toHex(bytes: Uint8Array): string {`,
      `  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')`,
      `}`,
      ``,
      `export function canonicalJson(value: unknown): string {`,
      `  if (value === null || typeof value !== 'object') return JSON.stringify(value)`,
      `  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'`,
      `  const obj = value as Record<string, unknown>`,
      `  const keys = Object.keys(obj).sort()`,
      `  const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k]))`,
      `  return '{' + pairs.join(',') + '}'`,
      `}`,
      ``,
      `export function hashCanonical(domain: string, value: unknown): string {`,
      `  return toHex(sha3_256(new TextEncoder().encode(domain + canonicalJson(value))))`,
      `}`,
      ``,
    ].join('\n'),
  })

  return {
    content: [{
      type: 'text',
      text: `# Scaffolded @totemsdk/${name}\n\nCreated ${files.length} files in ${name}/:\n\n` +
        files.map(f => `**${f.path}**\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n'),
    }],
  }
}

function suggestTemplate(args: any): ToolResponse {
  const usecase = (args.usecase || '').toLowerCase()
  if (!usecase) {
    return { content: [{ type: 'text', text: 'usecase is required — describe what you want to do (e.g. "time-lock funds until a block height")' }], isError: true }
  }

  const results = searchTemplates(usecase)
  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No templates found matching '${usecase}'. Try different keywords (e.g. "lock", "vote", "payment", "identity", "state machine").` }] }
  }

  const lines: string[] = [`Found ${results.length} template(s) matching '${args.usecase}':`, '']
  for (const r of results) {
    lines.push(`## ${r.template}`)
    lines.push(`${r.description}`)
    lines.push('')
    lines.push(`**Functions:**`)
    for (const fn of r.functions) {
      lines.push(`  - \`import { ${fn} } from '@totemsdk/kissvm'\``)
    }
    if (r.configTypes.length > 0) {
      lines.push('')
      lines.push(`**Config types:**`)
      for (const t of r.configTypes) {
        lines.push(`  - \`${t}\``)
      }
    }
    if (r.package) {
      const pkgs = Array.isArray(r.package) ? r.package : [r.package]
      lines.push('')
      lines.push(`**Related package(s):** ${pkgs.map(p => `\`@totemsdk/${p}\``).join(', ')}`)
    }
    lines.push('')
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] }
}

function packageStats(args: any, index: SdkIndex): ToolResponse {
  const resolved = resolvePackageName(args.name, index)
  if (!resolved.name) return packageNotFound(args.name, index, 'Package', resolved.candidates)
  const pkgName = resolved.name

  const pkg = index.packages[pkgName]
  const totalExports = pkg.exports.functions.length + pkg.exports.types.length +
    pkg.exports.classes.length + pkg.exports.interfaces.length + pkg.exports.consts.length

  const totemDeps = pkg.dependencies.filter(d => d.startsWith('@totemsdk/'))
  const externalDeps = pkg.dependencies.filter(d => !d.startsWith('@totemsdk/'))

  const pkgDir = pkg.name.replace('@totemsdk/', '')
  const templates = getTemplatesForPackage(pkgDir)
  const templateSection = templates.length > 0
    ? [
        ``,
        `**KISSVM Templates:**`,
        ...templates.flatMap(t => [
          `  - **${t.template}** — ${t.description}`,
          ...t.functions.map(fn => `    - \`import { ${fn} } from '@totemsdk/kissvm'\``),
        ]),
      ]
    : []

  return {
    content: [{
      type: 'text',
      text: [
        `# ${pkgName} v${pkg.version}`,
        ``,
        `**Domain:** ${pkg.domain}`,
        `**Description:** ${pkg.description}`,
        `**Directory:** ${pkg.dir}`,
        ``,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Functions | ${pkg.exports.functions.length} |`,
        `| Types (named) | ${pkg.exports.types.length} |`,
        `| Interfaces | ${pkg.exports.interfaces.length} |`,
        `| Classes | ${pkg.exports.classes.length} |`,
        `| Constants | ${pkg.exports.consts.length} |`,
        `| **Total exports** | **${totalExports}** |`,
        `| Rust/WASM | ${pkg.hasRust ? 'Yes' : 'No'} |`,
        `| Go | ${pkg.hasGo ? 'Yes' : 'No'} |`,
        `| Tests | ${pkg.hasTests ? 'Yes' : 'No'} |`,
        `| @totemsdk/* deps | ${totemDeps.length} |`,
        `| External deps | ${externalDeps.length} |`,
        ...templateSection,
        ``,
      ].join('\n'),
    }],
  }
}

function listExports(args: any, index: SdkIndex): ToolResponse {
  const KINDS = ['function', 'interface', 'type', 'class', 'const']
  const kind = (args.kind || '').toLowerCase()
  const filter = (args.filter || '').toLowerCase()
  const resolved = resolvePackageName(args.package, index)
  if (!resolved.name) return packageNotFound(args.package, index, 'Package', resolved.candidates)
  const pkgName = resolved.name
  if (kind && !KINDS.includes(kind)) {
    return {
      content: [{
        type: 'text',
        text: `Unknown kind '${args.kind}'. Use one of: ${KINDS.join(', ')} (singular), or omit it for all.`,
      }],
      isError: true,
    }
  }

  const pkg = index.packages[pkgName]
  const sections: string[] = []
  const render = (s: string): string => {
    const m = pkg.symbols?.[s]
    const dep = m?.deprecated ? ' · deprecated' : ''
    return `  - \`${s}\`${dep}${m?.signature ? `\n      ${m.signature}` : ''}`
  }
  const pick = (list: string[]) => (filter ? list.filter(s => s.toLowerCase().includes(filter)) : list)

  if (!kind || kind === 'function') {
    const items = pick(pkg.exports.functions)
    if (items.length) sections.push(`**Functions (${items.length}):**\n` + items.map(render).join('\n'))
  }
  if (!kind || kind === 'interface') {
    const items = pick(pkg.exports.interfaces)
    if (items.length) sections.push(`**Interfaces (${items.length}):**\n` + items.map(render).join('\n'))
  }
  if (!kind || kind === 'type') {
    const items = pick(pkg.exports.types)
    if (items.length) sections.push(`**Named Types (${items.length}):**\n` + items.map(render).join('\n'))
  }
  if (!kind || kind === 'class') {
    const items = pick(pkg.exports.classes)
    if (items.length) sections.push(`**Classes (${items.length}):**\n` + items.map(render).join('\n'))
  }
  if (!kind || kind === 'const') {
    const items = pick(pkg.exports.consts)
    if (items.length) sections.push(`**Constants (${items.length}):**\n` + items.map(render).join('\n'))
  }

  const total = pkg.exports.functions.length + pkg.exports.interfaces.length + pkg.exports.types.length +
    pkg.exports.classes.length + pkg.exports.consts.length
  if (sections.length === 0) {
    const scope = [kind ? `kind '${kind}'` : '', filter ? `filter '${filter}'` : ''].filter(Boolean).join(' and ')
    return {
      content: [{
        type: 'text',
        // A filter that matches nothing must not read like the package has no exports.
        text: total === 0
          ? `${pkgName} exports no symbols in the selected index.`
          : `No exports in ${pkgName} matched ${scope} (the package exports ${total} symbol(s)).`,
      }],
    }
  }

  return {
    content: [{ type: 'text', text: sections.join('\n\n') }],
  }
}

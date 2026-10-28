/**
 * Bounded contract inspection by package, export subpath and symbol.
 *
 * Contract metadata comes from the selected index; implementation source is
 * never implied. A subpath is verified against package.json exports, while
 * symbols remain package-scoped because the index does not yet map each symbol
 * to its originating subpath.
 */

import type { SdkIndex, SymbolMeta, ToolResponse } from './types.js'

export interface InspectContractInput {
  package?: string
  subpath?: string
  symbol?: string
  offset?: number
  limit?: number
  includeDocs?: boolean
}

function hasExportPath(exportsMap: Record<string, unknown> | undefined, subpath: string): boolean {
  if (!exportsMap) return subpath === '.'
  return exportsMap[subpath] !== undefined
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.min(max, Math.max(min, number))
}

export function inspectContract(args: InspectContractInput, index: SdkIndex): ToolResponse {
  const pkgName = args.package
  if (!pkgName) {
    return { content: [{ type: 'text', text: JSON.stringify({
      ok: false, code: 'package-required', message: 'package is required',
    }, null, 2) }], isError: true }
  }
  const pkg = index.packages[pkgName]
  if (!pkg) {
    return { content: [{ type: 'text', text: JSON.stringify({
      ok: false, code: 'package-not-found', message: `Package '${pkgName}' is not in the selected SDK index`,
    }, null, 2) }], isError: true }
  }

  const subpath = args.subpath ?? '.'
  const subpathExists = hasExportPath(pkg.exportsMap, subpath)
  if (!subpathExists) {
    return { content: [{ type: 'text', text: JSON.stringify({
      ok: false, code: 'subpath-not-found', package: pkg.name, subpath,
      availableSubpaths: Object.keys(pkg.exportsMap ?? { '.': null }),
      message: `'${pkg.name}' does not export subpath '${subpath}'`,
    }, null, 2) }], isError: true }
  }

  const allSymbols = Object.entries(pkg.symbols ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (args.symbol) {
    const symbol = allSymbols.find(([name]) => name === args.symbol)
    if (!symbol) {
      const suggestions = allSymbols
        .filter(([name]) => name.toLowerCase().includes(args.symbol!.toLowerCase()))
        .slice(0, 10)
        .map(([name]) => name)
      return { content: [{ type: 'text', text: JSON.stringify({
        ok: false, code: 'symbol-not-found', package: pkg.name, symbol: args.symbol,
        suggestions,
        message: `'${pkg.name}' does not export symbol '${args.symbol}'`,
      }, null, 2) }], isError: true }
    }
    return { content: [{ type: 'text', text: JSON.stringify({
      ok: true,
      contentKind: 'contract',
      package: pkg.name,
      version: pkg.version,
      domain: pkg.domain,
      ...(pkg.maturity ? { maturity: pkg.maturity } : {}),
      origin: index.source ?? 'unknown',
      sourceRevision: index.sourceRevision ?? null,
      subpath,
      subpathScope: 'package',
      symbol: symbol[0],
      declaration: symbol[1],
      limitations: ['Symbol-to-subpath mapping is package-scoped; verify the import path against package exports.'],
    }, null, 2) }] }
  }

  const offset = bounded(args.offset, 0, 0, allSymbols.length)
  const limit = bounded(args.limit, 25, 1, 100)
  const page = allSymbols.slice(offset, offset + limit)
  const includeDocs = args.includeDocs !== false
  const symbols = page.map(([name, meta]) => {
    const entry: Record<string, unknown> = { name, kind: meta.kind }
    if (meta.signature) entry.signature = meta.signature
    if (meta.deprecated) entry.deprecated = true
    if (includeDocs && meta.doc) entry.doc = meta.doc
    return entry
  })

  return { content: [{ type: 'text', text: JSON.stringify({
    ok: true,
    contentKind: 'contract',
    package: pkg.name,
    version: pkg.version,
    domain: pkg.domain,
    ...(pkg.maturity ? { maturity: pkg.maturity } : {}),
    origin: index.source ?? 'unknown',
    sourceRevision: index.sourceRevision ?? null,
    subpath,
    subpathScope: 'package',
    totalSymbols: allSymbols.length,
    offset,
    limit,
    nextOffset: offset + symbols.length < allSymbols.length ? offset + symbols.length : null,
    symbols,
    limitations: [
      'Symbols are package-scoped; the index does not yet map each symbol to its export subpath.',
      'Contract metadata is not implementation source.',
    ],
  }, null, 2) }] }
}

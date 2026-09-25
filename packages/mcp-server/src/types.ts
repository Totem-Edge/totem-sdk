export interface PackageIndex {
  name: string
  dir: string
  version: string
  description: string
  keywords?: string[]
  dependencies: string[]
  devDependencies: string[]
  hasRust: boolean
  hasGo: boolean
  hasTests: boolean
  exports: PackageExports
  /** Per-symbol metadata (signature, doc, deprecation) keyed by symbol name. */
  symbols?: { [name: string]: SymbolMeta }
  domain: string
}

export interface PackageExports {
  functions: string[]
  types: string[]
  classes: string[]
  interfaces: string[]
  consts: string[]
}

export type SymbolKind = 'function' | 'type' | 'class' | 'interface' | 'const' | 'variable'

export interface SymbolMeta {
  kind: SymbolKind
  /** Best-effort declaration text (params/return/extends), whitespace-normalized. */
  signature?: string
  /** Leading JSDoc/line-comment text, if any. */
  doc?: string
  /** True when the doc contains an `@deprecated` tag. */
  deprecated?: boolean
}

export interface SymbolEntry {
  package: string
  kind: SymbolKind
  signature?: string
  doc?: string
  deprecated?: boolean
}

export interface DomainMap {
  [domain: string]: string[]
}

export interface SdkIndex {
  generatedAt: number
  packages: { [name: string]: PackageIndex }
  symbolIndex: { [symbol: string]: SymbolEntry[] }
  domainMap: DomainMap
}

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: unknown
}

export interface ToolResponse {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

export interface ValidImportResult {
  valid: boolean
  importPath?: string
  symbolFound?: boolean
  reason?: string
}

export interface ScaffoldResult {
  files: Array<{ path: string; content: string }>
}

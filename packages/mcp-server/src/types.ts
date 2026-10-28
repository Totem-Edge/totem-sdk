export type DependencyKind = 'runtime' | 'peer' | 'optional' | 'dev'

export interface DependencyEdge {
  from: string
  to: string
  kind: DependencyKind
  range: string
}

export interface PackageIndex {
  name: string
  dir: string
  version: string
  description: string
  keywords?: string[]
  dependencies: string[]
  devDependencies: string[]
  /** Declared dependency groups with ranges, when known. */
  dependencyGroups?: Partial<Record<DependencyKind, Record<string, string>>>
  /** Package.json export subpaths and their runtime conditions. */
  exportsMap?: Record<string, unknown>
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

export interface IndexCoverage {
  /** Entries in the selected catalogue (SDK_MANIFEST.json). */
  manifestCount: number;
  /** Package directories discovered in the workspace. */
  discoveredCount: number;
  /** Catalogue entries with no indexed package. */
  missingFromIndex: string[];
  /** Indexed packages not declared in the catalogue. */
  extraInIndex: string[];
}

export interface SdkIndex {
  /** Index schema version; bump when consumers must adapt. */
  schemaVersion?: number;
  /** Where this index came from. */
  source?: 'monorepo' | 'bundled';
  /** Git revision of the scanned workspace, when known. */
  sourceRevision?: string;
  /** Catalogue/index coverage reconciliation. */
  coverage?: IndexCoverage;
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
  dependencyKind?: 'runtime' | 'peer' | 'optional' | 'dev' | 'none'
  subpath?: string
  condition?: string
  reason?: string
}

export interface ScaffoldResult {
  files: Array<{ path: string; content: string }>
}

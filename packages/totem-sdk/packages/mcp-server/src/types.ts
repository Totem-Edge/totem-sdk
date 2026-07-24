export interface PackageIndex {
  name: string
  dir: string
  version: string
  description: string
  dependencies: string[]
  devDependencies: string[]
  hasRust: boolean
  hasGo: boolean
  hasTests: boolean
  exports: PackageExports
  domain: string
}

export interface PackageExports {
  functions: string[]
  types: string[]
  classes: string[]
  interfaces: string[]
  consts: string[]
}

export interface SymbolEntry {
  package: string
  kind: 'function' | 'type' | 'class' | 'interface' | 'const' | 'variable'
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

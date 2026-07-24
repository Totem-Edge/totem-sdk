import * as fs from 'fs'
import * as path from 'path'
import type { PackageIndex, PackageExports, SdkIndex, SymbolEntry, DomainMap } from './types.js'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const PKG_DIR = path.join(REPO_ROOT, 'packages', 'totem-sdk', 'packages')
const TOP_PKG_DIR = path.join(REPO_ROOT, 'packages')

const DOMAIN_GROUPS: [RegExp, string][] = [
  [/^core-wasm$|^core$|^txpow$|^kissvm$/, 'core/crypto'],
  [/^identity$|^root-identity$|^authority$|^proof$|^proof-integritas$|^proofgraph$|^manifest$/, 'identity/authority'],
  [/^governance$|^recursive-mast$/, 'governance'],
  [/^edge$|^edge-adapters$|^industrial-action$|^agent-policy$/, 'edge/runtime'],
  [/^edge-(bacnet|ble|can|coap|grpc|lorawan|matter|modbus|mqtt|opcua|ros2)$/, 'edge/protocols'],
  [/^omnia(-factory|-router|-splice|-vtxo)?$/, 'blockchain/omnia'],
  [/^statechain$|^tx-builder$|^chain-provider$|^wots-lease$|^liquidity-bond$|^provider-bond$/, 'blockchain/infra'],
  [/^lookup-(client|node|protocol)$/, 'lookup/p2p'],
  [/^stream-transport$|^pubsub-transport$|^pureminima-rpc$|^server$|^se-server$|^realtime$|^connect$|^wallet-adapter$|^pear$|^observability$/, 'utilities'],
  [/^sdk-tests$/, 'testing'],
]

function classifyDomain(dirName: string): string {
  for (const [pattern, domain] of DOMAIN_GROUPS) {
    if (pattern.test(dirName)) return domain
  }
  return 'other'
}

function findPackageDirs(): string[] {
  const dirs: string[] = []
  for (const base of [PKG_DIR, TOP_PKG_DIR]) {
    if (!fs.existsSync(base)) continue
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pj = path.join(base, entry.name, 'package.json')
      if (fs.existsSync(pj)) dirs.push(path.join(base, entry.name))
    }
  }
  return dirs.sort()
}

function readPackageJson(dir: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
  } catch { return null }
}

function hasSubdir(dir: string, name: string): boolean {
  const d = path.join(dir, name)
  return fs.existsSync(d) && fs.statSync(d).isDirectory()
}

function hasTestDir(dir: string): boolean {
  const srcTest = path.join(dir, 'src', '__tests__')
  const srcTestAlt = path.join(dir, 'src', 'test')
  const testDir = path.join(dir, 'test')
  const testsDir = path.join(dir, 'tests')
  return [srcTest, srcTestAlt, testDir, testsDir].some(d => fs.existsSync(d))
}

function parseExports(dir: string, pkgName: string): PackageExports {
  const indexFiles = [
    path.join(dir, 'src', 'index.ts'),
    path.join(dir, 'src', 'index.js'),
  ]
  let content = ''
  for (const f of indexFiles) {
    if (fs.existsSync(f)) { content = fs.readFileSync(f, 'utf-8'); break }
  }
  const exports: PackageExports = { functions: [], types: [], classes: [], interfaces: [], consts: [] }
  if (!content) return exports

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    const fnMatch = trimmed.match(/^export (async )?function (\w+)/)
    if (fnMatch) { exports.functions.push(fnMatch[2]); continue }
    const typeMatch = trimmed.match(/^export type \{ ([^}]+) \}/)
    if (typeMatch) {
      typeMatch[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
        const name = s.split(/\s+as\s+/).pop()?.trim() || s
        if (name) exports.types.push(name)
      })
      continue
    }
    const clsMatch = trimmed.match(/^export class (\w+)/)
    if (clsMatch) { exports.classes.push(clsMatch[1]); continue }
    const ifaceMatch = trimmed.match(/^export interface (\w+)/)
    if (ifaceMatch) { exports.interfaces.push(ifaceMatch[1]); continue }
    const constMatch = trimmed.match(/^export (const|let|var) (\w+)/)
    if (constMatch) { exports.consts.push(constMatch[2]); continue }
    const namedExport = trimmed.match(/^export \{ ([^}]+) \}/)
    if (namedExport) {
      for (const part of namedExport[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim() || ''
        if (name && !name.startsWith('type ') && name !== 'type') {
          if (name.endsWith('}')) continue
          if (/^[A-Z]/.test(name)) exports.types.push(name)
          else exports.functions.push(name)
        }
      }
    }
  }
  return exports
}

export function buildIndex(): SdkIndex {
  const packages: { [name: string]: PackageIndex } = {}
  const symbolIndex: { [symbol: string]: SymbolEntry[] } = {}
  const domainMap: DomainMap = {}

  for (const dir of findPackageDirs()) {
    const pkg = readPackageJson(dir)
    if (!pkg || !pkg.name) continue
    const dirName = path.basename(dir)
    const deps = Object.keys(pkg.dependencies || {})
    const devDeps = Object.keys(pkg.devDependencies || {})
    const hasRust = hasSubdir(dir, 'rust') || hasSubdir(dir, 'rust-toolchain')
    const hasGo = hasSubdir(dir, 'go')
    const hasTests = hasTestDir(dir)
    const exports = parseExports(dir, pkg.name)
    const domain = classifyDomain(dirName)

    const idx: PackageIndex = {
      name: pkg.name,
      dir: dirName,
      version: pkg.version || '0.0.0',
      description: pkg.description || '',
      dependencies: deps,
      devDependencies: devDeps,
      hasRust,
      hasGo,
      hasTests,
      exports,
      domain,
    }
    packages[pkg.name] = idx
    if (!domainMap[domain]) domainMap[domain] = []
    domainMap[domain].push(pkg.name)

    const allExports: Array<[string, 'function' | 'type' | 'class' | 'interface' | 'const']> = []
    for (const n of exports.functions) allExports.push([n, 'function'])
    for (const n of exports.types) allExports.push([n, 'type'])
    for (const n of exports.classes) allExports.push([n, 'class'])
    for (const n of exports.interfaces) allExports.push([n, 'interface'])
    for (const n of exports.consts) allExports.push([n, 'const'])
    for (const [name, kind] of allExports) {
      if (!symbolIndex[name]) symbolIndex[name] = []
      symbolIndex[name].push({ package: pkg.name, kind })
    }
  }

  return { generatedAt: Date.now(), packages, symbolIndex, domainMap }
}

export function readSourceFile(pkgName: string, filePath: string): string | null {
  const relativePath = path.join('packages', 'totem-sdk', 'packages', pkgName, 'src', filePath)
  const absPath = path.join(REPO_ROOT, relativePath)
  const altPath = path.join(REPO_ROOT, 'packages', pkgName, 'src', filePath)
  for (const p of [absPath, altPath]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8')
  }
  return null
}

import * as fs from 'fs'
import * as path from 'path'
import type { PackageIndex, PackageExports, SdkIndex, SymbolEntry, DomainMap } from './types.js'

function findRepoRoot(): string {
  let dir = path.resolve(__dirname)
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = path.dirname(dir)
  }
  return dir
}

const REPO_ROOT = findRepoRoot()
const TOP_PKG_DIR = path.join(REPO_ROOT, 'packages')
const MANIFEST_PATH = path.join(REPO_ROOT, 'SDK_MANIFEST.json')

/**
 * The SDK manifest (`SDK_MANIFEST.json`) is the canonical source of truth for
 * the package set, versions, descriptions and domain grouping. The filesystem is
 * used only to parse source exports. This prevents the domain/package drift that
 * hand-maintained heuristics previously caused.
 */
interface ManifestPackage {
  version?: string
  description?: string
  domain?: string
}

interface Manifest {
  total?: number
  packages?: Array<{ name?: string } & ManifestPackage>
}

function loadManifest(): Map<string, ManifestPackage> {
  const map = new Map<string, ManifestPackage>()
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as Manifest
    for (const pkg of manifest.packages ?? []) {
      if (pkg && typeof pkg.name === 'string') {
        map.set(pkg.name, { version: pkg.version, description: pkg.description, domain: pkg.domain })
      }
    }
  } catch {
    // Manifest missing/unreadable — fall back to filesystem discovery only.
  }
  return map
}

const MANIFEST = loadManifest()

function findPackageDirs(): string[] {
  const dirs: string[] = []
  if (!fs.existsSync(TOP_PKG_DIR)) return dirs
  for (const entry of fs.readdirSync(TOP_PKG_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pj = path.join(TOP_PKG_DIR, entry.name, 'package.json')
    if (fs.existsSync(pj)) dirs.push(path.join(TOP_PKG_DIR, entry.name))
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
  const candidates = [
    path.join(dir, 'src', '__tests__'),
    path.join(dir, 'src', 'test'),
    path.join(dir, 'test'),
    path.join(dir, 'tests'),
  ]
  return candidates.some(d => fs.existsSync(d))
}

/** Resolve a relative TS module specifier (`./x.js` → `src/x.ts` or `src/x/index.ts`). */
function resolveModule(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), spec.replace(/\.js$/, ''))
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

function pushUnique(list: string[], name: string): void {
  if (name && !name.endsWith('}') && !list.includes(name)) list.push(name)
}

/**
 * Collect exports from a module, following local `export * from './x.js'`
 * re-exports (bounded by a visited set) so barrel packages (core, qvac, storage,
 * server, tx-builder, omnia-vtxo, pear) are indexed correctly.
 */
function collectExports(file: string, exports: PackageExports, visited: Set<string>): void {
  if (visited.has(file)) return
  visited.add(file)

  let content: string
  try { content = fs.readFileSync(file, 'utf-8') } catch { return }
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()

    const starAsMatch = trimmed.match(/^export \* as (\w+) from ['"]([^'"]+)['"]/)
    if (starAsMatch) {
      pushUnique(exports.types, starAsMatch[1])
      const target = resolveModule(file, starAsMatch[2])
      if (target) collectExports(target, exports, visited)
      i++; continue
    }

    const starMatch = trimmed.match(/^export \* from ['"]([^'"]+)['"]/)
    if (starMatch) {
      const target = resolveModule(file, starMatch[1])
      if (target) collectExports(target, exports, visited)
      i++; continue
    }

    const fnMatch = trimmed.match(/^export (async )?function (\w+)/)
    if (fnMatch) { pushUnique(exports.functions, fnMatch[2]); i++; continue }

    const clsMatch = trimmed.match(/^export class (\w+)/)
    if (clsMatch) { pushUnique(exports.classes, clsMatch[1]); i++; continue }

    const ifaceMatch = trimmed.match(/^export interface (\w+)/)
    if (ifaceMatch) { pushUnique(exports.interfaces, ifaceMatch[1]); i++; continue }

    const constMatch = trimmed.match(/^export (const|let|var) (\w+)/)
    if (constMatch) { pushUnique(exports.consts, constMatch[2]); i++; continue }

    const typeDeclMatch = trimmed.match(/^export type (\w+)/)
    if (typeDeclMatch) { pushUnique(exports.types, typeDeclMatch[1]); i++; continue }

    // Multi-line `export { ... }` / `export type { ... }` (inline or re-export).
    if (trimmed.startsWith('export {') || trimmed.startsWith('export type {')) {
      const isType = trimmed.startsWith('export type {')
      let block = trimmed
      let j = i
      while (!block.includes('}') && j < lines.length - 1) {
        j++
        block += ' ' + lines[j].trim()
      }
      const braceMatch = block.match(/\{([^}]+)\}/)
      if (braceMatch) {
        for (const part of braceMatch[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/).pop()?.trim() || ''
          if (!name) continue
          if (isType) pushUnique(exports.types, name)
          else if (/^[A-Z]/.test(name)) pushUnique(exports.types, name)
          else pushUnique(exports.functions, name)
        }
      }
      i = j + 1
      continue
    }

    i++
  }
}

function parseExports(dir: string): PackageExports {
  const exports: PackageExports = { functions: [], types: [], classes: [], interfaces: [], consts: [] }
  const candidates = [path.join(dir, 'src', 'index.ts'), path.join(dir, 'src', 'index.js')]
  const entry = candidates.find(f => fs.existsSync(f))
  if (!entry) return exports
  collectExports(entry, exports, new Set())
  return exports
}

export function buildIndex(): SdkIndex {
  const packages: { [name: string]: PackageIndex } = {}
  const symbolIndex: { [symbol: string]: SymbolEntry[] } = {}
  const domainMap: DomainMap = {}

  for (const dir of findPackageDirs()) {
    const pkg = readPackageJson(dir)
    if (!pkg || !pkg.name) continue
    // Manifest is canonical: index only SDK packages it declares.
    const manifest = MANIFEST.get(pkg.name)
    if (MANIFEST.size > 0 && !manifest) continue

    const dirName = path.basename(dir)
    const exports = parseExports(dir)
    const domain = manifest?.domain || 'other'

    const idx: PackageIndex = {
      name: pkg.name,
      dir: dirName,
      version: manifest?.version || pkg.version || '0.0.0',
      description: manifest?.description || pkg.description || '',
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      hasRust: hasSubdir(dir, 'rust') || hasSubdir(dir, 'rust-toolchain'),
      hasGo: hasSubdir(dir, 'go'),
      hasTests: hasTestDir(dir),
      exports,
      domain,
    }
    packages[pkg.name] = idx
    if (!domainMap[domain]) domainMap[domain] = []
    domainMap[domain].push(pkg.name)

    const allExports: Array<[string, SymbolEntry['kind']]> = [
      ...exports.functions.map((n): [string, SymbolEntry['kind']] => [n, 'function']),
      ...exports.types.map((n): [string, SymbolEntry['kind']] => [n, 'type']),
      ...exports.classes.map((n): [string, SymbolEntry['kind']] => [n, 'class']),
      ...exports.interfaces.map((n): [string, SymbolEntry['kind']] => [n, 'interface']),
      ...exports.consts.map((n): [string, SymbolEntry['kind']] => [n, 'const']),
    ]
    for (const [name, kind] of allExports) {
      (symbolIndex[name] ??= []).push({ package: pkg.name, kind })
    }
  }

  return { generatedAt: Date.now(), packages, symbolIndex, domainMap }
}

/** Map a package name (`@totemsdk/core`) or dir (`core`) to its absolute directory. */
const _pkgDirCache = new Map<string, string | null>()
function packageDir(name: string): string | null {
  if (_pkgDirCache.has(name)) return _pkgDirCache.get(name) ?? null
  const direct = path.join(TOP_PKG_DIR, name)
  if (fs.existsSync(path.join(direct, 'package.json'))) {
    _pkgDirCache.set(name, direct)
    return direct
  }
  if (fs.existsSync(TOP_PKG_DIR)) {
    for (const entry of fs.readdirSync(TOP_PKG_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(TOP_PKG_DIR, entry.name)
      const pj = path.join(dir, 'package.json')
      if (!fs.existsSync(pj)) continue
      try {
        if (JSON.parse(fs.readFileSync(pj, 'utf-8')).name === name) {
          _pkgDirCache.set(name, dir)
          return dir
        }
      } catch { /* ignore unreadable package.json */ }
    }
  }
  _pkgDirCache.set(name, null)
  return null
}

/** Read a file from a package's `src/` directory (for the `read-source` tool). */
export function readSourceFile(pkgName: string, filePath: string): string | null {
  const dir = packageDir(pkgName)
  if (!dir) return null
  const base = path.resolve(dir, 'src')
  // Prevent path traversal outside the package src root.
  const resolved = path.resolve(base, filePath)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : null
}

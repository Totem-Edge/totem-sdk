import * as fs from 'fs'
import * as path from 'path'
import type { PackageIndex, PackageExports, SdkIndex, SymbolEntry, SymbolKind, SymbolMeta, DomainMap } from './types.js'

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

interface ManifestPackage {
  version?: string
  description?: string
  domain?: string
}

interface Manifest {
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

function resolveModule(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), spec.replace(/\.js$/, ''))
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

/** Leading JSDoc (`/** … *​/`) or contiguous `//` comment above a declaration. */
function leadingDoc(lines: string[], lineIndex: number): { doc?: string; deprecated?: boolean } {
  let j = lineIndex - 1
  while (j >= 0 && lines[j].trim() === '') j--
  if (j < 0) return {}
  const t = lines[j].trim()

  if (t.endsWith('*/')) {
    const parts: string[] = []
    let k = j
    while (k >= 0) {
      const line = lines[k].trim()
      parts.unshift(line)
      if (line.startsWith('/**') || line.startsWith('/*')) break
      k--
    }
    const raw = parts
      .join('\n')
      .replace(/^\/\*\*?/, '')
      .replace(/\*\/$/, '')
      .split('\n')
      .map(l => l.replace(/^\s*\* ?/, ''))
      .join('\n')
      .trim()
    const deprecated = /@deprecated/.test(raw)
    const stripped = raw.replace(/@\w+[^\n]*/g, '').replace(/\n{2,}/g, '\n').trim()
    return { doc: stripped || raw, ...(deprecated ? { deprecated } : {}) }
  }

  if (t.startsWith('//')) {
    const parts: string[] = []
    let k = j
    while (k >= 0 && lines[k].trim().startsWith('//')) {
      parts.unshift(lines[k].trim().replace(/^\/\/ ?/, ''))
      k--
    }
    const raw = parts.join('\n').trim()
    return { doc: raw, ...(/@deprecated/.test(raw) ? { deprecated: true } : {}) }
  }
  return {}
}

/** Best-effort declaration text up to the body/terminator. */
function captureSignature(lines: string[], startIdx: number, stopAtBrace: boolean): string {
  let text = ''
  for (let j = startIdx; j < Math.min(lines.length, startIdx + 8); j++) {
    text += (j > startIdx ? ' ' : '') + lines[j].trim()
    const brace = text.indexOf('{')
    const semi = text.indexOf(';')
    let cut = -1
    if (stopAtBrace) {
      if (brace >= 0) cut = brace
      else if (semi >= 0) cut = semi
    } else {
      if (semi >= 0) cut = semi
      else if (brace >= 0) cut = brace
    }
    if (cut >= 0) { text = text.slice(0, cut); break }
  }
  return text.replace(/\s+/g, ' ').replace(/^export\s+/, '').replace(/[,\s]+$/, '').trim()
}

const KIND_TO_ARRAY: Record<SymbolKind, keyof PackageExports> = {
  function: 'functions',
  type: 'types',
  class: 'classes',
  interface: 'interfaces',
  const: 'consts',
  variable: 'consts',
}

function setSymbol(symbols: Map<string, SymbolMeta>, name: string, meta: SymbolMeta): void {
  if (name && !name.endsWith('}') && !symbols.has(name)) symbols.set(name, meta)
}

function collectExports(file: string, symbols: Map<string, SymbolMeta>, visited: Set<string>): void {
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
      setSymbol(symbols, starAsMatch[1], { kind: 'type', ...leadingDoc(lines, i) })
      const target = resolveModule(file, starAsMatch[2])
      if (target) collectExports(target, symbols, visited)
      i++; continue
    }

    const starMatch = trimmed.match(/^export \* from ['"]([^'"]+)['"]/)
    if (starMatch) {
      const target = resolveModule(file, starMatch[1])
      if (target) collectExports(target, symbols, visited)
      i++; continue
    }

    const fnMatch = trimmed.match(/^export (async )?function\*? (\w+)/)
    if (fnMatch) {
      setSymbol(symbols, fnMatch[2], { kind: 'function', signature: captureSignature(lines, i, true), ...leadingDoc(lines, i) })
      i++; continue
    }

    const clsMatch = trimmed.match(/^export (abstract )?class (\w+)/)
    if (clsMatch) {
      setSymbol(symbols, clsMatch[2], { kind: 'class', signature: captureSignature(lines, i, true), ...leadingDoc(lines, i) })
      i++; continue
    }

    const ifaceMatch = trimmed.match(/^export interface (\w+)/)
    if (ifaceMatch) {
      setSymbol(symbols, ifaceMatch[1], { kind: 'interface', signature: captureSignature(lines, i, true), ...leadingDoc(lines, i) })
      i++; continue
    }

    const constMatch = trimmed.match(/^export (const|let|var) (\w+)/)
    if (constMatch) {
      setSymbol(symbols, constMatch[2], { kind: 'const', signature: captureSignature(lines, i, false), ...leadingDoc(lines, i) })
      i++; continue
    }

    const typeMatch = trimmed.match(/^export type (\w+)\s*[=<]/)
    if (typeMatch) {
      setSymbol(symbols, typeMatch[1], { kind: 'type', signature: captureSignature(lines, i, false), ...leadingDoc(lines, i) })
      i++; continue
    }

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
          const kind: SymbolKind = isType || /^[A-Z]/.test(name) ? 'type' : 'function'
          setSymbol(symbols, name, { kind })
        }
      }
      i = j + 1
      continue
    }

    i++
  }
}

function parseExports(dir: string): { exports: PackageExports; symbols: Map<string, SymbolMeta> } {
  const symbols = new Map<string, SymbolMeta>()
  const candidates = [path.join(dir, 'src', 'index.ts'), path.join(dir, 'src', 'index.js')]
  const entry = candidates.find(f => fs.existsSync(f))
  if (entry) collectExports(entry, symbols, new Set())

  const exports: PackageExports = { functions: [], types: [], classes: [], interfaces: [], consts: [] }
  for (const [name, meta] of symbols) exports[KIND_TO_ARRAY[meta.kind]].push(name)
  return { exports, symbols }
}

export function buildIndex(): SdkIndex {
  const packages: { [name: string]: PackageIndex } = {}
  const symbolIndex: { [symbol: string]: SymbolEntry[] } = {}
  const domainMap: DomainMap = {}

  for (const dir of findPackageDirs()) {
    const pkg = readPackageJson(dir)
    if (!pkg || !pkg.name) continue
    const manifest = MANIFEST.get(pkg.name)
    if (MANIFEST.size > 0 && !manifest) continue

    const dirName = path.basename(dir)
    const { exports, symbols } = parseExports(dir)
    const domain = manifest?.domain || 'other'

    const idx: PackageIndex = {
      name: pkg.name,
      dir: dirName,
      version: manifest?.version || pkg.version || '0.0.0',
      description: manifest?.description || pkg.description || '',
      ...(Array.isArray(pkg.keywords) ? { keywords: pkg.keywords as string[] } : {}),
      dependencies: Object.keys(pkg.dependencies || {}),
      devDependencies: Object.keys(pkg.devDependencies || {}),
      hasRust: hasSubdir(dir, 'rust') || hasSubdir(dir, 'rust-toolchain'),
      hasGo: hasSubdir(dir, 'go'),
      hasTests: hasTestDir(dir),
      exports,
      symbols: Object.fromEntries(symbols),
      domain,
    }
    packages[pkg.name] = idx
    if (!domainMap[domain]) domainMap[domain] = []
    domainMap[domain].push(pkg.name)

    for (const [name, meta] of symbols) {
      (symbolIndex[name] ??= []).push({
        package: pkg.name,
        kind: meta.kind,
        ...(meta.signature !== undefined ? { signature: meta.signature } : {}),
        ...(meta.doc !== undefined ? { doc: meta.doc } : {}),
        ...(meta.deprecated ? { deprecated: true } : {}),
      })
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
  const resolved = path.resolve(base, filePath)
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null
  return fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : null
}

/**
 * TypeScript compiler-API symbol extraction for the MCP index.
 *
 * This is the "exact" layer: it builds a real Program per package and reads the
 * public exports through the type checker (barrels, aliases, overloads, JSDoc,
 * @deprecated). It is run at build/verify time, not at MCP startup, and its
 * output is committed as `scripts/mcp-symbols.ast.json`.
 *
 * Requires `typescript` (a monorepo dev dependency) and, for packages that
 * re-export workspace siblings, their built `dist` (run after a workspace build).
 */
import { createRequire } from 'module'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const require = createRequire(import.meta.url)
const ts = require('typescript')

function packageDirs(repoRoot) {
  const base = join(repoRoot, 'packages')
  if (!existsSync(base)) return new Map()
  const map = new Map()
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(base, entry.name)
    const pj = join(dir, 'package.json')
    if (!existsSync(pj)) continue
    try {
      const name = JSON.parse(readFileSync(pj, 'utf8')).name
      if (name) map.set(name, dir)
    } catch { /* ignore */ }
  }
  return map
}

function loadCompilerOptions(dir) {
  const defaults = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
    strict: false,
    allowJs: true,
    types: [],
  }
  const cfgPath = join(dir, 'tsconfig.json')
  if (!existsSync(cfgPath)) return defaults
  try {
    const read = ts.readConfigFile(cfgPath, ts.sys.readFile)
    if (!read.config) return defaults
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dir)
    return {
      ...parsed.options,
      noEmit: true,
      skipLibCheck: true,
      declaration: false,
      composite: false,
      incremental: false,
      types: parsed.options.types ?? [],
    }
  } catch {
    return defaults
  }
}

function classify(decl, sym) {
  if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) return 'function'
  if (ts.isClassDeclaration(decl)) return 'class'
  if (ts.isInterfaceDeclaration(decl)) return 'interface'
  if (ts.isTypeAliasDeclaration(decl) || ts.isTypeParameterDeclaration(decl)) return 'type'
  if (ts.isEnumDeclaration(decl) || ts.isModuleDeclaration(decl)) return 'type'
  if (ts.isVariableDeclaration(decl)) {
    return (sym.flags & ts.SymbolFlags.Function) ? 'function' : 'const'
  }
  if (sym.flags & ts.SymbolFlags.Class) return 'class'
  if (sym.flags & ts.SymbolFlags.Interface) return 'interface'
  if (sym.flags & ts.SymbolFlags.TypeAlias) return 'type'
  if (sym.flags & ts.SymbolFlags.Function) return 'function'
  if (sym.flags & ts.SymbolFlags.Enum || sym.flags & ts.SymbolFlags.EnumMember) return 'type'
  return 'const'
}

function renderSignature(checker, decl, name) {
  try {
    if (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl)) {
      const sig = checker.getSignatureFromDeclaration(decl)
      if (sig) return `${name}${checker.signatureToString(sig, decl, ts.TypeFormatFlags.NoTruncation)}`
    }
  } catch { /* fall through */ }
  try {
    let text = (decl.getText ? decl.getText() : '').replace(/\s+/g, ' ').trim()
    if (ts.isClassDeclaration(decl) || ts.isInterfaceDeclaration(decl) || ts.isEnumDeclaration(decl) || ts.isModuleDeclaration(decl)) {
      const brace = text.indexOf('{')
      if (brace >= 0) text = text.slice(0, brace)
    } else if (ts.isTypeAliasDeclaration(decl)) {
      const semi = text.indexOf(';')
      const brace = text.indexOf('{')
      const cut = semi >= 0 ? semi : brace >= 0 ? brace : text.length
      text = text.slice(0, cut)
    }
    text = text.replace(/;\s*$/, '').trim()
    return text ? text.slice(0, 200) : undefined
  } catch {
    return undefined
  }
}

function isDeprecated(sym, checker) {
  try {
    const tags = sym.getJsDocTags(checker)
    return Array.isArray(tags) && tags.some((t) => t.name === 'deprecated')
  } catch {
    return false
  }
}

function docText(sym, checker) {
  try {
    const doc = ts.displayPartsToString(sym.getDocumentationComment(checker))
    return doc || undefined
  } catch {
    return undefined
  }
}

function extractPackage(dir) {
  const entry = join(dir, 'src', 'index.ts')
  if (!existsSync(entry)) return null
  const program = ts.createProgram([entry], loadCompilerOptions(dir))
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(entry)
  if (!sourceFile) return null
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) return { symbols: {} }

  const symbols = {}
  for (const sym of checker.getExportsOfModule(moduleSymbol)) {
    const name = sym.getName()
    let target = sym
    if (sym.flags & ts.SymbolFlags.Alias) {
      try { target = checker.getAliasedSymbol(sym) } catch { target = sym }
    }
    const decl = (target.getDeclarations?.() || [])[0] || (sym.getDeclarations?.() || [])[0]
    if (!decl) continue
    const kind = classify(decl, target)
    const signature = renderSignature(checker, decl, name)
    const deprecated = isDeprecated(target, checker)
    const doc = docText(target, checker)
    symbols[name] = {
      kind,
      ...(signature !== undefined ? { signature } : {}),
      ...(deprecated ? { deprecated: true } : {}),
      ...(doc !== undefined ? { doc } : {}),
    }
  }
  return { symbols }
}

/** Build the full AST symbol index for the workspace. */
export function buildSymbolAst(repoRoot) {
  const dirs = packageDirs(repoRoot)
  const packages = {}
  for (const [name, dir] of [...dirs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pkg = extractPackage(dir)
    if (pkg) packages[name] = pkg
  }
  return { packages }
}

export const AST_ARTIFACT_PATH = (repoRoot) => join(repoRoot, 'scripts', 'mcp-symbols.ast.json')

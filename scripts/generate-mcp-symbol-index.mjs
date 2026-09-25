#!/usr/bin/env node
/**
 * Generate the committed AST symbol index used by @totemsdk/mcp-server.
 *
 * Runs the TypeScript compiler API over each workspace package (exact exports,
 * signatures, JSDoc, @deprecated) and writes `scripts/mcp-symbols.ast.json`.
 * Run after a workspace build (packages that re-export workspace siblings need
 * their dist). Regenerate deliberately; `verify-mcp-index.mjs` diffs against it.
 *
 * Usage: node scripts/generate-mcp-symbol-index.mjs
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { buildSymbolAst, AST_ARTIFACT_PATH } from './lib/symbol-ast.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = AST_ARTIFACT_PATH(ROOT)
mkdirSync(dirname(out), { recursive: true })

const started = Date.now()
const ast = buildSymbolAst(ROOT)
const pkgCount = Object.keys(ast.packages).length
const symCount = Object.values(ast.packages).reduce((n, p) => n + Object.keys(p.symbols).length, 0)

writeFileSync(out, JSON.stringify(ast, null, 2) + '\n')
console.log(`Wrote ${out} — ${pkgCount} packages, ${symCount} symbols in ${((Date.now() - started) / 1000).toFixed(1)}s`)

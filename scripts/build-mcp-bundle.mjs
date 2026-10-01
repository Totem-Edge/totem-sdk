#!/usr/bin/env node
/**
 * Build the bundled SDK index shipped inside @totemsdk/mcp-server.
 *
 * The published server must work outside the monorepo, so it cannot rely on
 * walking up from `__dirname` to find `pnpm-workspace.yaml`. This writes a
 * prebuilt `SdkIndex` to `packages/mcp-server/data/sdk-index.json`, which the
 * runtime loads as a fallback. Run after `tsc` (needs `dist/indexer.js`).
 *
 * Usage: node scripts/build-mcp-bundle.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = join(ROOT, 'packages', 'mcp-server')
const OUT = join(PKG, 'data', 'sdk-index.json')

const require = createRequire(import.meta.url)
const { buildFromMonorepo } = require(join(PKG, 'dist', 'indexer.js'))

const index = buildFromMonorepo(ROOT)
const pkgCount = Object.keys(index.packages).length
const symCount = Object.keys(index.symbolIndex).length

if (pkgCount === 0) {
  throw new Error('Refusing to write an empty SDK index bundle')
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(index) + '\n')
console.log(`Wrote ${OUT} — ${pkgCount} packages, ${symCount} symbols`)

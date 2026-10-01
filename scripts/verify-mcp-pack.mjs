#!/usr/bin/env node
/**
 * Packed-artifact gate for @totemsdk/mcp-server.
 *
 * Catches the four defects that shipped in 0.2.0:
 *   1. missing shebang on the packed bin,
 *   2. empty index outside the monorepo (findRepoRoot fallback),
 *   3. confident-wrong answers instead of errors,
 *   4. tool-catalog drift between packed dist and source.
 *
 * Installs the tarball as a real consumer (so transitive deps resolve) and
 * launches the packed bin from a clean cwd outside the monorepo.
 *
 * Usage: node scripts/verify-mcp-pack.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG_DIR = join(ROOT, 'packages', 'mcp-server')

const failures = []
const pass = (m) => console.log(`  ok    ${m}`)
const fail = (m) => { failures.push(m); console.error(`  FAIL  ${m}`) }
const run = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: 'utf8' })

const workDir = mkdtempSync(join(tmpdir(), 'mcp-pack-verify-'))
try {
  // ── 1. Pack ───────────────────────────────────────────────────────────────
  const pack = run('pnpm', ['pack', '--pack-destination', workDir], PKG_DIR)
  if (pack.status !== 0) throw new Error(`pnpm pack failed: ${pack.stderr || pack.stdout}`)
  const tarball = join(workDir, readdirSync(workDir).find((n) => n.endsWith('.tgz')))

  // ── 2. Install as a consumer (resolves @modelcontextprotocol/sdk) ──────────
  const app = join(workDir, 'app')
  mkdirSync(app, { recursive: true })
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'mcp-consumer', private: true }))
  const install = run('npm', ['install', '--no-audit', '--no-fund', tarball], app)
  if (install.status !== 0) throw new Error(`npm install failed: ${install.stderr || install.stdout}`)

  const installedRoot = join(app, 'node_modules', '@totemsdk', 'mcp-server')
  const binPath = join(installedRoot, 'dist', 'index.js')

  // ── 3. Shebang + exec bit ───────────────────────────────────────────────────
  if (!existsSync(binPath)) {
    fail('installed dist/index.js is missing')
  } else {
    const firstLine = readFileSync(binPath, 'utf8').split('\n', 1)[0]
    if (firstLine.startsWith('#!')) pass('packed bin has a shebang')
    else fail(`packed bin has no shebang (first line: ${JSON.stringify(firstLine)})`)
    const mode = statSync(binPath).mode
    if (mode & 0o111) pass('packed bin is executable')
    else fail(`packed bin is not executable (mode ${(mode & 0o777).toString(8)})`)
  }

  // ── 4. Bundled index present and non-empty ──────────────────────────────────
  const bundlePath = join(installedRoot, 'data', 'sdk-index.json')
  if (!existsSync(bundlePath)) {
    fail('bundled data/sdk-index.json is missing from the tarball')
  } else {
    const idx = JSON.parse(readFileSync(bundlePath, 'utf8'))
    const n = Object.keys(idx.packages ?? {}).length
    if (n > 0) pass(`bundled index has ${n} packages`)
    else fail('bundled index is empty')
  }

  // ── 5. Tool catalog parity (packed vs source build) ─────────────────────────
  const require = createRequire(import.meta.url)
  const packedTools = require(join(installedRoot, 'dist', 'tools.js')).TOOL_DEFINITIONS
  const sourceTools = require(join(PKG_DIR, 'dist', 'tools.js')).TOOL_DEFINITIONS
  if (packedTools.length === sourceTools.length) {
    pass(`tool catalog parity (${packedTools.length} tools)`)
  } else {
    fail(`tool count mismatch: packed=${packedTools.length} source=${sourceTools.length}`)
  }

  // ── 6. Clean-room launch via npx (shebang exec) + honest behaviour ──────────
  await cleanRoomLaunch(app, packedTools.length)
} catch (e) {
  fail(String(e?.message ?? e))
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\nverify-mcp-pack: ${failures.length} failure(s)`)
  process.exit(1)
}
console.log('\nverify-mcp-pack: all checks passed')

/**
 * Run the installed bin from a clean cwd (outside the monorepo), do an MCP stdio
 * handshake, and assert tools/list advertises the full catalog and an
 * index-backed tool returns real data rather than a confident "not found".
 */
async function cleanRoomLaunch(app, expectedToolCount) {
  const child = spawn('npx', ['--no-install', 'totemsdk-mcp'], {
    cwd: app,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => { stdout += d.toString() })
  child.stderr.on('data', (d) => { stderr += d.toString() })

  const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n')
  const waitFor = (id, ms) => new Promise((resolveLine, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      const line = stdout.split('\n').find((l) => l.trim() && JSON.parse(l)?.id === id)
      if (line) { clearInterval(timer); resolveLine(JSON.parse(line)) }
      else if (Date.now() - started > ms) {
        clearInterval(timer)
        reject(new Error(`timeout waiting for id ${id}; stderr=${stderr.slice(0, 300)}`))
      }
    }, 50)
  })

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'verify-mcp-pack', version: '0' } } })
    await waitFor(1, 20000)
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })

    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const toolsRes = await waitFor(2, 20000)
    const count = toolsRes?.result?.tools?.length ?? 0
    if (count === expectedToolCount) pass(`clean-room tools/list advertises ${count} tools`)
    else fail(`clean-room tools/list advertised ${count}, expected ${expectedToolCount}`)

    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search-packages', arguments: { query: 'wots lease' } } })
    const callRes = await waitFor(3, 20000)
    const text = callRes?.result?.content?.[0]?.text ?? ''
    if (callRes?.result?.isError) fail(`clean-room search-packages errored: ${text}`)
    else if (/@totemsdk\//.test(text)) pass('clean-room index-backed tool returned real data')
    else fail(`clean-room index-backed tool returned no real data: ${JSON.stringify(text).slice(0, 160)}`)
  } finally {
    child.kill('SIGKILL')
  }
}

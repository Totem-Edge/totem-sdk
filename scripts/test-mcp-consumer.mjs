#!/usr/bin/env node
/**
 * Packed-consumer smoke test for @totemsdk/mcp-server.
 *
 * Installs the tarball in a fresh temporary project and talks to the real
 * server over MCP stdio. This catches bundled-index, resource-URI and
 * packed-install failures that unit tests inside the monorepo cannot.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = join(ROOT, 'packages', 'mcp-server')
const temp = mkdtempSync(join(tmpdir(), 'totem-mcp-consumer-'))

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
}

try {
  const packed = run('npm', ['pack', '--ignore-scripts', '--pack-destination', temp], PKG).trim().split('\n')
  const tarball = join(temp, packed[packed.length - 1].trim())
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  // Install the packed layout without a registry round-trip. The dependency is
  // symlinked from this workspace so the test stays hermetic in CI.
  const installDir = join(temp, 'node_modules', '@totemsdk', 'mcp-server')
  mkdirSync(installDir, { recursive: true })
  run('tar', ['-xzf', tarball, '-C', installDir, '--strip-components=1'], temp)
  mkdirSync(join(temp, 'node_modules', '@modelcontextprotocol'), { recursive: true })
  symlinkSync(join(ROOT, 'packages', 'mcp-server', 'node_modules', '@modelcontextprotocol', 'sdk'), join(temp, 'node_modules', '@modelcontextprotocol', 'sdk'), 'dir')

  const consumer = join(temp, 'consumer.mjs')
  writeFileSync(consumer, `
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const server = require.resolve('@totemsdk/mcp-server')
const client = new Client({ name: 'packed-consumer', version: '1.0.0' })
const transport = new StdioClientTransport({ command: process.execPath, args: [server] })
await client.connect(transport)
const tools = await client.listTools()
if (!tools.tools.some((t) => t.name === 'list-packages')) throw new Error('list-packages missing')
const packages = await client.callTool({ name: 'list-packages', arguments: {} })
const text = packages.content?.[0]?.text ?? ''
const count = (text.match(/@totemsdk\\//g) ?? []).length
if (count < 69) throw new Error('packed index has only ' + count + ' packages')
const scoped = await client.readResource({ uri: 'totemsdk://packages/%40totemsdk%2Fproof' })
if (!scoped.contents?.[0]?.text?.includes('@totemsdk/proof')) throw new Error('scoped resource failed')
const provenance = await client.readResource({ uri: 'totemsdk://index' })
const meta = JSON.parse(provenance.contents[0].text)
if (meta.packageCount < 69 || !meta.sourceRevision) throw new Error('bundle provenance incomplete: ' + provenance.contents[0].text)
console.log('Packed MCP consumer passed: ' + meta.packageCount + ' packages, revision ' + meta.sourceRevision.slice(0, 12))
await client.close()
`)
  console.log(run(process.execPath, [consumer], temp).trim())
} finally {
  rmSync(temp, { recursive: true, force: true })
}

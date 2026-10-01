#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { getIndex, getIndexState } from './index-store.js'
import { handleResourceRead, listResources, resourceMimeType } from './resources.js'
import { handleToolCall, TOOL_DEFINITIONS } from './tools.js'
import * as fs from 'fs'
import * as path from 'path'

function readPkgVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const server = new Server(
  { name: '@totemsdk/mcp-server', version: readPkgVersion() },
  { capabilities: { resources: {}, tools: {}, prompts: {} } },
)

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const state = getIndexState()
  // Still advertise resources when the index is unavailable so clients see the
  // server is alive; reads then fail with an actionable message.
  return { resources: listResources(state.ok ? state.index : ({} as any)) }
})

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params
  const state = getIndexState()
  if (!state.ok) {
    throw new Error(`Resource unavailable: ${state.error}`)
  }
  const text = handleResourceRead(uri, state.index)
  if (text === null) {
    throw new Error(`Resource not found: ${uri}`)
  }
  return { contents: [{ uri, mimeType: resourceMimeType(uri), text }] }
})

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}))

/**
 * Tools that read the SDK index. The rest (scaffolding, template suggestions)
 * work without it, so a missing index degrades honestly instead of failing
 * everything.
 */
const INDEX_REQUIRED_TOOLS = new Set([
  'search-symbol',
  'find-type',
  'dependency-graph',
  'validate-import',
  'package-stats',
  'list-exports',
  'read-source',
  'list-packages',
  'search-packages',
  'refresh-index',
])

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params
  const state = getIndexState()
  if (!state.ok && INDEX_REQUIRED_TOOLS.has(name)) {
    return {
      content: [{ type: 'text', text: `SDK index unavailable: ${state.error}` }],
      isError: true,
    } as any
  }
  // Index-free tools ignore the index argument; pass the real one when present.
  return handleToolCall(name, args || {}, state.ok ? state.index : ({} as any)) as any
})

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'analyze-cross-package',
      description: 'Analyze relationships and dependencies between two packages',
      arguments: [
        { name: 'from', description: 'First package name', required: true },
        { name: 'to', description: 'Second package name', required: true },
      ],
    },
    {
      name: 'new-edge-adapter',
      description: 'Walk through creating a new edge protocol adapter step by step',
      arguments: [
        { name: 'protocol', description: 'Protocol name (e.g. MQTT, OPC-UA)', required: true },
      ],
    },
  ],
}))

server.setRequestHandler(GetPromptRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params

  const indexState = getIndexState()
  if (!indexState.ok) {
    throw new Error(`SDK index unavailable: ${indexState.error}`)
  }
  const index = indexState.index

  if (name === 'analyze-cross-package') {
    const from: string = args?.from
    const to: string = args?.to
    const fromPkg = from ? index.packages[from] : null
    const toPkg = to ? index.packages[to] : null
    if (!fromPkg || !toPkg) {
      throw new Error(`Packages not found: ${!fromPkg ? from : ''} ${!toPkg ? to : ''}`)
    }
    const dependsOn = fromPkg.dependencies.includes(to)
    const dependedBy = toPkg.dependencies.includes(from)
    const fromExports = Object.entries(fromPkg.exports).flatMap(([k, v]) => (v as string[]).map((s: string) => `${s} (${k})`))
    const toExports = Object.entries(toPkg.exports).flatMap(([k, v]) => (v as string[]).map((s: string) => `${s} (${k})`))
    const lines = [
      `Analyze the relationship between **${from}** and **${to}**:`,
      '',
      `| | ${from} | ${to} |`,
      `|---|---|---|`,
      `| Version | ${fromPkg.version} | ${toPkg.version} |`,
      `| Domain | ${fromPkg.domain} | ${toPkg.domain} |`,
      `| Has Rust | ${fromPkg.hasRust} | ${toPkg.hasRust} |`,
      `| Has Go | ${fromPkg.hasGo} | ${toPkg.hasGo} |`,
      `| Tests | ${fromPkg.hasTests} | ${toPkg.hasTests} |`,
      `| Exports | ${fromExports.length} | ${toExports.length} |`,
      '',
      `**Dependency direction:** ${from} \u2192 ${to}: ${dependsOn ? 'Yes' : 'No'}`,
      `${to} \u2192 ${from}: ${dependedBy ? 'Yes' : 'No'}`,
      '',
      dependsOn ? `**${from}** depends on **${to}**.` : '',
      dependedBy ? `**${to}** depends on **${from}**.` : '',
      !dependsOn && !dependedBy ? 'These packages have no direct dependency relationship.' : '',
      '',
      `**${from}** exports: ${fromExports.join(', ')}`,
      '',
      `**${to}** exports: ${toExports.join(', ')}`,
    ]
    return {
      messages: [{ role: 'user', content: { type: 'text', text: lines.filter(Boolean).join('\n') } }],
    }
  }

  if (name === 'new-edge-adapter') {
    const protocol: string = args?.protocol || 'UnknownProtocol'
    const existingAdapters = Object.values(index.packages).filter(p => p.domain === 'edge/protocols' && p.dir.startsWith('edge-'))
    const lines = [
      `You are scaffolding a new **${protocol}** edge protocol adapter for Totem SDK.`,
      '',
      `**Reference:** ${existingAdapters.length} existing protocol adapters:`,
      ...existingAdapters.map(p => `  - **${p.name}** — ${p.description}`),
      '',
      '**Required pattern for all edge adapters:**',
      `1. Zero runtime protocol dependencies — inject via \`${protocol}TransportPort\``,
      `2. Export \`create${protocol}Gateway\` and \`create${protocol}SensorBridge\` factory functions`,
      `3. Export \`${protocol}TransportPort\` interface for users to implement`,
      `4. Export gateway, sensor bridge, and binding config types`,
      `5. Depend only on \`@totemsdk/edge\``,
      '',
      '**Files to create:**',
      `- \`src/transport.ts\` — \`${protocol}TransportPort\` interface`,
      `- \`src/gateway.ts\` — gateway factory with config type`,
      `- \`src/sensor-bridge.ts\` — sensor bridge factory with binding config`,
      `- \`src/index.ts\` — barrel exports`,
      `- \`package.json\` — \`@totemsdk/edge-${protocol.toLowerCase()}\` with \`@totemsdk/edge\` dep`,
      '- `tsconfig.json` — standard Totem SDK config',
      '',
      'Use the `scaffold-adapter` tool to generate the boilerplate, then fill in the protocol-specific logic.',
    ]
    return {
      messages: [{ role: 'user', content: { type: 'text', text: lines.join('\n') } }],
    }
  }

  throw new Error(`Prompt not found: ${name}`)
})

export const SERVER_INFO = {
  name: '@totemsdk/mcp-server',
  version: readPkgVersion(),
  capabilities: { resources: {}, tools: {}, prompts: {} },
} as const

/**
 * @deprecated Importing this at module load forces index construction. Prefer
 * `getIndexState()`/`getIndex()` so a missing index is handled, not thrown.
 */
export const sdkIndex = (() => {
  const state = getIndexState()
  return state.ok ? state.index : ({ generatedAt: 0, packages: {}, symbolIndex: {}, domainMap: {} } as ReturnType<typeof getIndex>)
})()

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('@totemsdk/mcp-server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

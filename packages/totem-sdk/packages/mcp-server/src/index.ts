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
import { buildIndex } from './indexer.js'
import { handleResourceRead, listResources } from './resources.js'
import { handleToolCall } from './tools.js'
import type { SdkIndex } from './types.js'

const index: SdkIndex = buildIndex()

const server = new Server(
  { name: '@totemsdk/mcp-server', version: '0.1.0' },
  { capabilities: { resources: {}, tools: {}, prompts: {} } },
)

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: listResources(index),
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params
  const text = handleResourceRead(uri, index)
  if (text === null) {
    throw new Error(`Resource not found: ${uri}`)
  }
  return { contents: [{ uri, mimeType: 'text/plain', text }] }
})

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search-symbol',
      description: 'Search for a symbol (function, type, class) across all packages',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Partial symbol name to search' } },
        required: ['query'],
      },
    },
    {
      name: 'find-type',
      description: 'Find type definitions (interfaces, classes, type aliases) matching a pattern',
      inputSchema: {
        type: 'object',
        properties: { pattern: { type: 'string', description: 'Type name pattern to search' } },
        required: ['pattern'],
      },
    },
    {
      name: 'dependency-graph',
      description: 'Get dependency graph for a package — inbound dependents or outbound dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          package: { type: 'string', description: 'Package name (e.g. @totemsdk/edge-opcua)' },
          direction: { type: 'string', enum: ['in', 'out', 'all'], description: 'Dependency direction' },
        },
        required: ['package'],
      },
    },
    {
      name: 'validate-import',
      description: 'Check whether a cross-package import is valid',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source package name' },
          to: { type: 'string', description: 'Target package name' },
          symbol: { type: 'string', description: 'Optional: specific symbol to check' },
        },
        required: ['from', 'to'],
      },
    },
    {
      name: 'scaffold-adapter',
      description: 'Generate boilerplate for a new edge protocol adapter',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Package name suffix' },
          protocol: { type: 'string', description: 'Protocol name (PascalCase)' },
          commands: { type: 'array', items: { type: 'string' }, description: 'Transport port methods' },
        },
        required: ['name', 'protocol'],
      },
    },
    {
      name: 'scaffold-package',
      description: 'Generate boilerplate for a new @totemsdk package',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Package name (without @totemsdk/ prefix)' },
          deps: { type: 'array', items: { type: 'string' }, description: 'Dependency package names' },
        },
        required: ['name'],
      },
    },
    {
      name: 'package-stats',
      description: 'Get statistics about a package — export counts, Rust/Go, tests, deps',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Package name' } },
        required: ['name'],
      },
    },
    {
      name: 'list-exports',
      description: 'List exports of a package',
      inputSchema: {
        type: 'object',
        properties: {
          package: { type: 'string', description: 'Package name' },
          kind: { type: 'string', enum: ['function', 'type', 'interface', 'class', 'const', ''], description: 'Filter by export kind' },
          filter: { type: 'string', description: 'Filter by name substring' },
        },
        required: ['package'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params
  return handleToolCall(name, args || {}, index) as any
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

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('@totemsdk/mcp-server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})

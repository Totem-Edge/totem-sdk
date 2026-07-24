import type { SdkIndex, ToolResponse, ValidImportResult, ScaffoldResult } from './types.js'

export function handleToolCall(name: string, args: any, index: SdkIndex): ToolResponse {
  switch (name) {
    case 'search-symbol': return searchSymbol(args, index)
    case 'find-type': return findType(args, index)
    case 'dependency-graph': return dependencyGraph(args, index)
    case 'validate-import': return validateImport(args, index)
    case 'scaffold-adapter': return scaffoldAdapter(args)
    case 'scaffold-package': return scaffoldPackage(args)
    case 'package-stats': return packageStats(args, index)
    case 'list-exports': return listExports(args, index)
    default: return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  }
}

function searchSymbol(args: any, index: SdkIndex): ToolResponse {
  const query = (args.query || '').toLowerCase()
  if (!query) return { content: [{ type: 'text', text: 'query is required' }], isError: true }

  const results: Array<{ symbol: string; package: string; kind: string }> = []
  for (const [symbol, entries] of Object.entries(index.symbolIndex)) {
    if (symbol.toLowerCase().includes(query)) {
      for (const entry of entries) {
        results.push({ symbol, package: entry.package, kind: entry.kind })
      }
    }
  }
  results.sort((a, b) => a.symbol.localeCompare(b.symbol))

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No symbols found matching '${query}'` }] }
  }
  return {
    content: [{
      type: 'text',
      text: `Found ${results.length} match(es) for '${query}':\n\n` +
        results.map(r => `  ${r.symbol} (${r.kind}) — ${r.package}`).join('\n'),
    }],
  }
}

function findType(args: any, index: SdkIndex): ToolResponse {
  const pattern = (args.pattern || '').toLowerCase()
  if (!pattern) return { content: [{ type: 'text', text: 'pattern is required' }], isError: true }

  const results: Array<{ package: string; type: string; kind: string }> = []
  for (const [pkgName, pkg] of Object.entries(index.packages)) {
    for (const t of pkg.exports.interfaces) {
      if (t.toLowerCase().includes(pattern)) results.push({ package: pkgName, type: t, kind: 'interface' })
    }
    for (const t of pkg.exports.types) {
      if (t.toLowerCase().includes(pattern)) results.push({ package: pkgName, type: t, kind: 'type' })
    }
    for (const c of pkg.exports.classes) {
      if (c.toLowerCase().includes(pattern)) results.push({ package: pkgName, type: c, kind: 'class' })
    }
  }
  results.sort((a, b) => a.type.localeCompare(b.type))

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No types found matching '${pattern}'` }] }
  }
  return {
    content: [{
      type: 'text',
      text: `Found ${results.length} type(s) for '${pattern}':\n\n` +
        results.map(r => `  ${r.type} (${r.kind}) — ${r.package}`).join('\n'),
    }],
  }
}

function dependencyGraph(args: any, index: SdkIndex): ToolResponse {
  const pkgName = args.package
  const direction = args.direction || 'out'

  if (!pkgName || !index.packages[pkgName]) {
    return { content: [{ type: 'text', text: `Package '${pkgName}' not found` }], isError: true }
  }

  const pkg = index.packages[pkgName]

  if (direction === 'out' || direction === 'all') {
    const totemDeps = pkg.dependencies.filter(d => d.startsWith('@totemsdk/'))
    const externalDeps = pkg.dependencies.filter(d => !d.startsWith('@totemsdk/'))
    return {
      content: [{
        type: 'text',
        text: `# ${pkgName} — Outbound Dependencies\n\n` +
          (totemDeps.length ? `**@totemsdk/* deps:**\n${totemDeps.map(d => `  - ${d}`).join('\n')}\n\n` : '') +
          (externalDeps.length ? `**External deps:**\n${externalDeps.map(d => `  - ${d}`).join('\n')}\n` : '_(no external deps)_'),
      }],
    }
  }

  if (direction === 'in' || direction === 'all') {
    const dependents: string[] = []
    for (const [name, other] of Object.entries(index.packages)) {
      if (other.dependencies.includes(pkgName)) dependents.push(name)
    }
    return {
      content: [{
        type: 'text',
        text: `# ${pkgName} — Inbound Dependents\n\n` +
          (dependents.length ? dependents.map(d => `  - ${d}`).join('\n') : '_(no dependents)_'),
      }],
    }
  }
  return { content: [{ type: 'text', text: 'Invalid direction. Use "in", "out", or "all".' }], isError: true }
}

function validateImport(args: any, index: SdkIndex): ToolResponse {
  const { from: fromPkg, to: toPkg, symbol } = args

  if (!fromPkg || !toPkg) {
    return { content: [{ type: 'text', text: 'from and to package names are required' }], isError: true }
  }

  const fromPkgData = index.packages[fromPkg]
  const toPkgData = index.packages[toPkg]

  if (!fromPkgData) return { content: [{ type: 'text', text: `Source package '${fromPkg}' not found` }], isError: true }
  if (!toPkgData) return { content: [{ type: 'text', text: `Target package '${toPkg}' not found` }], isError: true }

  const hasDep = fromPkgData.dependencies.includes(toPkg)
  const result: ValidImportResult = { valid: hasDep, importPath: toPkg, symbolFound: false }

  if (hasDep) {
    if (symbol) {
      const allExports = [
        ...toPkgData.exports.functions,
        ...toPkgData.exports.types,
        ...toPkgData.exports.classes,
        ...toPkgData.exports.interfaces,
        ...toPkgData.exports.consts,
      ]
      result.symbolFound = allExports.includes(symbol)
      if (!result.symbolFound) {
        result.valid = false
        result.reason = `'${toPkg}' does not export '${symbol}'`
      }
    }
  } else {
    result.reason = `'${fromPkg}' does not depend on '${toPkg}'`
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  }
}

function scaffoldAdapter(args: any): ToolResponse {
  const { name, protocol, commands } = args
  if (!name || !protocol) {
    return { content: [{ type: 'text', text: 'name and protocol are required' }], isError: true }
  }

  const cmdList = Array.isArray(commands) ? commands : ['connect', 'disconnect', 'read', 'write']

  const files: ScaffoldResult['files'] = []

  files.push({
    path: `src/index.ts`,
    content: [
      `export type { ${protocol}TransportPort } from './transport.js'`,
      `export { create${protocol}Gateway } from './gateway.js'`,
      `export type { ${protocol}GatewayConfig, ${protocol}Gateway } from './gateway.js'`,
      `export { create${protocol}SensorBridge } from './sensor-bridge.js'`,
      `export type { ${protocol}SensorBinding, ${protocol}SensorBridgeConfig } from './sensor-bridge.js'`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/transport.ts`,
    content: [
      `export interface ${protocol}TransportPort {`,
      ...cmdList.map(c => `  ${c}(...args: unknown[]): Promise<unknown>;`),
      `  onError(handler: (err: Error) => void): () => void;`,
      `}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/gateway.ts`,
    content: [
      `import type { ${protocol}TransportPort } from './transport.js'`,
      `import type { EdgeRuntime } from '@totemsdk/edge'`,
      ``,
      `export interface ${protocol}GatewayConfig {`,
      `  runtime: EdgeRuntime`,
      `  transport: ${protocol}TransportPort`,
      `}`,
      ``,
      `export interface ${protocol}Gateway {`,
      `  start(): Promise<void>`,
      `  stop(): Promise<void>`,
      `}`,
      ``,
      `export function create${protocol}Gateway(config: ${protocol}GatewayConfig): ${protocol}Gateway {`,
      `  return {`,
      `    async start() { /* TODO: implement */ },`,
      `    async stop() { /* TODO: implement */ },`,
      `  }`,
      `}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/sensor-bridge.ts`,
    content: [
      `import type { ${protocol}TransportPort } from './transport.js'`,
      `import type { ${protocol}Gateway } from './gateway.js'`,
      `import type { EdgeRuntime } from '@totemsdk/edge'`,
      ``,
      `export interface ${protocol}SensorBinding {`,
      `  sensorId: string`,
      `  intervalMs: number`,
      `  dataType?: string`,
      `  unit?: string`,
      `}`,
      ``,
      `export interface ${protocol}SensorBridgeConfig {`,
      `  runtime: EdgeRuntime`,
      `  transport: ${protocol}TransportPort`,
      `  gateway: ${protocol}Gateway`,
      `  bindings: ${protocol}SensorBinding[]`,
      `}`,
      ``,
      `export interface ${protocol}SensorBridge {`,
      `  start(): Promise<void>`,
      `  stop(): Promise<void>`,
      `}`,
      ``,
      `export function create${protocol}SensorBridge(config: ${protocol}SensorBridgeConfig): ${protocol}SensorBridge {`,
      `  return {`,
      `    async start() { /* TODO: implement */ },`,
      `    async stop() { /* TODO: implement */ },`,
      `  }`,
      `}`,
      ``,
    ].join('\n'),
  })

  return {
    content: [{
      type: 'text',
      text: `# Scaffolded ${protocol} Edge Adapter\n\nCreated ${files.length} files:\n\n` +
        files.map(f => `**${f.path}**\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n'),
    }],
  }
}

function scaffoldPackage(args: any): ToolResponse {
  const { name, deps } = args
  if (!name) return { content: [{ type: 'text', text: 'name is required' }], isError: true }

  const depList = Array.isArray(deps) ? deps : ['@totemsdk/core']

  const files: ScaffoldResult['files'] = []

  files.push({
    path: `package.json`,
    content: JSON.stringify({
      name: `@totemsdk/${name}`,
      version: '0.1.0',
      description: `TODO: describe ${name}`,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          require: './dist/index.js',
          import: './dist/index.js',
        },
      },
      scripts: { build: 'tsc', clean: 'rm -rf dist', test: 'jest --passWithNoTests' },
      files: ['dist', 'README.md', 'LICENSE'],
      dependencies: Object.fromEntries(depList.map(d => [d, '^0.1.0'])),
      devDependencies: {
        '@types/jest': '^30.0.0',
        '@types/node': '^20.0.0',
        jest: '^30.4.2',
        typescript: '^7.0.2',
      },
      publishConfig: { access: 'public' },
      license: 'MIT',
    }, null, 2),
  })

  files.push({
    path: `tsconfig.json`,
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        declaration: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: 'bundler',
        resolveJsonModule: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts'],
    }, null, 2),
  })

  files.push({
    path: `src/index.ts`,
    content: [
      `export {}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/types.ts`,
    content: [
      `export {}`,
      ``,
    ].join('\n'),
  })

  files.push({
    path: `src/canonical.ts`,
    content: [
      `import { sha3_256 } from '@totemsdk/core'`,
      ``,
      `export function toHex(bytes: Uint8Array): string {`,
      `  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')`,
      `}`,
      ``,
      `export function canonicalJson(value: unknown): string {`,
      `  if (value === null || typeof value !== 'object') return JSON.stringify(value)`,
      `  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'`,
      `  const obj = value as Record<string, unknown>`,
      `  const keys = Object.keys(obj).sort()`,
      `  const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k]))`,
      `  return '{' + pairs.join(',') + '}'`,
      `}`,
      ``,
      `export function hashCanonical(domain: string, value: unknown): string {`,
      `  return toHex(sha3_256(new TextEncoder().encode(domain + canonicalJson(value))))`,
      `}`,
      ``,
    ].join('\n'),
  })

  return {
    content: [{
      type: 'text',
      text: `# Scaffolded @totemsdk/${name}\n\nCreated ${files.length} files in ${name}/:\n\n` +
        files.map(f => `**${f.path}**\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n'),
    }],
  }
}

function packageStats(args: any, index: SdkIndex): ToolResponse {
  const pkgName = args.name
  if (!pkgName || !index.packages[pkgName]) {
    return { content: [{ type: 'text', text: `Package '${pkgName}' not found` }], isError: true }
  }

  const pkg = index.packages[pkgName]
  const totalExports = pkg.exports.functions.length + pkg.exports.types.length +
    pkg.exports.classes.length + pkg.exports.interfaces.length + pkg.exports.consts.length

  const totemDeps = pkg.dependencies.filter(d => d.startsWith('@totemsdk/'))
  const externalDeps = pkg.dependencies.filter(d => !d.startsWith('@totemsdk/'))

  return {
    content: [{
      type: 'text',
      text: [
        `# ${pkgName} v${pkg.version}`,
        ``,
        `**Domain:** ${pkg.domain}`,
        `**Description:** ${pkg.description}`,
        `**Directory:** ${pkg.dir}`,
        ``,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Functions | ${pkg.exports.functions.length} |`,
        `| Types (named) | ${pkg.exports.types.length} |`,
        `| Interfaces | ${pkg.exports.interfaces.length} |`,
        `| Classes | ${pkg.exports.classes.length} |`,
        `| Constants | ${pkg.exports.consts.length} |`,
        `| **Total exports** | **${totalExports}** |`,
        `| Rust/WASM | ${pkg.hasRust ? 'Yes' : 'No'} |`,
        `| Go | ${pkg.hasGo ? 'Yes' : 'No'} |`,
        `| Tests | ${pkg.hasTests ? 'Yes' : 'No'} |`,
        `| @totemsdk/* deps | ${totemDeps.length} |`,
        `| External deps | ${externalDeps.length} |`,
        ``,
      ].join('\n'),
    }],
  }
}

function listExports(args: any, index: SdkIndex): ToolResponse {
  const pkgName = args.package
  const kind = (args.kind || '').toLowerCase()
  const filter = (args.filter || '').toLowerCase()

  if (!pkgName || !index.packages[pkgName]) {
    return { content: [{ type: 'text', text: `Package '${pkgName}' not found` }], isError: true }
  }

  const pkg = index.packages[pkgName]
  const sections: string[] = []

  if (!kind || kind === 'function') {
    const items = filter ? pkg.exports.functions.filter(s => s.toLowerCase().includes(filter)) : pkg.exports.functions
    if (items.length) sections.push(`**Functions (${items.length}):**\n` + items.map(s => `  - \`${s}\``).join('\n'))
  }
  if (!kind || kind === 'interface') {
    const items = filter ? pkg.exports.interfaces.filter(s => s.toLowerCase().includes(filter)) : pkg.exports.interfaces
    if (items.length) sections.push(`**Interfaces (${items.length}):**\n` + items.map(s => `  - \`${s}\``).join('\n'))
  }
  if (!kind || kind === 'type') {
    const items = filter ? pkg.exports.types.filter(s => s.toLowerCase().includes(filter)) : pkg.exports.types
    if (items.length) sections.push(`**Named Types (${items.length}):**\n` + items.map(s => `  - \`${s}\``).join('\n'))
  }
  if (!kind || kind === 'class') {
    const items = filter ? pkg.exports.classes.filter(s => s.toLowerCase().includes(filter)) : pkg.exports.classes
    if (items.length) sections.push(`**Classes (${items.length}):**\n` + items.map(s => `  - \`${s}\``).join('\n'))
  }
  if (!kind || kind === 'const') {
    const items = filter ? pkg.exports.consts.filter(s => s.toLowerCase().includes(filter)) : pkg.exports.consts
    if (items.length) sections.push(`**Constants (${items.length}):**\n` + items.map(s => `  - \`${s}\``).join('\n'))
  }

  return {
    content: [{ type: 'text', text: sections.join('\n\n') || `No exports found for '${pkgName}'` }],
  }
}

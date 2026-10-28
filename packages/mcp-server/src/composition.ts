/**
 * Dependency-aware composition planning and application scaffolding.
 *
 * The planner considers the entire indexed catalogue but selects only a
 * justified closure. It preserves declaration provenance and never upgrades a
 * package's maturity from a successful plan or scaffold.
 */

import type { DependencyEdge, DependencyKind, PackageIndex, SdkIndex } from './types.js'

export type AppRuntime = 'node-cjs' | 'node-esm' | 'bare' | 'browser' | 'unknown'

export interface PlanCompositionInput {
  brief?: string
  runtime?: AppRuntime
  requiredPackages?: string[]
  suggestedPackages?: string[]
  optionalPackages?: string[]
  excludedPackages?: string[]
  requiredCapabilities?: string[]
}

export type Disposition =
  | 'direct'
  | 'transitive'
  | 'enabled-optional'
  | 'alternative'
  | 'excluded'
  | 'unresolved'

export interface PackageDisposition {
  name: string
  version?: string
  maturity?: string
  disposition: Disposition
  reasons: string[]
  dependencyPath?: string[]
}

export interface CompositionPlan {
  brief?: string
  runtime: AppRuntime
  directDependencies: string[]
  transitiveDependencies: string[]
  enabledOptional: string[]
  excluded: string[]
  unresolved: string[]
  dispositions: PackageDisposition[]
  edges: DependencyEdge[]
  capabilityMap: Record<string, { selected: string[]; candidates: string[]; unresolved: boolean }>
  briefMatches: string[]
  maturity: Record<string, string>
  installOrder: string[]
  conflicts: Array<{ package: string; reason: string }>
  hostPorts: string[]
  warnings: string[]
}

const RUNTIME_KINDS: DependencyKind[] = ['runtime', 'peer']

function names(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((v): v is string => typeof v === 'string' && v.length > 0) : []
}

function capabilityMatches(index: SdkIndex, token: string): string[] {
  const terms = token.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return Object.values(index.packages)
    .map((pkg) => {
      const haystack = [
        pkg.name, pkg.description, ...(pkg.keywords ?? []),
        ...pkg.exports.functions, ...pkg.exports.types, ...pkg.exports.classes,
        ...pkg.exports.interfaces, ...pkg.exports.consts,
      ].join(' ').toLowerCase()
      return { name: pkg.name, score: terms.filter((term) => haystack.includes(term)).length }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((entry) => entry.name)
}

function installOrder(selected: Set<string>, index: SdkIndex): string[] {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const order: string[] = []
  const visit = (name: string): void => {
    if (visited.has(name) || visiting.has(name)) return
    visiting.add(name)
    const pkg = index.packages[name]
    for (const kind of RUNTIME_KINDS) {
      for (const dep of Object.keys(pkg?.dependencyGroups?.[kind] ?? {})) {
        if (selected.has(dep)) visit(dep)
      }
    }
    visiting.delete(name)
    visited.add(name)
    order.push(name)
  }
  for (const name of [...selected].sort()) visit(name)
  return order
}

export function planComposition(input: PlanCompositionInput, index: SdkIndex): CompositionPlan {
  const runtime = input.runtime ?? 'unknown'
  const required = names(input.requiredPackages)
  const suggested = names(input.suggestedPackages)
  const optional = names(input.optionalPackages)
  const excluded = new Set(names(input.excludedPackages))
  const unresolved = [...new Set([...required, ...suggested, ...optional])]
    .filter((name) => !index.packages[name] && !excluded.has(name))
    .sort()
  const requested = [...new Set([...required, ...suggested])]
    .filter((name) => index.packages[name] && !excluded.has(name))

  const direct = new Set(requested)
  const transitive = new Set<string>()
  const enabledOptional = new Set<string>()
  const edges = new Map<string, DependencyEdge>()
  const dependencyPath = new Map<string, string[]>()

  const addEdge = (from: string, to: string, kind: DependencyKind, range: string): void => {
    edges.set(`${from}\u0000${to}\u0000${kind}`, { from, to, kind, range })
  }

  const queue = [...direct].sort()
  while (queue.length > 0) {
    const name = queue.shift()!
    const pkg = index.packages[name]
    for (const kind of RUNTIME_KINDS) {
      for (const [dep, range] of Object.entries(pkg?.dependencyGroups?.[kind] ?? {})) {
        if (!index.packages[dep]) continue
        addEdge(name, dep, kind, String(range))
        if (direct.has(dep) || transitive.has(dep)) continue
        transitive.add(dep)
        dependencyPath.set(dep, [...(dependencyPath.get(name) ?? [name]), dep])
        queue.push(dep)
      }
    }
  }
  for (const name of optional) {
    if (!index.packages[name] || excluded.has(name)) continue
    enabledOptional.add(name)
    for (const kind of RUNTIME_KINDS) {
      for (const [dep, range] of Object.entries(index.packages[name]?.dependencyGroups?.[kind] ?? {})) {
        addEdge(name, dep, kind, String(range))
      }
    }
  }

  const selected = new Set([...direct, ...transitive, ...enabledOptional])
  const capabilityMap: CompositionPlan['capabilityMap'] = {}
  const alternatives = new Set<string>()
  const briefMatches = input.brief ? capabilityMatches(index, input.brief).slice(0, 20) : []
  for (const name of briefMatches) if (!selected.has(name)) alternatives.add(name)
  for (const capability of names(input.requiredCapabilities)) {
    const candidates = capabilityMatches(index, capability)
    capabilityMap[capability] = {
      selected: candidates.filter((name) => selected.has(name)),
      candidates: candidates.slice(0, 10),
      unresolved: candidates.length === 0,
    }
    for (const name of candidates) if (!selected.has(name)) alternatives.add(name)
  }

  const dispositions: PackageDisposition[] = Object.values(index.packages)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((pkg): PackageDisposition => {
      const base = {
        name: pkg.name, version: pkg.version,
        ...(pkg.maturity ? { maturity: pkg.maturity } : {}),
      }
      if (unresolved.includes(pkg.name)) {
        return { ...base, disposition: 'unresolved', reasons: ['requested but not present in the selected catalogue'] }
      }
      if (excluded.has(pkg.name)) {
        return { ...base, disposition: 'excluded', reasons: ['explicitly excluded by the brief'] }
      }
      if (direct.has(pkg.name)) {
        return { ...base, disposition: 'direct', reasons: ['required or suggested by the brief'] }
      }
      if (transitive.has(pkg.name)) {
        return {
          ...base, disposition: 'transitive',
          reasons: ['required by a selected package'],
          ...(dependencyPath.has(pkg.name) ? { dependencyPath: dependencyPath.get(pkg.name) } : {}),
        }
      }
      if (enabledOptional.has(pkg.name)) {
        return { ...base, disposition: 'enabled-optional', reasons: ['optional integration enabled by the brief'] }
      }
      if (alternatives.has(pkg.name)) {
        return { ...base, disposition: 'alternative', reasons: ['matched a required capability but not selected'] }
      }
      return { ...base, disposition: 'excluded', reasons: ['not selected by this composition'] }
    })

  const warnings: string[] = []
  if (direct.size === 0 && input.brief) {
    warnings.push('No direct packages were selected; inspect briefMatches and choose a composition.')
  }
  if (briefMatches.length === 0 && input.brief) {
    warnings.push('No package metadata matched the brief; no recipe is assumed.')
  }
  const unresolvedCapabilities = Object.entries(capabilityMap)
    .filter(([, value]) => value.unresolved)
    .map(([capability]) => capability)
  if (unresolvedCapabilities.length > 0) {
    warnings.push(`No package provides capability: ${unresolvedCapabilities.join(', ')}`)
  }
  if (runtime === 'browser' || runtime === 'unknown') {
    warnings.push(`Runtime '${runtime}' support is not verified for this composition.`)
  }
  const selectedMissingMaturity = [...selected].filter((name) => !index.packages[name]?.maturity)
  if (selectedMissingMaturity.length > 0) {
    warnings.push(`Maturity unknown for: ${selectedMissingMaturity.sort().join(', ')}`)
  }

  return {
    ...(input.brief ? { brief: input.brief } : {}),
    runtime,
    directDependencies: [...direct].sort(),
    transitiveDependencies: [...transitive].sort(),
    enabledOptional: [...enabledOptional].sort(),
    excluded: [...excluded].sort(),
    unresolved,
    dispositions,
    edges: [...edges.values()].sort((a, b) =>
      `${a.from}:${a.to}:${a.kind}`.localeCompare(`${b.from}:${b.to}:${b.kind}`)),
    capabilityMap,
    briefMatches,
    maturity: Object.fromEntries([...selected].sort().map((name) => [
      name, index.packages[name]?.maturity ?? 'unknown',
    ])),
    installOrder: installOrder(selected, index),
    conflicts: [],
    hostPorts: [],
    warnings,
  }
}


function selectPrimitive(dependencies: Record<string, string>): {
  imports: string[]
  body: string[]
} {
  if (dependencies['@totemsdk/edge']) {
    return {
      imports: ["import { createEdgeDevice } from '@totemsdk/edge';"],
      body: [
        "const device = createEdgeDevice({ kind: 'device' });",
        'return device.deviceId;',
      ],
    }
  }
  if (dependencies['@totemsdk/proofgraph']) {
    return {
      imports: ["import { createProofGraph } from '@totemsdk/proofgraph';"],
      body: [
        'const graph = createProofGraph({ scaffold: appName });',
        'return graph.graphId;',
      ],
    }
  }
  if (dependencies['@totemsdk/storage']) {
    return {
      imports: [
        "import { ArtifactStore } from '@totemsdk/storage/artifacts';",
        "import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';",
      ],
      body: [
        "const store = new ArtifactStore(new LocalFileBackend('./artifacts'));",
        "const receipt = await store.put('scaffold', new TextEncoder().encode(appName));",
        'const read = await store.get(receipt.ref);',
        'return `${receipt.ref.digest}:${read.status}`;',
      ],
    }
  }
  if (dependencies['@totemsdk/replication']) {
    return {
      imports: ["import { readReplicated } from '@totemsdk/replication';"],
      body: [
        "const result = await readReplicated('scaffold', {",
        "  readReplica: async () => ({ value: 'replica', complete: true, observedAt: Date.now() }),",
        '});',
        'return `${result.source}:${result.freshness}`;',
      ],
    }
  }
  if (dependencies['@totemsdk/manifest']) {
    return {
      imports: ["import { createAnnouncement } from '@totemsdk/manifest';"],
      body: [
        "const announcement = createAnnouncement({",
        "  kind: 'service',",
        '  subjectId: appName,',
        "  subjectHash: '0x' + '11'.repeat(32),",
        "  publisher: 'MxScaffoldPublisher',",
        '  sequence: 1,',
        '  createdAt: Date.now(),',
        '  expiresAt: Date.now() + 86_400_000,',
        "  topics: ['totemsdk:scaffold'],",
        "  nonce: 'scaffold',",
        '});',
        'return announcement.announcementId;',
      ],
    }
  }
  if (dependencies['@totemsdk/identity']) {
    return {
      imports: ["import { createIdentityDocument } from '@totemsdk/identity';"],
      body: [
        "const document = createIdentityDocument({",
        "  kind: 'app',",
        "  rootAddress: 'MxScaffoldRoot',",
        "  controllerAddress: 'MxScaffoldRoot',",
        '});',
        'return document.id;',
      ],
    }
  }
  if (dependencies['@totemsdk/governance']) {
    return {
      imports: ["import { createGovernanceConfig } from '@totemsdk/governance';"],
      body: [
        'const config = createGovernanceConfig({',
        '  daoId: appName,',
        '  name: appName,',
        "  voting: { algorithm: 'linear', quorumBps: 5000, passThresholdBps: 5000, votingPeriodMs: 86_400_000 },",
        '  membership: {},',
        "  authorityScope: 'scaffold',",
        "  authorityResolver: 'scaffold',",
        '});',
        'return config.daoId;',
      ],
    }
  }
  if (dependencies['@totemsdk/core']) {
    return {
      imports: ["import { sha3_256, toHex } from '@totemsdk/core';"],
      body: ['return toHex(sha3_256(new TextEncoder().encode(appName)));'],
    }
  }
  return {
    imports: ["import { createHash } from 'node:crypto';"],
    body: ["return createHash('sha3-256').update(appName).digest('hex');"],
  }
}

export interface ScaffoldAppInput {
  appName?: string
  runtime?: 'node-cjs' | 'node-esm'
  plan: CompositionPlan
}

export interface ScaffoldAppResult {
  files: Array<{ path: string; content: string }>
  dependencies: Record<string, string>
  install: string[]
  generationManifest: {
    runtime: string
    directDependencies: string[]
    maturity: Record<string, string>
    warnings: string[]
  }
}

export function scaffoldApp(input: ScaffoldAppInput, index: SdkIndex): ScaffoldAppResult {
  const runtime = input.runtime ?? 'node-esm'
  const appName = (input.appName ?? 'totem-app').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  const dependencies: Record<string, string> = {}
  for (const name of input.plan.directDependencies) {
    const pkg = index.packages[name]
    if (pkg) dependencies[name] = pkg.version
  }
  const primitive = selectPrimitive(dependencies)
  const moduleType = runtime === 'node-esm' ? 'module' : 'commonjs'
  const files: Array<{ path: string; content: string }> = []

  files.push({
    path: 'package.json',
    content: JSON.stringify({
      name: appName,
      private: true,
      type: moduleType,
      scripts: {
        build: 'tsc -p tsconfig.json',
        start: runtime === 'node-esm' ? 'node dist/index.js' : 'node dist/index.js',
        test: 'node dist/index.js',
      },
      dependencies,
      devDependencies: { typescript: '^5.9.3', '@types/node': '^20.0.0' },
    }, null, 2) + '\n',
  })
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: runtime === 'node-esm' ? 'NodeNext' : 'CommonJS',
        moduleResolution: runtime === 'node-esm' ? 'NodeNext' : 'Node',
        outDir: 'dist',
        rootDir: 'src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      include: ['src/**/*.ts'],
    }, null, 2) + '\n',
  })
  files.push({
    path: 'src/index.ts',
    content: [
      ...primitive.imports,
      '',
      `export const appName = '${appName}';`,
      '',
      'export async function run(): Promise<string> {',
      ...primitive.body.map((line) => `  ${line}`),
      '}',
      '',
      'if (process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.cjs")) {',
      '  run().then((result) => console.log(`${appName} works: ${result}`)).catch((error) => {',
      '    console.error(error);',
      '    process.exitCode = 1;',
      '  });',
      '}',
      '',
    ].join('\n'),
  })
  files.push({
    path: 'src/integrations.ts',
    content: [
      '// Generated integration matrix. Unknown capabilities remain explicit.',
      `export const integrations = ${JSON.stringify(Object.fromEntries(
        input.plan.directDependencies.map((name) => [name, {
          maturity: input.plan.maturity[name] ?? 'unknown',
          status: 'selected',
        }]),
      ), null, 2)} as const;`,
      '',
      `export const limitations = ${JSON.stringify(input.plan.warnings, null, 2)} as const;`,
      '',
    ].join('\n'),
  })
  files.push({
    path: 'README.md',
    content: `# ${appName}\n\nGenerated by @totemsdk/mcp-server.\n\nRuntime: ${runtime}\n\n## Install\n\n\`\`\`bash\nnpm install\nnpm run build\nnpm test\n\`\`\`\n\n## Maturity\n\n${Object.entries(input.plan.maturity).map(([name, maturity]) => `- ${name}: ${maturity}`).join('\n')}\n`,
  })

  return {
    files,
    dependencies,
    install: ['npm install', 'npm run build', 'npm test'],
    generationManifest: {
      runtime,
      directDependencies: input.plan.directDependencies,
      maturity: input.plan.maturity,
      warnings: input.plan.warnings,
    },
  }
}

import {
  getAllTemplates,
  getTemplatesForPackage,
  searchTemplates,
} from '../template-catalog.js'
import { handleToolCall, TOOL_DEFINITIONS } from '../tools.js'
import { buildIndex, readSourceFile } from '../indexer.js'
import { handleResourceRead, listResources, resourceMimeType } from '../resources.js'
import type { SdkIndex } from '../types.js'

function makeIndex(): SdkIndex {
  return {
    generatedAt: Date.now(),
    packages: {
      '@totemsdk/core': {
        name: '@totemsdk/core',
        dir: 'core',
        version: '1.2.6',
        description: 'Core cryptographic primitives',
        dependencies: ['@totemsdk/core-wasm'],
        devDependencies: [],
        hasRust: true,
        hasGo: false,
        hasTests: true,
        exports: {
          functions: ['wotsSign', 'wotsVerify', 'sha3_256'],
          types: ['TreeKey'],
          classes: [],
          interfaces: ['TimerAdapter'],
          consts: [],
        },
        domain: 'core/crypto',
      },
      '@totemsdk/core-wasm': {
        name: '@totemsdk/core-wasm',
        dir: 'core-wasm',
        version: '0.1.0',
        description: 'Rust/WASM crypto engine',
        dependencies: [],
        devDependencies: [],
        hasRust: true,
        hasGo: false,
        hasTests: true,
        exports: {
          functions: [],
          types: [],
          classes: [],
          interfaces: [],
          consts: [],
        },
        domain: 'core/crypto',
      },
    },
    symbolIndex: {
      wotsSign: [{ package: '@totemsdk/core', kind: 'function' }],
      sha3_256: [{ package: '@totemsdk/core', kind: 'function' }],
      TreeKey: [{ package: '@totemsdk/core', kind: 'type' }],
    },
    domainMap: { 'core/crypto': ['@totemsdk/core', '@totemsdk/core-wasm'] },
  }
}

describe('template-catalog', () => {
  it('returns all templates without mutating the catalog', () => {
    const all = getAllTemplates()
    expect(all.length).toBeGreaterThan(5)
    expect(getAllTemplates()).toHaveLength(all.length)
  })

  it('finds templates by package name', () => {
    const eltoo = getTemplatesForPackage('omnia')
    expect(eltoo.length).toBeGreaterThan(0)
    expect(eltoo[0].functions).toContain('buildEltooChannelScript')
  })

  it('returns empty for unknown package', () => {
    expect(getTemplatesForPackage('does-not-exist')).toEqual([])
  })

  it('scores keyword matches higher than description-only matches', () => {
    const [top] = searchTemplates('eltoo')
    expect(top.template).toBe('eltoo')
  })

  it('returns empty for a query with no matches', () => {
    expect(searchTemplates('zzz-no-such-term')).toHaveLength(0)
  })
})

describe('handleToolCall', () => {
  const index = makeIndex()

  it('returns an error for unknown tool names', () => {
    const res = handleToolCall('no-such-tool', {}, index)
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('Unknown tool')
  })

  it('search-symbol matches symbols across packages case-insensitively', () => {
    const res = handleToolCall('search-symbol', { query: 'WOTS' }, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text).toContain('wotsSign')
    expect(res.content[0].text).toContain('@totemsdk/core')
  })

  it('search-symbol requires a query', () => {
    const res = handleToolCall('search-symbol', {}, index)
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('query is required')
  })

  it('search-symbol reports zero matches', () => {
    const res = handleToolCall('search-symbol', { query: 'nonexistent_symbol' }, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text).toContain('No symbols found')
  })

  it('find-type matches interfaces, types, and classes', () => {
    const res = handleToolCall('find-type', { pattern: 'TreeKey' }, index)
    expect(res.content[0].text).toContain('TreeKey (type)')
    expect(res.content[0].text).toContain('@totemsdk/core')
  })

  it('dependency-graph lists outbound @totemsdk deps', () => {
    const res = handleToolCall('dependency-graph', { package: '@totemsdk/core', direction: 'out' }, index)
    expect(res.content[0].text).toContain('@totemsdk/core-wasm')
  })

  it('dependency-graph lists inbound dependents', () => {
    const res = handleToolCall('dependency-graph', { package: '@totemsdk/core-wasm', direction: 'in' }, index)
    expect(res.content[0].text).toContain('@totemsdk/core')
  })

  it('dependency-graph errors on unknown package', () => {
    const res = handleToolCall('dependency-graph', { package: '@totemsdk/nope' }, index)
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('not found')
  })

  it('validate-import validates a declared dependency', () => {
    const res = handleToolCall('validate-import', { from: '@totemsdk/core', to: '@totemsdk/core-wasm' }, index)
    expect(res.content[0].text).toContain('"valid": true')
  })

  it('validate-import flags a symbol missing from the target', () => {
    const res = handleToolCall('validate-import', { from: '@totemsdk/core', to: '@totemsdk/core-wasm', symbol: 'wotsSign' }, index)
    expect(res.content[0].text).toContain('"valid": false')
    expect(res.content[0].text).toContain('does not export')
  })

  it('validate-import flags an undeclared dependency', () => {
    const res = handleToolCall('validate-import', { from: '@totemsdk/core-wasm', to: '@totemsdk/core' }, index)
    expect(res.content[0].text).toContain('"valid": false')
    expect(res.content[0].text).toContain('does not depend')
  })

  it('package-stats reports metrics with domain and export counts', () => {
    const res = handleToolCall('package-stats', { name: '@totemsdk/core' }, index)
    expect(res.content[0].text).toContain('@totemsdk/core v1.2.6')
    expect(res.content[0].text).toContain('core/crypto')
    expect(res.content[0].text).toContain('| **Total exports** | **5** |')
  })

  it('package-stats errors on unknown package', () => {
    const res = handleToolCall('package-stats', { name: '@totemsdk/nope' }, index)
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('not found')
  })

  it('list-exports filters functions by substring', () => {
    const res = handleToolCall('list-exports', { package: '@totemsdk/core', kind: 'function', filter: 'wots' }, index)
    expect(res.content[0].text).toContain('wotsSign')
    expect(res.content[0].text).toContain('wotsVerify')
    expect(res.content[0].text).not.toContain('sha3_256')
  })

  it('suggest-template calls searchTemplates with a usecase', () => {
    const res = handleToolCall('suggest-template', { usecase: 'eltoo channel' }, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text).toContain('eltoo')
  })
})
describe('indexer — real SDK index (anti-drift)', () => {
  const index = buildIndex()

  it('indexes the manifest package set and classifies every package', () => {
    expect(Object.keys(index.packages).length).toBeGreaterThan(50)
    const others = Object.values(index.packages).filter(p => p.domain === 'other').map(p => p.name)
    expect(others).toEqual([])
    expect(Object.keys(index.domainMap).length).toBeGreaterThanOrEqual(7)
  })

  it('resolves barrel (export *) packages — e.g. core params', () => {
    const core = index.packages['@totemsdk/core']
    expect(core).toBeDefined()
    // getParamSet is exported ONLY via `export * from './params.js'`
    expect(core.exports.functions).toContain('getParamSet')
    expect(index.symbolIndex['getParamSet']?.some(e => e.package === '@totemsdk/core')).toBe(true)
    const total = core.exports.functions.length + core.exports.types.length + core.exports.classes.length + core.exports.interfaces.length + core.exports.consts.length
    expect(total).toBeGreaterThan(20)
  })

  it('readSourceFile resolves scoped names and blocks traversal', () => {
    expect(readSourceFile('@totemsdk/core', 'treekey.ts')).toContain('TreeKey')
    expect(readSourceFile('@totemsdk/core', '../../../etc/passwd')).toBeNull()
    expect(readSourceFile('@totemsdk/no-such-package', 'x.ts')).toBeNull()
  })
})

describe('resources — real index', () => {
  const index = buildIndex()

  it('serves all-packages and matches the indexed count', () => {
    const text = handleResourceRead('totemsdk://packages', index)
    expect(text).not.toBeNull()
    expect(JSON.parse(text as string).length).toBe(Object.keys(index.packages).length)
  })

  it('serves RFCs, the audit, and the renamed Gold Paper', () => {
    expect(handleResourceRead('totemsdk://rfc/014', index)).toContain('Wallet Connect Parity')
    expect(handleResourceRead('totemsdk://rfc/015', index)).toContain('Axia API Alignment')
    expect(handleResourceRead('totemsdk://audit/wallet-connect-parity', index)).toContain('parity')
    expect(handleResourceRead('totemsdk://papers/gold', index)).toContain('Network Economics')
  })

  it('lists doc resources and derives the template count at runtime', () => {
    const resources = listResources(index)
    const uris = resources.map(r => r.uri)
    expect(uris).toContain('totemsdk://rfc/013')
    expect(uris).toContain('totemsdk://audit/wallet-connect-parity')
    const tpl = resources.find(r => r.uri === 'totemsdk://templates')
    expect(tpl?.description).toContain(String(getAllTemplates().length))
  })
})

describe('new tools — real index', () => {
  const index = buildIndex()

  it('read-source returns a package source file', () => {
    const res = handleToolCall('read-source', { package: '@totemsdk/core', path: 'treekey.ts' }, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text).toContain('TreeKey')
  })

  it('read-source rejects path traversal', () => {
    const res = handleToolCall('read-source', { package: '@totemsdk/core', path: '../../secret' }, index)
    expect(res.isError).toBe(true)
  })

  it('list-packages filters by domain', () => {
    const res = handleToolCall('list-packages', { domain: 'intelligence' }, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text).toContain('@totemsdk/qvac')
  })
})

describe('tool catalog — anti-drift', () => {
  const index = buildIndex()

  it('advertises unique tool names', () => {
    const names = TOOL_DEFINITIONS.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain('search-packages')
    expect(names).toContain('refresh-index')
  })

  it('every advertised tool is handled (no "Unknown tool")', () => {
    for (const tool of TOOL_DEFINITIONS) {
      const res = handleToolCall(tool.name, {}, index)
      expect(res.content[0].text).not.toContain('Unknown tool')
    }
  })
})

describe('P2 — symbol metadata', () => {
  const index = buildIndex()

  it('extracts signatures for functions reached via barrels', () => {
    const sig = index.packages['@totemsdk/core']?.symbols?.['getParamSet']?.signature
    expect(sig).toBeDefined()
    expect(sig).toContain('getParamSet')
  })

  it('flags @deprecated symbols', () => {
    // deserializeMMRProof is re-exported via `export * from './mmr.js'`
    expect(index.packages['@totemsdk/core']?.symbols?.['deserializeMMRProof']?.deprecated).toBe(true)
  })

  it('search-packages matches by keyword/description', () => {
    const res = handleToolCall('search-packages', { query: 'wots lease', limit: 5 }, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text.toLowerCase()).toContain('wots')
  })

  it('refresh-index rebuilds and reports counts', () => {
    const res = handleToolCall('refresh-index', {}, index)
    expect(res.isError).toBeFalsy()
    expect(res.content[0].text).toMatch(/Index rebuilt: \d+ packages/)
  })
})

describe('P3 — catalogs, mime types, section addressing', () => {
  const index = buildIndex()

  it('serves the connect method catalog', () => {
    const methods = JSON.parse(handleResourceRead('totemsdk://connect/methods', index) as string)
    expect(Array.isArray(methods)).toBe(true)
    expect(methods).toContain('TOTEM_CONNECT')
    expect(methods.length).toBeGreaterThan(40)
  })

  it('serves the edge capability catalog', () => {
    const caps = JSON.parse(handleResourceRead('totemsdk://edge/capabilities', index) as string)
    expect(caps).toContain('intelligence:llm')
    expect(caps.some((c: string) => c.startsWith('decision:') || c.startsWith('industrial:'))).toBe(true)
  })

  it('uses correct mime types', () => {
    expect(resourceMimeType('totemsdk://rfc/014')).toBe('text/markdown')
    expect(resourceMimeType('totemsdk://papers/gold')).toBe('text/markdown')
    expect(resourceMimeType('totemsdk://packages')).toBe('application/json')
    expect(resourceMimeType('totemsdk://connect/methods')).toBe('application/json')
    expect(resourceMimeType('totemsdk://conventions')).toBe('text/markdown')
  })

  it('extracts a doc section by heading anchor', () => {
    const full = handleResourceRead('totemsdk://rfc/014', index) as string
    const section = handleResourceRead('totemsdk://rfc/014#6-architecture', index) as string
    expect(section).not.toBeNull()
    expect(section.length).toBeGreaterThan(0)
    expect(section.length).toBeLessThan(full.length)
    expect(section).toContain('#')
  })

  it('refreshed conventions mention the shared canonical/hash helpers', () => {
    const conventions = handleResourceRead('totemsdk://conventions', index) as string
    expect(conventions).toContain('hashCanonical')
    expect(conventions).not.toContain('no shared util')
  })
})

import {
  getAllTemplates,
  getTemplatesForPackage,
  searchTemplates,
} from '../template-catalog.js'
import { handleToolCall } from '../tools.js'
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
import { buildIndex } from './indexer.js'
import type { SdkIndex } from './types.js'

let _index: SdkIndex | null = null

/** Lazily-built, process-wide SDK index. */
export function getIndex(): SdkIndex {
  return (_index ??= buildIndex())
}

/** Rebuild the SDK index (used by the `refresh-index` tool during development). */
export function refreshIndex(): SdkIndex {
  _index = buildIndex()
  return _index
}

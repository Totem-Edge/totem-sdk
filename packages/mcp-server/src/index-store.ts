import { buildIndex, IndexUnavailableError } from './indexer.js'
import type { SdkIndex } from './types.js'

export type IndexState =
  | { readonly ok: true; readonly index: SdkIndex }
  | { readonly ok: false; readonly error: string }

let _state: IndexState | null = null

/**
 * Lazily-built, process-wide SDK index state. Never throws: an unavailable
 * index is cached as an error so every call site can return an honest failure
 * instead of an empty (confidently-wrong) index.
 */
export function getIndexState(): IndexState {
  if (_state) return _state
  try {
    _state = { ok: true, index: buildIndex() }
  } catch (e) {
    _state = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
  return _state
}

/** The SDK index, or throws {@link IndexUnavailableError} when unavailable. */
export function getIndex(): SdkIndex {
  const state = getIndexState()
  if (!state.ok) throw new IndexUnavailableError(state.error)
  return state.index
}

/** Rebuild the SDK index from the filesystem (used by the `refresh-index` tool). */
export function refreshIndex(): SdkIndex {
  _state = null
  return getIndex()
}

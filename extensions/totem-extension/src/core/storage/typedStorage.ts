/**
 * Runtime implementation of the typed `chrome.storage` accessors.
 *
 * `src/types/chrome-storage.d.ts` only *declares* `getTyped` (an additive,
 * `{[key: string]: any}`-friendly overload of `get`). TypeScript accepts the
 * call sites but nothing defines it at runtime, so every `chrome.storage.*.
 * getTyped(...)` threw `TypeError: ... is not a function` — which unmounted the
 * popup/background React tree and left a collapsed popup.
 *
 * This module augments each storage area with a `getTyped` that delegates to the
 * real `get`, so it is functionally identical to `get` while matching the
 * declared overloads:
 *   - getTyped(keys)            -> Promise<T>
 *   - getTyped(callback)       -> void
 *   - getTyped(keys, callback) -> void
 *
 * It is a side-effect import and MUST run before any module that reads storage at
 * import/construction time (see the entry points, where it is imported first).
 */

type StorageAreaLike = {
  get: (...args: unknown[]) => unknown;
  getTyped?: (...args: unknown[]) => unknown;
};

function installOn(area: StorageAreaLike | undefined): void {
  if (!area || typeof area.get !== 'function' || typeof area.getTyped === 'function') {
    return;
  }
  area.getTyped = function getTyped(this: StorageAreaLike, ...args: unknown[]): unknown {
    // Delegate verbatim: Chrome's `get` already implements the
    // promise-vs-callback overloads, which is exactly the getTyped contract.
    return area.get.apply(area, args);
  };
}

export function installTypedStorage(): void {
  const storage = (globalThis as { chrome?: { storage?: Record<string, unknown> } }).chrome?.storage;
  if (!storage) return;
  for (const name of ['local', 'session', 'sync'] as const) {
    installOn(storage[name] as StorageAreaLike | undefined);
  }
}

// Install on import.
installTypedStorage();

export {};

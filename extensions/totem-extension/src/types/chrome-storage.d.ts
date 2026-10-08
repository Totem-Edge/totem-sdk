/**
 * Typed `chrome.storage` accessors.
 *
 * Recent @types/chrome versions default `StorageArea.get` item values to
 * `unknown`, which is accurate but noisy for this codebase's many untyped
 * settings reads. `getTyped` is an additive overload that preserves the old
 * `{[key: string]: any}` ergonomics at call sites that opt in, without changing
 * the typed `get` overloads for callers that want strictness.
 *
 * The matching runtime implementation lives in
 * `src/core/storage/typedStorage.ts` and must be imported (side-effect) before
 * any storage read; this file only declares the shape.
 */

declare namespace chrome {
  namespace storage {
    interface StorageArea {
      getTyped<T = { [key: string]: any }>(
        keys?: string | string[] | { [key: string]: any } | null,
      ): Promise<T>;
      getTyped<T = { [key: string]: any }>(
        callback: (items: T) => void,
      ): void;
      getTyped<T = { [key: string]: any }>(
        keys: string | string[] | { [key: string]: any } | null,
        callback: (items: T) => void,
      ): void;
    }
  }
}

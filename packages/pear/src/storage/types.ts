/**
 * @totemsdk/pear — KVStore interface
 *
 * Structurally identical to `StorageAdapter` from `@totemsdk/core` so that
 * both `BareKVStore` and `BareFileStore` can be passed directly to
 * `LocalLeaseProvider`, `WotsWatermarkStore`, and `lookup-client` storage slots
 * without any adapter glue.
 *
 * No import from @totemsdk/core is used here to keep this package dependency-free.
 */

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

/**
 * @module @totemsdk/tx-builder/adapters
 *
 * RFC-007 G10: the caller-pinned `KeyValueStorage` interface is **dissolved**
 * onto the canonical `StorageAdapter` from `@totemsdk/core`. `CoinSelectionService`
 * and `MultisigManager` type against a structural `StoragePort` so any
 * `StorageAdapter` (FileStore/SqliteStore/MemoryStore from `@totemsdk/storage`,
 * or a caller-provided one) drops in without a split-brain base contract.
 */

import type { StorageAdapter } from '@totemsdk/core';

export type { StorageAdapter } from '@totemsdk/core';

/** Structural storage surface used by tx-builder consumers. */
export type StoragePort = Pick<StorageAdapter, 'get' | 'set' | 'remove'>;

export interface CoinFetcher {
  fetchCoins(addresses: string[], tokenId?: string): Promise<SpendableCoin[]>;
}

export interface SpendableCoin {
  coinId: string;
  address: string;
  amount: string;
  tokenid: string;
  created: number;
  /** RFC-020 P2-12: when true the coin is already spent and must not be selected. */
  spent?: boolean;
  /** RFC-020 P2-12: absolute expiry (epoch ms); expired coins must not be selected. */
  expiresAt?: number;
}
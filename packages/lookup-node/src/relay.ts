/**
 * TxPoWRelay — BROADCAST_TXPOW processing with work verification and dedup.
 *
 * Features:
 *   - Work verification via `verifyTxPoWWork` from `@totemsdk/txpow` (or injected override)
 *   - SQLite-backed dedup with bounded size (evicts oldest when maxDedupSize exceeded)
 *   - Spam filter: rejects hex strings shorter than spamMinBytes * 2
 *   - Submits valid TxPoWs to the provider (which calls PureMinima internally)
 */

import { verifyTxPoWWork } from '@totemsdk/txpow';
import type { ChainStateProvider, BroadcastResult } from '@totemsdk/chain-provider';
import type { RelayConfig } from './types.js';
import type { SqliteStore } from './storage.js';

const DEFAULT_DEDUP_SIZE = 10_000;
const DEFAULT_SPAM_MIN_BYTES = 100;

export class TxPoWRelay {
  private readonly _maxDedupSize: number;
  private readonly _spamMinBytes: number;
  private readonly _verifyWorkFn?: (txpowHex: string) => boolean | Promise<boolean>;
  private readonly _provider: ChainStateProvider;
  private readonly _store?: SqliteStore;

  constructor(provider: ChainStateProvider, config: RelayConfig, store?: SqliteStore) {
    this._provider = provider;
    this._store = store;
    this._maxDedupSize = config.maxDedupSize ?? DEFAULT_DEDUP_SIZE;
    this._spamMinBytes = config.spamMinBytes ?? DEFAULT_SPAM_MIN_BYTES;
    this._verifyWorkFn = config.verifyWorkFn;
  }

  async process(txpowHex: string): Promise<BroadcastResult> {
    // Spam filter
    if (txpowHex.length < this._spamMinBytes * 2) {
      return {
        success: false,
        message: `TxPoW too short (${txpowHex.length / 2} bytes, min ${this._spamMinBytes})`,
      };
    }

    // Work verification — use injected fn or default verifyTxPoWWork from @totemsdk/txpow
    if (this._verifyWorkFn) {
      let valid: boolean;
      try {
        valid = await this._verifyWorkFn(txpowHex);
      } catch (err) {
        return { success: false, message: `Work verification error: ${String(err)}` };
      }
      if (!valid) {
        return { success: false, message: 'TxPoW does not meet work threshold' };
      }
    } else {
      const result = verifyTxPoWWork(txpowHex);
      if (!result.valid) {
        return { success: false, message: result.reason ?? 'TxPoW failed work check' };
      }
    }

    // Duplicate detection (SQLite-backed)
    const dedupKey = this._dedupKey(txpowHex);
    if (this._store) {
      if (this._store.relayHasSeen(dedupKey)) {
        return { success: false, message: 'duplicate TxPoW' };
      }
      this._store.relayMarkSeen(dedupKey);
      this._store.relayEvictOldest(this._maxDedupSize);
    }

    // Submit to provider
    try {
      return await this._provider.broadcastTxPoW(txpowHex);
    } catch (err) {
      return { success: false, message: String(err) };
    }
  }

  /** First 64 hex chars (32 bytes) as a dedup key — approximates the TxPoW ID. */
  private _dedupKey(txpowHex: string): string {
    return txpowHex.slice(0, 64);
  }
}

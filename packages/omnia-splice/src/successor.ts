/**
 * Splice successor observation and interrupted-broadcast recovery (RFC-078 §3.5).
 *
 * A splice spends the old channel coin and creates a successor at the same
 * eltoo address. The successor coin id is not known from the transaction alone
 * because the channel input floats (`COINID_ELTOO`). The only trustworthy
 * answer comes from observing the funding address after broadcast. This module
 * provides that observation plus a small journal seam so a process that dies
 * between broadcast and confirmation can finish or retry safely.
 */

import type { ChannelStatus } from '@totemsdk/omnia';

/** Minimal chain surface needed by splice observation. */
export interface SpliceChainObserver {
  getCoins(query: {
    address?: string;
    tokenId?: string;
    coinId?: string;
    relevant?: boolean;
  }): Promise<Array<{
    coinid: string;
    amount: string;
    address: string;
    tokenid: string;
    spent?: boolean;
    created?: string;
    mmrentry?: string;
  }>>;
  getTip(): Promise<{ block: number }>;
}

export interface SpliceSuccessorOptions {
  /** Channel funding address the successor must pay to. */
  address: string;
  /** Token id of the channel coin. */
  tokenId: string;
  /** Exact successor amount. */
  amount: bigint;
  /** Confirmations required before the channel is active. Default 1. */
  confirmations?: number;
  /** Give up after this long and leave the channel funding-pending. Default 30s. */
  timeoutMs?: number;
  /** Poll interval. Default 1s. */
  pollIntervalMs?: number;
  /** Absolute deadline override (used by recovery paths). */
  now?: () => number;
  /** Injected sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
}

export interface ObservedSuccessor {
  coinId: string;
  confirmations: number;
  confirmed: boolean;
  coin: {
    coinid: string;
    amount: string;
    address: string;
    tokenid: string;
    created?: string;
  };
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find the successor coin at the channel address, excluding the spent old
 * coin. A coin with `spent: true` is never a valid successor. Confirmation
 * depth is derived from the coin's creation height when the provider supplies
 * it; otherwise it is treated as unconfirmed.
 */
export async function observeSpliceSuccessor(
  chain: SpliceChainObserver,
  options: SpliceSuccessorOptions,
): Promise<ObservedSuccessor | null> {
  const required = options.confirmations ?? 1;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollIntervalMs ?? 1_000;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const deadline = now() + timeoutMs;

  for (;;) {
    const coins = await chain.getCoins({ address: options.address, tokenId: options.tokenId });
    const candidate = coins.find((coin) =>
      !coin.spent
      && coin.address.toLowerCase() === options.address.toLowerCase()
      && coin.tokenid.toLowerCase() === options.tokenId.toLowerCase()
      && BigInt(coin.amount) === options.amount,
    );

    if (candidate) {
      const tip = await chain.getTip();
      const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
      const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
      if (confirmations >= required) {
        return { coinId: candidate.coinid, confirmations, confirmed: true, coin: candidate };
      }
      // Found but not deep enough; keep polling until the deadline.
    }

    if (now() >= deadline) {
      if (candidate) {
        const tip = await chain.getTip();
        const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
        const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
        return { coinId: candidate.coinid, confirmations, confirmed: confirmations >= required, coin: candidate };
      }
      return null;
    }
    await sleep(pollMs);
  }
}

/** Durable record written before broadcast so a restart can reconcile. */
export interface PendingSpliceRecord {
  spliceId: string;
  channelId: string;
  txHex: string;
  txpowId: string;
  coinId?: string;
  broadcastAt: number;
}

export interface PendingSpliceStore {
  save(record: PendingSpliceRecord): Promise<void> | void;
  clear(spliceId: string): Promise<void> | void;
  list(): Promise<PendingSpliceRecord[]> | PendingSpliceRecord[];
}

/** Outcome of reconciling one interrupted splice. */
export interface SpliceRecoveryResult {
  spliceId: string;
  status: ChannelStatus;
  coinId?: string;
  rebroadcast: boolean;
  error?: string;
}

/**
 * Reconcile interrupted broadcasts.
 *
 * - If the successor is already visible, record its coin id and clear the
 *   pending entry.
 * - Otherwise rebroadcast the exact TxPoW (idempotent at the node by txpow id)
 *   and leave the entry pending for the next pass.
 */
export async function recoverInterruptedSplices(
  store: PendingSpliceStore,
  chain: SpliceChainObserver,
  observe: Omit<SpliceSuccessorOptions, 'now'>,
  broadcast: (txHex: string) => Promise<{ txpowid?: string; success?: boolean }>,
): Promise<SpliceRecoveryResult[]> {
  const pending = await store.list();
  const results: SpliceRecoveryResult[] = [];

  for (const record of pending) {
    try {
      const observed = await observeSpliceSuccessor(chain, { ...observe, timeoutMs: observe.timeoutMs ?? 0 });
      if (observed?.confirmed) {
        await store.clear(record.spliceId);
        results.push({
          spliceId: record.spliceId,
          status: 'active',
          coinId: observed.coinId,
          rebroadcast: false,
        });
        continue;
      }
      const rebroadcast = await broadcast(record.txHex);
      if (rebroadcast.success === false && !rebroadcast.txpowid) {
        results.push({
          spliceId: record.spliceId,
          status: 'funding_pending',
          rebroadcast: true,
          error: 'rebroadcast rejected',
        });
      } else {
        results.push({
          spliceId: record.spliceId,
          status: observed ? 'funding_pending' : 'funding_pending',
          ...(observed ? { coinId: observed.coinId } : {}),
          rebroadcast: true,
        });
      }
    } catch (error) {
      results.push({
        spliceId: record.spliceId,
        status: 'funding_pending',
        rebroadcast: false,
        error: String(error),
      });
    }
  }

  return results;
}

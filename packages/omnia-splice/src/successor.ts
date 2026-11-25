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

import { coinAmountAtoms } from '@totemsdk/core';
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
    /** Creating TxPoW id, when the chain surface can report it. */
    createdBy?: string;
  }>>;
  getTip(): Promise<{ block: number }>;
  /**
   * Coin ids created by a transaction. This is the only authoritative lineage
   * evidence: Minima derives an output coin id from the first input's coin id
   * and the output index, and a splice's channel input floats (COINID_ELTOO), so
   * the successor's coin id cannot be predicted from the draft.
   */
  getTransactionOutputs?(txpowid: string): Promise<string[]>;
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
  /**
   * The splice transaction that must have created the successor. When supplied,
   * a candidate whose creator is known and different is discarded, and the
   * observation reports whether lineage could actually be established.
   */
  spliceTxpowId?: string;
  /** The old funding coin the splice spends; never a valid successor. */
  predecessorCoinId?: string;
  /**
   * Accept a successor whose lineage the chain surface cannot prove. Default
   * false: address, token and amount are not identity — anyone can pay the
   * channel address with a matching amount, and the observation would adopt a
   * coin this splice did not create (OMN-072).
   */
  allowUnverifiedLineage?: boolean;
  /** Absolute deadline override (used by recovery paths). */
  now?: () => number;
  /** Injected sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
}

export interface ObservedSuccessor {
  coinId: string;
  confirmations: number;
  confirmed: boolean;
  /**
   * True when the successor is proven to have been created by `spliceTxpowId`.
   * False means the chain surface could not prove it; callers must not treat
   * the channel as active on that basis unless they opted in.
   */
  lineageVerified: boolean;
  coin: {
    coinid: string;
    amount: string;
    address: string;
    tokenid: string;
    created?: string;
    createdBy?: string;
  };
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Find the successor coin at the channel address, excluding the spent old
 * coin. A coin with `spent: true` is never a valid successor. Confirmation
 * depth is derived from the coin's creation height when the provider supplies
 * it; otherwise it is treated as unconfirmed.
 *
 * Successor identity is NOT address + token + amount: those fields are public,
 * so a third party can pay the channel address an identical amount and the coin
 * would be indistinguishable (OMN-072). When `spliceTxpowId` is supplied, the
 * candidate must be provably created by that transaction — via
 * `getTransactionOutputs()` or a coin's `createdBy` — and such a candidate is
 * reported with `lineageVerified: true`. A candidate whose creator is known and
 * different is discarded outright.
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
  const predecessor = options.predecessorCoinId?.toLowerCase();

  /** Outputs of the splice tx, when the chain surface can report them. */
  let spliceOutputs: Set<string> | null = null;
  if (options.spliceTxpowId && chain.getTransactionOutputs) {
    try {
      const outputs = await chain.getTransactionOutputs(options.spliceTxpowId);
      spliceOutputs = new Set(outputs.map((id) => id.toLowerCase()));
    } catch {
      spliceOutputs = null;
    }
  }

  function lineageOf(candidate: { coinid: string; createdBy?: string }): 'verified' | 'contradicted' | 'unknown' {
    if (spliceOutputs) {
      return spliceOutputs.has(candidate.coinid.toLowerCase()) ? 'verified' : 'contradicted';
    }
    if (options.spliceTxpowId && candidate.createdBy) {
      return candidate.createdBy.toLowerCase() === options.spliceTxpowId.toLowerCase()
        ? 'verified'
        : 'contradicted';
    }
    return 'unknown';
  }

  for (;;) {
    const coins = await chain.getCoins({ address: options.address, tokenId: options.tokenId });
    const matching = coins.filter((coin) =>
      !coin.spent
      && coin.address.toLowerCase() === options.address.toLowerCase()
      && coin.tokenid.toLowerCase() === options.tokenId.toLowerCase()
      && coinAmountAtoms(coin) === options.amount,
    ).filter((coin) => !predecessor || coin.coinid.toLowerCase() !== predecessor);

    // Discard coins the splice demonstrably did not create; prefer proven ones.
    const verified = matching.filter((coin) => lineageOf(coin) === 'verified');
    const unknown = matching.filter((coin) => lineageOf(coin) === 'unknown');
    const candidates = verified.length > 0 ? verified : unknown;
    const lineageVerified = verified.length > 0;

    // CAN-012: the channel input floats (COINID_ELTOO), so the coin id cannot be
    // predicted from the transaction. Two coins matching the same address, token
    // and amount are indistinguishable here; picking the first would silently
    // adopt a coin the channel does not control.
    if (candidates.length > 1) {
      throw new Error(
        `Ambiguous splice successor: ${candidates.length} unspent coins match `
        + `${options.address} token ${options.tokenId} amount ${options.amount}`,
      );
    }
    const candidate = candidates[0];

    if (options.spliceTxpowId && candidate && !lineageVerified && !options.allowUnverifiedLineage) {
      // Present but unprovable. Return it with the flag false so the caller keeps
      // the channel funding_pending instead of activating on a guess.
      const tip = await chain.getTip();
      const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
      const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
      return { coinId: candidate.coinid, confirmations, confirmed: confirmations >= required, lineageVerified: false, coin: candidate };
    }

    if (candidate) {
      const tip = await chain.getTip();
      const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
      const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
      if (confirmations >= required) {
        return { coinId: candidate.coinid, confirmations, confirmed: true, lineageVerified, coin: candidate };
      }
      // Found but not deep enough; keep polling until the deadline.
    }

    if (now() >= deadline) {
      if (candidate) {
        const tip = await chain.getTip();
        const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
        const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
        return { coinId: candidate.coinid, confirmations, confirmed: confirmations >= required, lineageVerified, coin: candidate };
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
  /**
   * OMN-014: the successor this splice must produce. Recovery uses the record's
   * own address/token/amount (and coin id once observed) instead of applying one
   * global observation to every pending splice.
   */
  expected?: {
    address: string;
    tokenId: string;
    amount: string;
  };
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
  /** A successor coin may settle exactly one pending splice. */
  const claimed = new Set<string>();

  for (const record of pending) {
    try {
      const options: SpliceSuccessorOptions = {
        ...observe,
        // The journal records the exact TxPoW, so recovery can require the
        // successor to have been created by it rather than by any coin that
        // happens to match address/token/amount (OMN-072).
        spliceTxpowId: record.txpowId,
        ...(record.expected
          ? {
              address: record.expected.address,
              tokenId: record.expected.tokenId,
              amount: BigInt(record.expected.amount),
            }
          : {}),
        timeoutMs: observe.timeoutMs ?? 0,
      };
      const observed = await observeSpliceSuccessor(chain, options);
      if (observed) {
        if (claimed.has(observed.coinId)) {
          throw new Error(
            `successor coin ${observed.coinId} was already claimed by another pending splice`,
          );
        }
        if (record.coinId && record.coinId !== observed.coinId) {
          throw new Error(
            `observed successor ${observed.coinId} does not match the coin recorded for this splice (${record.coinId})`,
          );
        }
        claimed.add(observed.coinId);
      }
      if (observed?.confirmed && (observed.lineageVerified || observe.allowUnverifiedLineage === true)) {
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
        if (observed && record.coinId !== observed.coinId) {
          // Persist the observed successor so the next pass is bound to it.
          await store.save({ ...record, coinId: observed.coinId });
        }
        results.push({
          spliceId: record.spliceId,
          status: 'funding_pending',
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

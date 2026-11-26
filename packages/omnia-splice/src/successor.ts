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
  }>>;
  getTip(): Promise<{ block: number }>;
  /**
   * Full transaction body by TxPoW id (OMN-074).
   *
   * Optional only so adapters can be upgraded independently. When it is present,
   * successor observation proves the coin is an output of the splice that named
   * it; when it is absent and lineage is required, observation fails closed.
   */
  getTransaction?(txpowid: string): Promise<{
    txpowid: string;
    inputs: Array<{ coinId: string; address?: string; amount?: string; tokenId?: string }>;
    outputs: Array<{ coinId?: string; address: string; amount: string; tokenId?: string }>;
  } | null>;
}

/**
 * Raised when a successor coin cannot be tied to the splice transaction that is
 * supposed to have created it (OMN-074).
 */
export class SpliceSuccessorLineageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpliceSuccessorLineageError';
  }
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
  /**
   * The splice transaction this successor must belong to (OMN-074). Supplying
   * it turns lineage verification on by default.
   */
  spliceTxId?: string;
  /** Coin the splice must consume — normally the channel's funding coin. */
  predecessorCoinId?: string;
  /**
   * Require proof that the successor is an output of `spliceTxId`. Defaults to
   * true when `spliceTxId` is supplied. Set false only for a caller that has
   * established provenance some other way.
   */
  requireLineage?: boolean;
}

export interface ObservedSuccessor {
  coinId: string;
  /** True when the coin was proven to be an output of the splice transaction. */
  lineageVerified: boolean;
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

function sameCoinId(a: string, b: string): boolean {
  return a.replace(/^0x/i, '').toLowerCase() === b.replace(/^0x/i, '').toLowerCase();
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '').replace(/^0x/i, '').toLowerCase() === (b ?? '').replace(/^0x/i, '').toLowerCase();
}

/**
 * Prove that `coinId` is an output of `spliceTxId` (OMN-074).
 *
 * Address/token/amount matching cannot distinguish "the splice created this
 * coin" from "some other transaction paid a matching coin to the same address".
 * The only trustworthy binding is the transaction body: it must be visible, it
 * must spend the predecessor, and the successor must appear among its outputs.
 */
async function assertSuccessorLineage(
  chain: SpliceChainObserver,
  coinId: string,
  options: SpliceSuccessorOptions,
): Promise<void> {
  const required = options.requireLineage ?? options.spliceTxId !== undefined;
  if (!required) return;
  if (!options.spliceTxId) {
    throw new SpliceSuccessorLineageError(
      'successor lineage is required but no splice transaction id was supplied',
    );
  }
  if (!chain.getTransaction) {
    throw new SpliceSuccessorLineageError(
      'chain adapter cannot look up transactions; splice successor lineage cannot be proven',
    );
  }
  const transaction = await chain.getTransaction(options.spliceTxId);
  if (!transaction) {
    throw new SpliceSuccessorLineageError(
      `splice transaction ${options.spliceTxId} is not visible on chain`,
    );
  }
  if (options.predecessorCoinId
    && !transaction.inputs.some((input) => sameCoinId(input.coinId, options.predecessorCoinId!))) {
    throw new SpliceSuccessorLineageError(
      `splice transaction ${options.spliceTxId} does not spend predecessor ${options.predecessorCoinId}`,
    );
  }

  const matchedByCoinId = transaction.outputs.some(
    (output) => output.coinId !== undefined && sameCoinId(output.coinId, coinId),
  );
  if (matchedByCoinId) return;

  // Nodes that omit output coin ids: accept exactly one output that pays the
  // successor address, token and amount. More than one is ambiguous.
  const matches = transaction.outputs.filter((output) =>
    sameText(output.address, options.address)
    && sameText(output.tokenId, options.tokenId)
    && coinAmountAtoms({ amount: output.amount }) === options.amount,
  );
  if (matches.length !== 1) {
    throw new SpliceSuccessorLineageError(
      `successor ${coinId} is not an output of splice transaction ${options.spliceTxId}`,
    );
  }
}

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
    const candidates = coins.filter((coin) =>
      !coin.spent
      && coin.address.toLowerCase() === options.address.toLowerCase()
      && coin.tokenid.toLowerCase() === options.tokenId.toLowerCase()
      && coinAmountAtoms(coin) === options.amount,
    );
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

    if (candidate) {
      const tip = await chain.getTip();
      const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
      const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
      if (confirmations >= required) {
        await assertSuccessorLineage(chain, candidate.coinid, options);
        return { coinId: candidate.coinid, confirmations, confirmed: true, lineageVerified: true, coin: candidate };
      }
      // Found but not deep enough; keep polling until the deadline.
    }

    if (now() >= deadline) {
      if (candidate) {
        const tip = await chain.getTip();
        const created = candidate.created !== undefined ? Number(candidate.created) : NaN;
        const confirmations = Number.isFinite(created) && created > 0 ? Math.max(0, tip.block - created + 1) : 0;
        return {
          coinId: candidate.coinid,
          confirmations,
          confirmed: confirmations >= required,
          lineageVerified: false,
          coin: candidate,
        };
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
  /** True when the successor was proven to be an output of the recorded splice. */
  lineageVerified?: boolean;
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
        ...(record.expected
          ? {
              address: record.expected.address,
              tokenId: record.expected.tokenId,
              amount: BigInt(record.expected.amount),
            }
          : {}),
        timeoutMs: observe.timeoutMs ?? 0,
        spliceTxId: record.txpowId,
        // Verify automatically when the adapter can, and always when the caller
        // asked for it (OMN-074). Recovery of an already-broadcast splice is the
        // last chance to bind the successor to its transaction.
        requireLineage: observe.requireLineage ?? typeof chain.getTransaction === 'function',
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
      if (observed?.confirmed) {
        await store.clear(record.spliceId);
        results.push({
          spliceId: record.spliceId,
          status: 'active',
          coinId: observed.coinId,
          lineageVerified: observed.lineageVerified,
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
          ...(observed ? { coinId: observed.coinId, lineageVerified: observed.lineageVerified } : {}),
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

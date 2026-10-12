/**
 * Settlement verification for `@totemsdk/server` (RFC-036).
 *
 * `sendTransaction()` returns on **submission**, not settlement. These helpers
 * poll the node until the TxPoW is included (`isblock === true`) or the timeout
 * elapses, optionally asserting a recipient balance delta and recoverability.
 *
 * `timeout` is distinct from `failed`: a timeout is a failure to *observe* the
 * transaction, not proof the transaction failed.
 */

import { sendTransaction, type SendParams, type SendResult } from './sendTransaction.js';
import type { TxPowStatus } from './client.js';

export type { TxPowStatus } from './client.js';

/** Minimal provider the verifier polls. `MinimaProvider` implements this. */
export interface ConfirmationProvider {
  /** Fetch the txpow record, or `null` if the node does not serve it. */
  getTxPowStatus(txpowId: string): Promise<TxPowStatus | null>;
  /** Optional: recipient balance lookup, for the `expect` delta check. */
  getBalance?(address: string, tokenId?: string): Promise<string>;
}

export interface ConfirmExpectation {
  toAddress: string;
  tokenId?: string;
  /** Minimum increase in the recipient balance, decimal string. */
  minIncrease: string;
}

export interface ConfirmParams {
  txpowId: string;
  provider: ConfirmationProvider;
  /** Poll interval in ms (default 3000). */
  intervalMs?: number;
  /** Overall timeout in ms (default 120000). */
  timeoutMs?: number;
  /** Optional recipient balance-delta assertion. */
  expect?: ConfirmExpectation;
  /**
   * When true, re-read the txpow record after confirmation and fail if the node
   * no longer serves it (so `confirmed` implies recoverability).
   */
  assertRecoverable?: boolean;
  signal?: AbortSignal;
}

export interface ConfirmResult {
  txpowId: string;
  status: 'confirmed' | 'timeout' | 'failed';
  /** Block height of the confirming block (when confirmed). */
  blockHeight?: number;
  /** The confirming txpow id (when available). */
  confirmingTxPowId?: string;
  /** Present when `expect` was supplied and the balance was readable. */
  balanceDelta?: { tokenId: string; before: string; after: string };
  /** Present when `expect` was evaluated. */
  expectationMet?: boolean;
  /** Human-readable detail for `timeout`/`failed`/mismatch. */
  reason?: string;
}

const DEFAULT_INTERVAL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 120_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function toBigInt(value: string): bigint | null {
  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

/**
 * Poll the provider until `txpowId` is included in a block, the timeout elapses,
 * or the signal aborts.
 */
export async function awaitConfirmation(params: ConfirmParams): Promise<ConfirmResult> {
  const {
    txpowId,
    provider,
    intervalMs = DEFAULT_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    expect,
    assertRecoverable,
    signal,
  } = params;

  const deadline = Date.now() + timeoutMs;

  let before: string | undefined;
  if (expect && provider.getBalance) {
    try {
      before = await provider.getBalance(expect.toAddress, expect.tokenId);
    } catch {
      before = undefined;
    }
  }

  for (;;) {
    if (signal?.aborted) {
      return { txpowId, status: 'failed', reason: 'aborted' };
    }

    let record: TxPowStatus | null = null;
    try {
      record = await provider.getTxPowStatus(txpowId);
    } catch {
      record = null;
    }

    if (record && record.isblock === true && typeof record.header?.block === 'number') {
      const result: ConfirmResult = {
        txpowId,
        status: 'confirmed',
        blockHeight: record.header.block,
        confirmingTxPowId: record.txpowid ?? txpowId,
      };

      if (expect && provider.getBalance) {
        let after: string | undefined;
        try {
          after = await provider.getBalance(expect.toAddress, expect.tokenId);
        } catch {
          after = undefined;
        }
        if (after !== undefined) {
          result.balanceDelta = { tokenId: expect.tokenId ?? '0x00', before: before ?? '0', after };
          const b = toBigInt(before ?? '0') ?? 0n;
          const a = toBigInt(after) ?? 0n;
          const min = toBigInt(expect.minIncrease) ?? 0n;
          const increase = a - b;
          result.expectationMet = increase >= min;
          if (!result.expectationMet) {
            result.reason = `recipient balance increase ${increase} < expected ${min}`;
          }
        }
      }

      if (assertRecoverable) {
        let reread: TxPowStatus | null = null;
        try {
          reread = await provider.getTxPowStatus(txpowId);
        } catch {
          reread = null;
        }
        if (!reread) {
          return {
            ...result,
            status: 'failed',
            reason: 'confirmed block but the node no longer serves the txpow record',
          };
        }
      }

      return result;
    }

    if (Date.now() >= deadline) {
      return { txpowId, status: 'timeout', reason: `not included within ${timeoutMs}ms` };
    }

    await sleep(intervalMs, signal);
  }
}

export interface SendAndConfirmParams
  extends SendParams,
    Omit<ConfirmParams, 'txpowId' | 'expect'> {
  /** Defaults to `{ toAddress, tokenId, minIncrease: amount }` from the send. */
  expect?: ConfirmExpectation;
}

/**
 * `sendTransaction` + `awaitConfirmation`. `sendTransaction` stays non-blocking;
 * this is the explicit settled variant.
 */
export async function sendAndConfirm(
  params: SendAndConfirmParams,
): Promise<SendResult & { confirmation: ConfirmResult }> {
  const sent = await sendTransaction(params);
  const confirmation = await awaitConfirmation({
    txpowId: sent.txpowId,
    provider: params.provider,
    intervalMs: params.intervalMs,
    timeoutMs: params.timeoutMs,
    assertRecoverable: params.assertRecoverable,
    signal: params.signal,
    expect:
      params.expect ??
      { toAddress: params.toAddress, tokenId: params.tokenId, minIncrease: params.amount },
  });
  return { ...sent, confirmation };
}

/**
 * Per-channel mutation coordinator.
 *
 * CAN-013: `withChannelLock` existed but wrapped a single RPC handler. Channel
 * state is read, modified and written by several paths — direct pay, HTLC
 * add/reveal/timeout, prepared submissions, settlement, splice and incoming
 * peer messages — and the signing watermark does not serialize them.
 *
 * This module is the one coordinator both RPC and peer handlers take. It is
 * re-entrant per channel using AsyncLocalStorage, so a handler that calls
 * another handler for the same channel cannot deadlock: the inner call runs in
 * the same critical section.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

const held = new AsyncLocalStorage<ReadonlySet<string>>();
const queues = new Map<string, Promise<void>>();

/**
 * Run `fn` with exclusive access to `channelId`.
 *
 * Calls for different channels run concurrently; calls for the same channel
 * queue. Re-entrant within one async call tree.
 */
export function withChannelLock<T>(channelId: string, fn: () => Promise<T>): Promise<T> {
  if (!channelId) return fn();

  const current = held.getStore();
  if (current?.has(channelId)) return fn();

  const previous = queues.get(channelId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => gate);
  queues.set(channelId, queued);

  return previous.catch(() => {}).then(async () => {
    const next = new Set(current ?? []);
    next.add(channelId);
    try {
      return await held.run(next, fn);
    } finally {
      release();
      if (queues.get(channelId) === queued) queues.delete(channelId);
    }
  });
}

/** Stable lock key for a peer message, so it serializes with RPC for the same channel. */
export function channelLockKey(message: unknown): string {
  const msg = (message ?? {}) as { channelId?: unknown; payload?: Record<string, unknown> };
  const payload = (msg.payload ?? {}) as Record<string, unknown>;
  const candidate = msg.channelId ?? payload.channelId ?? payload.spliceId ?? payload.vcId ?? payload.factoryId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'peer';
}

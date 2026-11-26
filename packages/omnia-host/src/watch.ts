/**
 * Generic channel watch service (RFC-078 §4.8).
 *
 * A timelock is not a monitor. This service turns the chain tip and channel
 * state into explicit findings (unilateral close, expiring HTLC) and invokes
 * caller-supplied actions with bounded retry. It deliberately does not embed
 * settlement policy: the host wires `onUnilateralClose` to its contest logic and
 * `onHtlcExpiring` to `timeoutHTLC`/`fulfillHTLC`.
 */

import type { StorageAdapter } from '@totemsdk/core';
import type { HTLCRecord, OmniaChannel } from '@totemsdk/omnia';

export interface WatchChainView {
  getTip(): Promise<{ block: number }>;
  getCoin(coinId: string): Promise<{ spent?: boolean; created?: string | number } | null>;
  /**
   * The current unspent coin at the channel's funding address, if any.
   *
   * CAN-014: a spent funding coin is not by itself a close — a state update or
   * a splice also spends it and creates a successor. When this hook is provided
   * a spent coin with a successor is treated as continuity, not closure.
   */
  getSuccessor?(channel: OmniaChannel, coinId: string): Promise<{
    coinId: string;
    /**
     * OMN-096 (audit 3, OMN-094): the successor's on-chain sequence, when the
     * adapter can read it. A successor whose sequence is *below* the latest
     * fully signed local state is a stale-state publication — exactly what a
     * watchtower must contest — not channel continuity.
     */
    sequence?: number;
  } | null>;
}

export interface WatchFinding {
  kind: 'unilateral-close' | 'htlc-expiring';
  channelId: string;
  /** The coin the finding is about (the live coin when it was observed spent). */
  coinId?: string;
  htlcId?: string;
  blocksRemaining?: number;
  detail: string;
}

export interface ChannelWatchOptions {
  channels: Map<string, OmniaChannel>;
  chain: WatchChainView;
  /** Durable cursor/processed-finding store. Optional; in-memory by default. */
  storage?: StorageAdapter;
  /** Warn this many blocks before an HTLC timeout. Default 12. */
  htlcLeadBlocks?: number;
  /** Invoked once per detected close (per channel) until it succeeds. */
  onUnilateralClose?: (channel: OmniaChannel, finding: WatchFinding) => Promise<void> | void;
  /** Invoked for each pending HTLC inside the lead window. */
  onHtlcExpiring?: (
    channel: OmniaChannel,
    htlc: HTLCRecord,
    finding: WatchFinding,
  ) => Promise<void> | void;
  /** Bounded retry attempts per finding. Default 3. */
  maxAttempts?: number;
  /** Base backoff between attempts. Default 250ms. */
  retryDelayMs?: number;
  /** Clock/sleep injection for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ChannelWatchService {
  /** Compute findings without running actions. */
  scan(): Promise<WatchFinding[]>;
  /** Compute findings and run the configured actions. */
  runOnce(): Promise<WatchFinding[]>;
  /** Poll periodically. Returns immediately; call `stop()` to end. */
  start(intervalMs?: number): void;
  stop(): void;
}

const STATE_KEY = 'omnia_watch:state';

interface WatchState {
  lastTip?: number;
  closedChannels: string[];
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createChannelWatchService(options: ChannelWatchOptions): ChannelWatchService {
  const lead = options.htlcLeadBlocks ?? 12;
  const attempts = Math.max(1, options.maxAttempts ?? 3);
  const retryDelayMs = options.retryDelayMs ?? 250;
  const sleep = options.sleep ?? defaultSleep;
  const closed = new Set<string>();
  /** Latest known channel coin per channel, advanced across updates/splices. */
  const trackedCoin = new Map<string, string>();
  let loaded: Promise<void> | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const loadState = async (): Promise<void> => {
    if (!options.storage) return;
    if (!loaded) {
      loaded = (async () => {
        const state = await options.storage!.get<WatchState>(STATE_KEY);
        for (const id of state?.closedChannels ?? []) closed.add(id);
      })();
    }
    await loaded;
  };

  const saveState = async (lastTip: number): Promise<void> => {
    await options.storage?.set<WatchState>(STATE_KEY, {
      lastTip,
      closedChannels: [...closed],
    });
  };

  const withRetry = async (action: () => Promise<void> | void): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await action();
        return;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) await sleep(retryDelayMs * 2 ** attempt);
      }
    }
    throw lastError;
  };

  const scan = async (): Promise<WatchFinding[]> => {
    const tip = await options.chain.getTip();
    const findings: WatchFinding[] = [];

    for (const channel of options.channels.values()) {
      if (channel.status === 'active' && channel.fundingCoinId) {
        const coinId = trackedCoin.get(channel.channelId) ?? channel.fundingCoinId;
        const coin = await options.chain.getCoin(coinId);
        if (coin?.spent && !closed.has(channel.channelId)) {
          const successor = options.chain.getSuccessor
            ? await options.chain.getSuccessor(channel, coinId)
            : null;
          if (successor) {
            const localSequence = channel.latestState?.sequence;
            if (
              successor.sequence !== undefined
              && localSequence !== undefined
              && successor.sequence < localSequence
            ) {
              // OMN-096: someone published an older state. That is a dispute to
              // contest, not continuity — treating it as continuity lets the
              // stale state settle unchallenged.
              findings.push({
                kind: 'unilateral-close',
                channelId: channel.channelId,
                coinId,
                detail:
                  `stale successor ${successor.coinId} carries sequence ${successor.sequence}, `
                  + `below the latest signed local sequence ${localSequence}`,
              });
            } else {
              // A state update or splice spent the coin and produced a successor;
              // the channel is still live. Track the new coin.
              trackedCoin.set(channel.channelId, successor.coinId);
            }
          } else {
            findings.push({
              kind: 'unilateral-close',
              channelId: channel.channelId,
              coinId,
              detail: `funding coin ${coinId} is spent while the channel is active`,
            });
          }
        }
      }

      for (const htlc of channel.pendingHTLCs) {
        if (htlc.status !== 'pending') continue;
        const remaining = Number(htlc.timeoutBlock) - tip.block;
        if (!Number.isFinite(remaining) || remaining > lead) continue;
        findings.push({
          kind: 'htlc-expiring',
          channelId: channel.channelId,
          htlcId: htlc.htlcId,
          blocksRemaining: remaining,
          detail: `HTLC ${htlc.htlcId} times out at ${htlc.timeoutBlock} (tip ${tip.block})`,
        });
      }
    }

    return findings;
  };

  let inFlight = false;
  const runOnce = async (): Promise<WatchFinding[]> => {
    await loadState();
    const tip = await options.chain.getTip();
    const findings = await scan();

    for (const finding of findings) {
      const channel = options.channels.get(finding.channelId);
      if (!channel) continue;
      try {
        if (finding.kind === 'unilateral-close' && options.onUnilateralClose) {
          await withRetry(() => options.onUnilateralClose!(channel, finding));
          closed.add(channel.channelId);
        } else if (finding.kind === 'htlc-expiring' && options.onHtlcExpiring && finding.htlcId) {
          const htlc = channel.pendingHTLCs.find((h) => h.htlcId === finding.htlcId);
          if (htlc) await withRetry(() => options.onHtlcExpiring!(channel, htlc, finding));
        }
      } catch {
        // Leave the finding unprocessed; the next pass retries it.
      }
    }

    await saveState(tip.block);
    return findings;
  };

  return {
    scan,
    runOnce,
    start(intervalMs = 15_000): void {
      if (timer) return;
      const tick = (): void => {
        // OMN-105 (audit 3, OMN-103): a slow chain call must not overlap the next
        // scan; two scans on one channel duplicate contests and state writes.
        if (inFlight) return;
        inFlight = true;
        void runOnce().catch(() => undefined).finally(() => { inFlight = false; });
      };
      tick();
      timer = setInterval(tick, intervalMs);
      // Do not keep a short-lived CLI process alive just for the watcher.
      if (typeof timer === 'object' && typeof (timer as { unref?: () => void }).unref === 'function') {
        (timer as { unref: () => void }).unref();
      }
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}

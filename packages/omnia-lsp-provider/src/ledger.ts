/**
 * Quote reservations (OMN-068).
 *
 * Admission validates a request against the manifest's advertised capacity, but
 * the manifest is static: without a ledger, N concurrent quotes each fit inside
 * capacity while their sum does not. The facade now reserves the provider-side
 * amount when it issues a quote, releases it on expiry or a failed open, and
 * consumes it atomically when a quote is redeemed.
 *
 * The in-memory ledger is the default. A production provider injects an
 * implementation backed by durable storage; the interface is intentionally
 * small so that the durable version can make `consume` a single transaction.
 */

export type QuoteReservationState = 'reserved' | 'consumed' | 'released';

export interface OmniaLspQuoteReservation {
  quoteId: string;
  providerId: string;
  tokenId: string;
  /** Provider-side amount as quoted, decimal units. */
  amount: string;
  /** Provider-side amount in integer units (18 decimal places). */
  amountUnits: bigint;
  expiresAt: number;
  state: QuoteReservationState;
  updatedAt: number;
}

export type ConsumeReservationResult =
  /** The reservation existed, was live, and is now consumed. */
  | 'consumed'
  /** No reservation with this id was ever recorded. */
  | 'unknown'
  /** The reservation exists but its TTL has passed. */
  | 'expired'
  /** The reservation was already consumed or released. */
  | 'already-consumed';

export interface OmniaLspQuoteLedger {
  /** Record a reservation. Throws if the quoteId is already known. */
  reserve(entry: OmniaLspQuoteReservation): Promise<void> | void;
  /**
   * Atomically move a live reservation to consumed. `unknown` must be returned
   * when this ledger has no record, never an implicit success.
   */
  consume(quoteId: string, now?: number): Promise<ConsumeReservationResult> | ConsumeReservationResult;
  /** Free a reservation. No-op when unknown or already final. */
  release(quoteId: string, now?: number): Promise<void> | void;
  /** Sum of live reservations for a token and provider, in integer units. */
  outstanding(tokenId: string, providerId: string, now?: number): Promise<bigint> | bigint;
  /** Optional: drop final or expired entries. */
  prune?(now?: number): Promise<void> | void;
}

/**
 * Default in-process ledger.
 *
 * Single-threaded JS makes the check-and-set inside `consume` atomic for one
 * process. It does not survive a restart — inject a durable ledger for that.
 */
export function createMemoryQuoteLedger(): OmniaLspQuoteLedger {
  const entries = new Map<string, OmniaLspQuoteReservation>();

  return {
    reserve(entry) {
      if (entries.has(entry.quoteId)) {
        throw new Error(`quote ${entry.quoteId} is already reserved`);
      }
      entries.set(entry.quoteId, { ...entry });
    },

    consume(quoteId, now = Date.now()) {
      const entry = entries.get(quoteId);
      if (!entry) return 'unknown';
      if (entry.state !== 'reserved') return 'already-consumed';
      if (entry.expiresAt <= now) return 'expired';
      entry.state = 'consumed';
      entry.updatedAt = now;
      return 'consumed';
    },

    release(quoteId, now = Date.now()) {
      const entry = entries.get(quoteId);
      if (!entry || entry.state !== 'reserved') return;
      entry.state = 'released';
      entry.updatedAt = now;
    },

    outstanding(tokenId, providerId, now = Date.now()) {
      let total = 0n;
      for (const entry of entries.values()) {
        if (entry.state !== 'reserved') continue;
        if (entry.expiresAt <= now) continue;
        if (entry.tokenId !== tokenId) continue;
        if (entry.providerId !== providerId) continue;
        total += entry.amountUnits;
      }
      return total;
    },

    prune(now = Date.now()) {
      for (const [id, entry] of entries) {
        if (entry.state !== 'reserved' || entry.expiresAt <= now) entries.delete(id);
      }
    },
  };
}

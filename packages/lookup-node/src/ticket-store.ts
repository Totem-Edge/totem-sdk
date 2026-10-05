/**
 * RFC-032-A — session ticket store.
 *
 * Tracks node-issued session tickets and enforces their lifetime, request
 * budget, and per-ticket `seq` monotonicity (replay rejection). Tickets are
 * scoped to the node that minted them; `subject` binds them to a root public key.
 *
 * In-memory and bounded: expired tickets are pruned on write and on a size
 * threshold. Durable persistence is a later phase (T4).
 */

import type { SessionTicket } from '@totemsdk/lookup-protocol';

interface TicketState {
  readonly subject: string;
  readonly nodeId: string;
  readonly expiresAt: number;
  readonly maxRequests: number;
  /** Highest accepted `seq` so far (strictly increasing). */
  lastSeq: number;
  requests: number;
  revoked: boolean;
}

export type TicketVerdict =
  | { ok: true; subject: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'revoked' | 'exhausted' | 'replay'; };

export interface SessionTicketStoreOptions {
  /** Max live tickets retained before pruning the oldest. Default 4096. */
  maxTickets?: number;
  /** Injectable clock. */
  now?: () => number;
}

/**
 * Mints and validates session tickets. The store does not sign — the caller
 * passes an already-signed ticket to {@link issue} (the node identity signs).
 */
export class SessionTicketStore {
  private readonly _tickets = new Map<string, TicketState>();
  private readonly _maxTickets: number;
  private readonly _now: () => number;

  constructor(options: SessionTicketStoreOptions = {}) {
    this._maxTickets = options.maxTickets ?? 4096;
    this._now = options.now ?? (() => Date.now());
  }

  /** Record a freshly minted ticket. */
  issue(ticket: SessionTicket): void {
    this._prune();
    this._tickets.set(ticket.ticketId, {
      subject: ticket.subject,
      nodeId: ticket.nodeId,
      expiresAt: ticket.expiresAt,
      maxRequests: ticket.maxRequests,
      lastSeq: -1,
      requests: 0,
      revoked: false,
    });
  }

  /**
   * Validate a ticket reference `{ ticketId, seq }` and, on success, advance its
   * per-ticket anti-replay counter. `subject` must match if provided.
   */
  consume(ticketId: string, seq: number, expectedSubject?: string): TicketVerdict {
    const state = this._tickets.get(ticketId);
    if (!state) return { ok: false, reason: 'unknown' };
    if (state.revoked) return { ok: false, reason: 'revoked' };
    if (this._now() > state.expiresAt) return { ok: false, reason: 'expired' };
    if (state.requests >= state.maxRequests) return { ok: false, reason: 'exhausted' };
    if (seq <= state.lastSeq) return { ok: false, reason: 'replay' };
    if (expectedSubject !== undefined && expectedSubject !== state.subject) {
      return { ok: false, reason: 'unknown' };
    }
    state.lastSeq = seq;
    state.requests += 1;
    return { ok: true, subject: state.subject };
  }

  /** Revoke a ticket (e.g. on SESSION_CLOSE or key rotation). */
  revoke(ticketId: string): void {
    const state = this._tickets.get(ticketId);
    if (state) state.revoked = true;
  }

  size(): number {
    return this._tickets.size;
  }

  private _prune(): void {
    const now = this._now();
    for (const [id, s] of this._tickets) {
      if (s.revoked || now > s.expiresAt) this._tickets.delete(id);
    }
    if (this._tickets.size >= this._maxTickets) {
      // Evict oldest by expiry (Map preserves insertion order).
      const excess = this._tickets.size - this._maxTickets + 1;
      let removed = 0;
      for (const id of this._tickets.keys()) {
        this._tickets.delete(id);
        if (++removed >= excess) break;
      }
    }
  }
}

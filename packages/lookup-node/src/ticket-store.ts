/**
 * RFC-032-A — session ticket store.
 *
 * Tracks node-issued session tickets and enforces their lifetime, request
 * budget, and per-ticket `seq` monotonicity (replay rejection). Tickets are
 * scoped to the node that minted them; `subject` binds them to a root public key.
 *
 * The store is bounded and prunes expired/revoked tickets on write. When a
 * persistence backend is supplied, ticket state survives a node restart so an
 * already-issued ticket remains usable (subject to its TTL/request budget) and
 * a replayed `seq` is still rejected.
 */

import type { SessionTicket } from '@totemsdk/lookup-protocol';

const TICKET_KEY_PREFIX = 'totem_lookup_ticket:v1:';

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

/** Minimal persistence surface, implemented by `SqliteStore` via an adapter. */
export interface SessionTicketPersistence {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): boolean;
  keys(prefix?: string): string[];
}

export interface SessionTicketStoreOptions {
  /** Max live tickets retained before pruning the oldest. Default 4096. */
  maxTickets?: number;
  /** Injectable clock. */
  now?: () => number;
  /**
   * Optional durable store. When present, issue/consume/revoke are written
   * through synchronously and existing tickets are loaded on construction.
   */
  persistence?: SessionTicketPersistence;
  /**
   * Optional node identity. Tickets persisted by another node are discarded on
   * load and rejected on consume.
   */
  nodeId?: string;
}

function isTicketState(value: unknown): value is TicketState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<TicketState>;
  return (
    typeof state.subject === 'string' &&
    typeof state.nodeId === 'string' &&
    Number.isFinite(state.expiresAt) &&
    Number.isFinite(state.maxRequests) &&
    Number.isFinite(state.lastSeq) &&
    Number.isFinite(state.requests) &&
    typeof state.revoked === 'boolean'
  );
}

/**
 * Mints and validates session tickets. The store does not sign — the caller
 * passes an already-signed ticket to {@link issue} (the node identity signs).
 */
export class SessionTicketStore {
  private readonly _tickets = new Map<string, TicketState>();
  private readonly _maxTickets: number;
  private readonly _now: () => number;
  private readonly _persistence?: SessionTicketPersistence;
  private readonly _nodeId?: string;

  constructor(options: SessionTicketStoreOptions = {}) {
    this._maxTickets = options.maxTickets ?? 4096;
    this._now = options.now ?? (() => Date.now());
    this._persistence = options.persistence;
    this._nodeId = options.nodeId;
    this._restore();
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
    this._persist(ticket.ticketId);
  }

  /**
   * Validate a ticket reference `{ ticketId, seq }` and, on success, advance its
   * per-ticket anti-replay counter. `subject` must match if provided.
   */
  consume(ticketId: string, seq: number, expectedSubject?: string): TicketVerdict {
    const state = this._tickets.get(ticketId);
    if (!state) return { ok: false, reason: 'unknown' };
    if (this._nodeId !== undefined && state.nodeId !== this._nodeId) {
      return { ok: false, reason: 'unknown' };
    }
    if (state.revoked) return { ok: false, reason: 'revoked' };
    if (this._now() > state.expiresAt) return { ok: false, reason: 'expired' };
    if (state.requests >= state.maxRequests) return { ok: false, reason: 'exhausted' };
    if (seq <= state.lastSeq) return { ok: false, reason: 'replay' };
    if (expectedSubject !== undefined && expectedSubject !== state.subject) {
      return { ok: false, reason: 'unknown' };
    }
    state.lastSeq = seq;
    state.requests += 1;
    this._persist(ticketId);
    return { ok: true, subject: state.subject };
  }

  /** Revoke a ticket (e.g. on SESSION_CLOSE or key rotation). */
  revoke(ticketId: string): void {
    const state = this._tickets.get(ticketId);
    if (!state) return;
    state.revoked = true;
    this._persist(ticketId);
  }

  size(): number {
    return this._tickets.size;
  }

  private _restore(): void {
    if (!this._persistence) return;
    for (const key of this._persistence.keys(TICKET_KEY_PREFIX)) {
      const ticketId = key.slice(TICKET_KEY_PREFIX.length);
      const raw = this._persistence.get(key);
      if (raw === null) {
        this._persistence.remove(key);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        this._persistence.remove(key);
        continue;
      }
      if (!isTicketState(parsed) || (this._nodeId !== undefined && parsed.nodeId !== this._nodeId)) {
        this._persistence.remove(key);
        continue;
      }
      this._tickets.set(ticketId, parsed);
    }
    this._prune();
  }

  private _persist(ticketId: string): void {
    if (!this._persistence) return;
    const state = this._tickets.get(ticketId);
    if (!state) return;
    this._persistence.set(`${TICKET_KEY_PREFIX}${ticketId}`, JSON.stringify(state));
  }

  private _remove(ticketId: string): void {
    this._tickets.delete(ticketId);
    this._persistence?.remove(`${TICKET_KEY_PREFIX}${ticketId}`);
  }

  private _prune(): void {
    const now = this._now();
    for (const [id, s] of this._tickets) {
      if (s.revoked || now > s.expiresAt) this._remove(id);
    }
    if (this._tickets.size >= this._maxTickets) {
      // Evict oldest by expiry (Map preserves insertion order).
      const excess = this._tickets.size - this._maxTickets + 1;
      let removed = 0;
      for (const id of this._tickets.keys()) {
        this._remove(id);
        if (++removed >= excess) break;
      }
    }
  }
}

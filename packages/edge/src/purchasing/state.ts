/**
 * purchasing/state.ts — Deterministic negotiation state machine.
 *
 *   OPEN
 *     ↓
 *   NEGOTIATING
 *     ├── COUNTER
 *     ├── ACCEPT ─────► AGREED
 *     ├── REJECT ─────► REJECTED
 *     ├── CANCEL ─────► CANCELLED
 *     ├── ROUND LIMIT ─► EXHAUSTED
 *     └── EXPIRY ─────► EXPIRED
 *
 * All terminal states are terminal. After AGREED / REJECTED / CANCELLED /
 * EXHAUSTED / EXPIRED no new proposal is allowed in that negotiation.
 */

import {
  TERMINAL_NEGOTIATION_STATES,
  type NegotiationState,
} from './types.js';

/** Transitions that are allowed from a given state. */
const ALLOWED_TRANSITIONS: Record<NegotiationState, NegotiationState[]> = {
  OPEN: ['NEGOTIATING', 'CANCELLED', 'EXPIRED'],
  NEGOTIATING: ['NEGOTIATING', 'AGREED', 'REJECTED', 'CANCELLED', 'EXHAUSTED', 'EXPIRED'],
  AGREED: [],
  REJECTED: [],
  CANCELLED: [],
  EXHAUSTED: [],
  EXPIRED: [],
};

/**
 * Attempt a state transition. Returns the new state, or null when the
 * transition is not allowed (the state machine is deterministic and terminal
 * states are terminal).
 */
export function transition(
  from: NegotiationState,
  to: NegotiationState,
): NegotiationState | null {
  if (from === to) return to;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return to;
  return null;
}

export function isTerminal(state: NegotiationState): boolean {
  return TERMINAL_NEGOTIATION_STATES.has(state);
}

/**
 * A single negotiation's tracked state.
 */
export interface NegotiationRecord {
  negotiationId: string;
  state: NegotiationState;
  /** The current proposal head (only this may be accepted/rejected/countered). */
  headProposalId?: string;
  /** All proposals in this negotiation, in order. */
  proposals: Array<{ proposalId: string; round: number; termsHash: string }>;
  /** Canonical terms hashes of all proposals (for cycle detection). */
  termsHashes: string[];
  /** Consumed challenge fingerprints (one-shot). */
  consumedChallenges: string[];
  /** Outstanding WorkRequired challenges (one per transition/head). */
  outstandingChallenges: Array<{
    fingerprint: string;
    challengeId: string;
    round: number;
    status: 'OUTSTANDING' | 'CONSUMED' | 'EXPIRED' | 'CANCELLED';
  }>;
  /** Cumulative expected hashes spent in this negotiation. */
  cumulativeWork: bigint;
  /** Round of the last proposal. */
  lastRound: number;
  /** When the negotiation was opened. */
  openedAt: number;
  /** Hard negotiation expiry. */
  expiresAt: number;
  /** Authenticated principal (root identity) that opened it. */
  principal: string;
  /** Counterparty address. */
  counterparty: string;
  /** Manifest this negotiation is over. */
  manifestId: string;
  /** Monotonically increasing revision for atomic CAS transitions. */
  revision: number;
  /** When the record was last updated. */
  updatedAt: number;
  /** Terminal reason (when terminal). */
  terminalReason?: string;
  /** The formed agreement (when AGREED). */
  agreement?: import('./types.js').TradeAgreement;
}

export function createNegotiationRecord(opts: {
  negotiationId: string;
  principal: string;
  counterparty: string;
  manifestId: string;
  expiresAt: number;
  openedAt?: number;
}): NegotiationRecord {
  const openedAt = opts.openedAt ?? Date.now();
  return {
    negotiationId: opts.negotiationId,
    state: 'OPEN',
    proposals: [],
    termsHashes: [],
    consumedChallenges: [],
    outstandingChallenges: [],
    cumulativeWork: 0n,
    lastRound: -1,
    openedAt,
    expiresAt: opts.expiresAt,
    principal: opts.principal,
    counterparty: opts.counterparty,
    manifestId: opts.manifestId,
    revision: 1,
    updatedAt: openedAt,
  };
}

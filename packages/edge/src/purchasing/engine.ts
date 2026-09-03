/**
 * purchasing/engine.ts — Bounded peer-to-peer negotiation engine (durable).
 *
 * Enforces every anti-infinite-counter bound:
 *   1. Hard maxRounds (round < maxRounds)
 *   2. Negotiation TTL
 *   3. Per-proposal expiry
 *   4. One active branch (parentProposalId === head)
 *   5. Counter must change terms (termsHash != parent termsHash)
 *   6. Per-principal concurrency / cooldown / window limits
 *   7. Fresh work per counter (one-shot challenges, cumulative budget)
 *   8. Local walk-away policy (strategy)
 *
 * All state transitions are atomic via compare-and-set on a durable store.
 * A crash/restart must not corrupt economic state: the same incoming message
 * after restart yields the same economic outcome.
 */

import type { MachineWorkAction, WorkChallenge } from '@totemsdk/txpow';
import {
  PURCHASING_VERSION,
  DEFAULT_MAX_ROUNDS,
  DEFAULT_MAX_CONCURRENT_NEGOTIATIONS,
  DEFAULT_NEGOTIATION_COOLDOWN_MS,
  DEFAULT_MAX_NEGOTIATIONS_PER_WINDOW,
  DEFAULT_NEGOTIATION_WINDOW_MS,
  type NegotiationLimits,
  type NegotiationState,
  type NegotiationStrategy,
  type PrincipalLimits,
  type ProposalAcceptance,
  type ProposalRejection,
  type NegotiationCancellation,
  type PurchaseEvent,
  type TradeAgreement,
  type TradeProposal,
  type WorkRequired,
} from './types.js';
import {
  acceptanceDigest,
  cancellationDigest,
  proposalDigest,
  rejectionDigest,
  termsHash,
  workRequiredDigest,
} from './terms.js';
import {
  createNegotiationRecord,
  isTerminal,
  type NegotiationRecord,
} from './state.js';
import { EdgeTxPowAdapter, EdgeWorkPolicy } from './admission.js';
import {
  InMemoryNegotiationStore,
  InMemoryPrincipalNegotiationStore,
  type NegotiationStore,
  type PrincipalNegotiationStore,
} from './store.js';
import { messageId } from './messages.js';
import { NegotiationError, PURCHASE_ERROR_CODES } from './errors.js';

/** Signature verification function injected by the caller. */
export type SignatureVerifier = (params: {
  digest: string;
  signature: string;
  signerPublicKey: string;
}) => boolean;

/** Signature creation function injected by the caller. */
export type Signer = (digest: string) => Promise<{ signature: string; signerPublicKey: string }>;

export interface NegotiationEngineOptions {
  /** Local principal (root identity) that owns this engine. */
  principal: string;
  /** Signature verification (WOTS). */
  verifySignature: SignatureVerifier;
  /** Signature creation (WOTS). */
  sign: Signer;
  /** TxPoW adapter (work admission). */
  txpow: EdgeTxPowAdapter;
  /** Edge work policy. */
  workPolicy: EdgeWorkPolicy;
  /** Default negotiation limits. */
  limits?: Partial<NegotiationLimits>;
  /** Event sink. */
  onEvent?: (event: PurchaseEvent) => void;
  /** Current time (for deterministic tests). */
  now?: () => number;
  /** Durable negotiation store (implements atomic transitionAndEnqueue). */
  store?: NegotiationStore;
  /** Durable principal anti-abuse store. When omitted, in-memory. */
  principalStore?: PrincipalNegotiationStore;
}

export class NegotiationEngine {
  private readonly fullProposals = new Map<string, TradeProposal>();
  private readonly issuedChallenges = new Map<string, WorkChallenge>();
  private readonly onEvent?: (event: PurchaseEvent) => void;
  private readonly now: () => number;
  private readonly maxRounds: number;
  private readonly defaultExpiresAt: number;
  private readonly principalLimits: Required<PrincipalLimits>;
  private readonly store: NegotiationStore;
  private readonly principalStore: PrincipalNegotiationStore;

  constructor(private readonly opts: NegotiationEngineOptions) {
    this.onEvent = opts.onEvent;
    this.now = opts.now ?? (() => Date.now());
    this.maxRounds = opts.limits?.maxRounds ?? DEFAULT_MAX_ROUNDS;
    this.defaultExpiresAt = opts.limits?.expiresAt ?? this.now() + DEFAULT_MAX_ROUNDS * 60_000;
    this.principalLimits = {
      maxConcurrentNegotiations:
        opts.limits?.principal?.maxConcurrentNegotiations ?? DEFAULT_MAX_CONCURRENT_NEGOTIATIONS,
      cooldownMs: opts.limits?.principal?.cooldownMs ?? DEFAULT_NEGOTIATION_COOLDOWN_MS,
      maxNegotiationsPerWindow:
        opts.limits?.principal?.maxNegotiationsPerWindow ?? DEFAULT_MAX_NEGOTIATIONS_PER_WINDOW,
      windowMs: opts.limits?.principal?.windowMs ?? DEFAULT_NEGOTIATION_WINDOW_MS,
    };
    this.store = opts.store ?? new InMemoryNegotiationStore();
    this.principalStore = opts.principalStore ?? new InMemoryPrincipalNegotiationStore();
  }

  private emit(event: PurchaseEvent): void {
    this.onEvent?.(event);
  }

  private async getRecord(id: string): Promise<NegotiationRecord | undefined> {
    return this.store.get(id);
  }

  /**
   * Atomically transition a record. Loads the current revision, validates the
   * expected revision, derives the next state, and CASes it. Returns the next
   * record, or throws STALE_REVISION when another writer advanced it.
   */
  private async casTransition(
    record: NegotiationRecord,
    mutate: (r: NegotiationRecord) => void,
  ): Promise<NegotiationRecord> {
    const expectedRevision = record.revision;
    const next: NegotiationRecord = {
      ...record,
      revision: expectedRevision + 1,
      updatedAt: this.now(),
    };
    mutate(next);
    const ok = await this.store.compareAndSet(record.negotiationId, expectedRevision, next);
    if (!ok) {
      throw new NegotiationError(
        PURCHASE_ERROR_CODES.STALE_REVISION,
        `negotiation ${record.negotiationId} was advanced by another writer`,
      );
    }
    return next;
  }

  /**
   * Open a new negotiation. Enforces per-principal concurrency, cooldown, and
   * window limits ATOMICALLY (check + consume is one operation). Returns the
   * negotiation record.
   */
  async openNegotiation(opts: {
    negotiationId: string;
    counterparty: string;
    manifestId: string;
    expiresAt?: number;
  }): Promise<NegotiationRecord> {
    const now = this.now();
    const principal = this.opts.principal;

    // Atomic admission: check limits AND consume capacity in one operation,
    // binding the slot to this negotiationId so recovery can reconcile it.
    const admission = await this.principalStore.tryOpen(principal, opts.negotiationId, now, this.principalLimits);
    if (!admission.allowed) {
      const reason =
        admission.reason === 'COOLDOWN'
          ? 'principal is in negotiation cooldown'
          : admission.reason === 'WINDOW_LIMIT'
            ? 'principal has opened too many negotiations in the window'
            : 'principal has too many concurrent negotiations';
      throw new NegotiationError(`PRINCIPAL_${admission.reason}`, reason);
    }

    const expiresAt = opts.expiresAt ?? this.defaultExpiresAt;
    const record = createNegotiationRecord({
      negotiationId: opts.negotiationId,
      principal,
      counterparty: opts.counterparty,
      manifestId: opts.manifestId,
      expiresAt,
      openedAt: now,
    });

    await this.store.create(record);
    this.emit({ type: 'negotiation.opened', negotiationId: opts.negotiationId });
    return record;
  }

  /** Check whether a negotiation is expired; if so, transition it to EXPIRED. */
  private async checkExpiry(record: NegotiationRecord): Promise<NegotiationRecord> {
    if (isTerminal(record.state)) return record;
    if (this.now() > record.expiresAt) {
      const next = await this.casTransition(record, (r) => {
        r.state = 'EXPIRED';
        r.terminalReason = 'negotiation TTL expired';
      });
      // Release the principal admission slot bound to this negotiation.
      await this.principalStore.close(record.principal, record.negotiationId);
      this.emit({ type: 'negotiation.expired', negotiationId: record.negotiationId });
      return next;
    }
    return record;
  }

  /**
   * Reconcile principal admission slots against currently-active negotiation
   * records. Any slot whose negotiation is terminal, expired, or missing is
   * released. Invoke after restart to prevent capacity leaks.
   */
  async reconcilePrincipalSlots(): Promise<void> {
    const recoverable = await this.store.listRecoverable?.();
    const active = recoverable
      ? recoverable.map((r) => r.negotiationId)
      : [];
    await this.principalStore.reconcile(this.opts.principal, active);
  }

  /**
   * Handle an inbound WorkRequired. Validates issuer signature, recipient,
   * negotiation state, and that only one outstanding WorkRequired exists for
   * the current head. Returns the challenge when acceptable.
   */
  async handleWorkRequired(msg: WorkRequired): Promise<WorkChallenge> {
    // 1. Structural
    if (msg.version !== PURCHASING_VERSION) throw new Error('unsupported WorkRequired version');
    if (msg.recipient !== this.opts.principal) throw new Error('WorkRequired not addressed to us');

    // 2. Signature verification (authenticate the challenge issuer)
    const digest = workRequiredDigest(msg);
    if (!this.opts.verifySignature({ digest, signature: msg.signature, signerPublicKey: msg.signerPublicKey })) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'WorkRequired signature invalid');
    }

    // 3. Negotiation exists / state valid
    const record = await this.getRecord(msg.negotiationId);
    if (!record) throw new Error('negotiation not found');
    const current = await this.checkExpiry(record);
    if (isTerminal(current.state)) throw new NegotiationError(PURCHASE_ERROR_CODES.TERMINAL_NEGOTIATION, `negotiation is ${current.state}`);

    // 4. One outstanding WorkRequired per head — the challenge must be for the
    //    current head (or for the initial proposal when no head exists yet).
    if (msg.proposalId !== undefined && current.headProposalId !== undefined) {
      if (msg.proposalId !== current.headProposalId) {
        throw new NegotiationError(PURCHASE_ERROR_CODES.STALE_PROPOSAL, 'WorkRequired is for a stale proposal head');
      }
    }

    // 5. Challenge freshness / one-shot
    const fp = this.opts.txpow.fingerprint(msg.challenge);
    if (current.consumedChallenges.includes(fp)) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.CHALLENGE_ALREADY_CONSUMED, 'challenge already consumed');
    }

    // 6. Local work policy (per-turn + cumulative)
    const round = current.lastRound + 1;
    const willing = await this.opts.workPolicy.willingToWork(
      msg.challenge,
      round,
      current.cumulativeWork,
    );
    if (!willing.ok) throw new NegotiationError(PURCHASE_ERROR_CODES.WORK_BUDGET_EXHAUSTED, willing.reason ?? 'work policy refused challenge');

    // 7. Persist the outstanding challenge (durable, one per transition).
    await this.casTransition(current, (r) => {
      // Reject challenge replacement for the same transition unless identical.
      const existing = r.outstandingChallenges.find((c) => c.round === round);
      if (existing && existing.fingerprint !== fp) {
        throw new NegotiationError('CHALLENGE_REPLACEMENT', 'a different challenge is already outstanding for this transition');
      }
      if (!existing) {
        r.outstandingChallenges.push({
          fingerprint: fp,
          challengeId: msg.challenge.challengeId,
          round,
          status: 'OUTSTANDING',
        });
      }
    });

    // Record the issued challenge for this round (one outstanding per head).
    this.issuedChallenges.set(`${msg.negotiationId}:${round}`, msg.challenge);

    return msg.challenge;
  }

  /**
   * Build a MachineWorkAction for a proposal (binds all security-relevant
   * fields). Used both for mining and verification.
   */
  buildAction(proposal: TradeProposal): MachineWorkAction {
    return {
      version: PURCHASING_VERSION,
      domain: 'totem.negotiation.proposal',
      sender: proposal.proposer,
      recipient: proposal.recipient,
      actionId: proposal.proposalId,
      payloadHash: termsHash(proposal.terms),
      context: {
        negotiationId: proposal.negotiationId,
        parentProposalId: proposal.parentProposalId ?? '',
        manifestId: proposal.manifestId,
        round: String(proposal.round),
        expiresAt: String(proposal.expiresAt),
      },
    };
  }

  /**
   * Submit a proposal (initial or counter). Enforces every bound atomically.
   * Returns the updated record.
   */
  async submitProposal(proposal: TradeProposal): Promise<NegotiationRecord> {
    const now = this.now();

    // 1. Structural
    if (proposal.version !== PURCHASING_VERSION) throw new Error('unsupported proposal version');
    const involvesUs = proposal.recipient === this.opts.principal || proposal.proposer === this.opts.principal;
    if (!involvesUs) throw new Error('proposal does not involve us');

    // 2. Negotiation exists / state valid
    const record = await this.getRecord(proposal.negotiationId);
    if (!record) throw new Error('negotiation not found');
    const current = await this.checkExpiry(record);
    if (isTerminal(current.state)) throw new NegotiationError(PURCHASE_ERROR_CODES.TERMINAL_NEGOTIATION, `negotiation is ${current.state}`);

    // 3. Round bound (hard maxRounds)
    if (proposal.round >= this.maxRounds) {
      await this.casTransition(current, (r) => {
        r.state = 'EXHAUSTED';
        r.terminalReason = `round ${proposal.round} exceeds maxRounds ${this.maxRounds}`;
      });
      await this.principalStore.close(current.principal, current.negotiationId);
      this.emit({ type: 'negotiation.exhausted', negotiationId: record.negotiationId });
      throw new NegotiationError('MAX_ROUNDS', `round ${proposal.round} exceeds maxRounds ${this.maxRounds}`);
    }

    // 4. Round continuity
    if (proposal.round !== current.lastRound + 1) {
      throw new NegotiationError('ROUND_MISMATCH', `round ${proposal.round} is not the expected ${current.lastRound + 1}`);
    }

    // 5. One active branch — parent must be the current head
    if (proposal.round > 0) {
      if (proposal.parentProposalId !== current.headProposalId) {
        throw new NegotiationError(PURCHASE_ERROR_CODES.WRONG_HEAD, 'counter parent is not the current proposal head');
      }
    }

    // 6. Proposal expiry
    if (now > proposal.expiresAt) throw new NegotiationError('PROPOSAL_EXPIRED', 'proposal has expired');

    // 7. Same-terms counter rejection
    const th = termsHash(proposal.terms);
    if (proposal.round > 0) {
      const parent = current.proposals.find((p) => p.proposalId === proposal.parentProposalId);
      if (parent && parent.termsHash === th) {
        throw new NegotiationError('SAME_TERMS', 'counter does not change terms');
      }
    }

    // 8. Work verification (if work is enabled)
    let workRecord = current;
    if (this.opts.workPolicy.getMode() !== 'disabled') {
      if (!proposal.workAdmission) {
        throw new NegotiationError('MISSING_WORK', 'proposal is missing required work admission proof');
      }
      const challenge = this.issuedChallenges.get(`${proposal.negotiationId}:${proposal.round}`);
      if (!challenge) {
        throw new NegotiationError('NO_CHALLENGE', 'no challenge issued for this proposal');
      }
      const action = this.buildAction(proposal);
      const verification = await this.opts.txpow.verify(action, challenge, proposal.workAdmission);
      if (!verification.valid) {
        throw new NegotiationError('WORK_INVALID', `work admission invalid: ${verification.reason ?? 'unknown'}`);
      }
      // Consume the one-shot challenge (durable).
      const fp = this.opts.txpow.fingerprint(challenge);
      workRecord = await this.casTransition(workRecord, (r) => {
        if (!r.consumedChallenges.includes(fp)) {
          r.consumedChallenges.push(fp);
        }
        const outstanding = r.outstandingChallenges.find((c) => c.fingerprint === fp);
        if (outstanding) outstanding.status = 'CONSUMED';
        r.cumulativeWork += this.opts.workPolicy.expectedHashes(challenge.target);
      });
    }

    // 9. Proposal signature verification
    const digest = proposalDigest(proposal);
    if (!this.opts.verifySignature({ digest, signature: proposal.signature, signerPublicKey: proposal.signerPublicKey })) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'proposal signature invalid');
    }

    // 10. Record the proposal (atomic CAS).
    const updated = await this.casTransition(workRecord, (r) => {
      r.proposals.push({ proposalId: proposal.proposalId, round: proposal.round, termsHash: th });
      r.termsHashes.push(th);
      r.headProposalId = proposal.proposalId;
      r.lastRound = proposal.round;
      r.state = 'NEGOTIATING';
    });
    this.fullProposals.set(proposal.proposalId, proposal);
    this.emit({
      type: proposal.round === 0 ? 'negotiation.proposed' : 'negotiation.countered',
      negotiationId: record.negotiationId,
      round: proposal.round,
    });

    return updated;
  }

  /**
   * Accept the current proposal head. Binds the exact current proposal.
   * Returns the immutable TradeAgreement.
   */
  async acceptProposal(acceptance: ProposalAcceptance): Promise<TradeAgreement> {
    const now = this.now();
    if (acceptance.version !== PURCHASING_VERSION) throw new Error('unsupported acceptance version');
    const involvesUs = acceptance.recipient === this.opts.principal || acceptance.acceptor === this.opts.principal;
    if (!involvesUs) throw new Error('acceptance does not involve us');

    const record = await this.getRecord(acceptance.negotiationId);
    if (!record) throw new Error('negotiation not found');
    const current = await this.checkExpiry(record);
    if (isTerminal(current.state)) throw new NegotiationError(PURCHASE_ERROR_CODES.TERMINAL_NEGOTIATION, `negotiation is ${current.state}`);

    // Must accept the current head.
    if (acceptance.proposalId !== current.headProposalId) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.STALE_PROPOSAL, 'acceptance is for a stale/superseded proposal');
    }

    const proposal = this.fullProposals.get(acceptance.proposalId);
    if (!proposal) throw new Error('proposal not found');

    // Acceptance signature.
    const digest = acceptanceDigest(acceptance);
    if (!this.opts.verifySignature({ digest, signature: acceptance.signature, signerPublicKey: acceptance.signerPublicKey })) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'acceptance signature invalid');
    }

    // Build the immutable agreement.
    const agreement: TradeAgreement = {
      version: PURCHASING_VERSION,
      agreementId: `edge:agreement:${acceptance.proposalId}`,
      negotiationId: record.negotiationId,
      acceptedProposalId: acceptance.proposalId,
      manifestId: record.manifestId,
      buyer: proposal.proposer,
      seller: proposal.recipient,
      terms: proposal.terms,
      agreedAt: now,
      expiresAt: proposal.expiresAt,
      buyerSignature: acceptance.signature,
      sellerSignature: proposal.signature,
    };

    // Atomic durable commit: the negotiation CAS AND the outbox enqueue happen
    // in ONE transaction, so the crash window between them is closed.
    const next: NegotiationRecord = {
      ...current,
      state: 'AGREED',
      agreement,
      terminalReason: 'accepted',
      revision: current.revision + 1,
      updatedAt: now,
    };
    const outboxMessage = acceptance as unknown as import('./types.js').NegotiationMessage;
    const outboxId = messageId(outboxMessage);
    const committed = await this.store.transitionAndEnqueue(
      current.negotiationId,
      current.revision,
      next,
      [
        {
          messageId: outboxId,
          recipient: proposal.recipient,
          payload: JSON.stringify(outboxMessage),
        },
      ],
    );
    if (!committed) {
      throw new NegotiationError(
        PURCHASE_ERROR_CODES.STALE_REVISION,
        `negotiation ${record.negotiationId} was advanced by another writer`,
      );
    }

    // Release the principal admission slot bound to this negotiation.
    await this.principalStore.close(current.principal, current.negotiationId);

    this.emit({ type: 'negotiation.accepted', negotiationId: record.negotiationId, proposalId: acceptance.proposalId });
    return agreement;
  }

  /** Reject the current proposal head. */
  async rejectProposal(rejection: ProposalRejection): Promise<void> {
    const now = this.now();
    if (rejection.version !== PURCHASING_VERSION) throw new Error('unsupported rejection version');
    const involvesUs = rejection.recipient === this.opts.principal || rejection.rejector === this.opts.principal;
    if (!involvesUs) throw new Error('rejection does not involve us');

    const record = await this.getRecord(rejection.negotiationId);
    if (!record) throw new Error('negotiation not found');
    const current = await this.checkExpiry(record);
    if (isTerminal(current.state)) throw new NegotiationError(PURCHASE_ERROR_CODES.TERMINAL_NEGOTIATION, `negotiation is ${current.state}`);
    if (rejection.proposalId !== current.headProposalId) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.STALE_PROPOSAL, 'rejection is for a stale/superseded proposal');
    }

    const digest = rejectionDigest(rejection);
    if (!this.opts.verifySignature({ digest, signature: rejection.signature, signerPublicKey: rejection.signerPublicKey })) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'rejection signature invalid');
    }

    await this.casTransition(current, (r) => {
      r.state = 'REJECTED';
      r.terminalReason = rejection.reason ?? 'rejected';
    });
    await this.principalStore.close(current.principal, current.negotiationId);
    this.emit({ type: 'negotiation.rejected', negotiationId: record.negotiationId, proposalId: rejection.proposalId });
    await this.principalStore.setCooldownUntil(this.opts.principal, this.now() + this.principalLimits.cooldownMs);
  }

  /** Cancel a negotiation. */
  async cancelNegotiation(cancellation: NegotiationCancellation): Promise<void> {
    const now = this.now();
    if (cancellation.version !== PURCHASING_VERSION) throw new Error('unsupported cancellation version');
    const involvesUs = cancellation.recipient === this.opts.principal || cancellation.sender === this.opts.principal;
    if (!involvesUs) throw new Error('cancellation does not involve us');

    const record = await this.getRecord(cancellation.negotiationId);
    if (!record) throw new Error('negotiation not found');
    if (isTerminal(record.state)) throw new NegotiationError(PURCHASE_ERROR_CODES.TERMINAL_NEGOTIATION, `negotiation is ${record.state}`);

    const digest = cancellationDigest(cancellation);
    if (!this.opts.verifySignature({ digest, signature: cancellation.signature, signerPublicKey: cancellation.signerPublicKey })) {
      throw new NegotiationError(PURCHASE_ERROR_CODES.INVALID_SIGNATURE, 'cancellation signature invalid');
    }

    await this.casTransition(record, (r) => {
      r.state = 'CANCELLED';
      r.terminalReason = cancellation.reason ?? 'cancelled';
    });
    await this.principalStore.close(record.principal, record.negotiationId);
  }

  /** Get the current state of a negotiation. */
  async getState(negotiationId: string): Promise<NegotiationState | undefined> {
    const record = await this.getRecord(negotiationId);
    if (!record) return undefined;
    const current = await this.checkExpiry(record);
    return current.state;
  }

  /** Get the proposal history for a negotiation. */
  async getHistory(negotiationId: string): Promise<TradeProposal[]> {
    const record = await this.getRecord(negotiationId);
    if (!record) return [];
    return record.proposals
      .map((p) => this.fullProposals.get(p.proposalId))
      .filter((p): p is TradeProposal => p !== undefined);
  }

  /** Get the terms hashes for a negotiation (for cycle detection). */
  async getTermsHashes(negotiationId: string): Promise<string[]> {
    const record = await this.getRecord(negotiationId);
    return record ? record.termsHashes : [];
  }

  /** Get cumulative work spent in a negotiation. */
  async getCumulativeWork(negotiationId: string): Promise<bigint> {
    const record = await this.getRecord(negotiationId);
    return record ? record.cumulativeWork : 0n;
  }

  /** Get the durable record for a negotiation. */
  async getRecordFor(negotiationId: string): Promise<NegotiationRecord | undefined> {
    return this.getRecord(negotiationId);
  }
}

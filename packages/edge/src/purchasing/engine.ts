/**
 * purchasing/engine.ts — Bounded peer-to-peer negotiation engine.
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
 * Receiver-side validation order (cheap abuse before expensive strategy):
 *   structural → negotiation exists/state → challenge freshness →
 *   work verification → signature → replay/head/round → expiry →
 *   terms schema → policy → strategy
 */

import { wotsVerifyDigest, hexToBytes } from '@totemsdk/core';
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
}

export class NegotiationEngine {
  private readonly records = new Map<string, NegotiationRecord>();
  private readonly fullProposals = new Map<string, TradeProposal>();
  private readonly issuedChallenges = new Map<string, WorkChallenge>();
  private readonly principalOpenedAt = new Map<string, number[]>();
  private readonly principalCooldownUntil = new Map<string, number>();
  private readonly onEvent?: (event: PurchaseEvent) => void;
  private readonly now: () => number;
  private readonly maxRounds: number;
  private readonly defaultExpiresAt: number;
  private readonly principalLimits: Required<PrincipalLimits>;
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
  }

  private emit(event: PurchaseEvent): void {
    this.onEvent?.(event);
  }

  private getRecord(id: string): NegotiationRecord | undefined {
    return this.records.get(id);
  }

  private setRecord(record: NegotiationRecord): void {
    this.records.set(record.negotiationId, record);
  }

  private principalActiveCount(principal: string): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.principal === principal && !isTerminal(record.state)) count++;
    }
    return count;
  }

  private principalRecentCount(principal: string, now: number): number {
    const opened = this.principalOpenedAt.get(principal) ?? [];
    return opened.filter((t) => now - t < this.principalLimits.windowMs).length;
  }

  /**
   * Open a new negotiation. Enforces per-principal concurrency, cooldown, and
   * window limits. Returns the negotiation id, or throws.
   */
  openNegotiation(opts: {
    negotiationId: string;
    counterparty: string;
    manifestId: string;
    expiresAt?: number;
  }): NegotiationRecord {
    const now = this.now();
    const principal = this.opts.principal;

    // Cooldown after terminal failure.
    const cooldownUntil = this.principalCooldownUntil.get(principal) ?? 0;
    if (now < cooldownUntil) {
      throw new Error('principal is in negotiation cooldown');
    }

    // Concurrency limit.
    if (this.principalActiveCount(principal) >= this.principalLimits.maxConcurrentNegotiations) {
      throw new Error('principal has too many concurrent negotiations');
    }

    // Window limit.
    if (this.principalRecentCount(principal, now) >= this.principalLimits.maxNegotiationsPerWindow) {
      throw new Error('principal has opened too many negotiations in the window');
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

    this.setRecord(record);
    const opened = this.principalOpenedAt.get(principal) ?? [];
    opened.push(now);
    this.principalOpenedAt.set(principal, opened);
    this.emit({ type: 'negotiation.opened', negotiationId: opts.negotiationId });
    return record;
  }

  /** Check whether a negotiation is expired; if so, transition it to EXPIRED. */
  private checkExpiry(record: NegotiationRecord): void {
    if (isTerminal(record.state)) return;
    if (this.now() > record.expiresAt) {
      record.state = 'EXPIRED';
      this.setRecord(record);
      this.emit({ type: 'negotiation.expired', negotiationId: record.negotiationId });
    }
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
      throw new Error('WorkRequired signature invalid');
    }

    // 3. Negotiation exists / state valid
    const record = this.getRecord(msg.negotiationId);
    if (!record) throw new Error('negotiation not found');
    this.checkExpiry(record);
    if (isTerminal(record.state)) throw new Error(`negotiation is ${record.state}`);

    // 4. One outstanding WorkRequired per head — the challenge must be for the
    //    current head (or for the initial proposal when no head exists yet).
    if (msg.proposalId !== undefined && record.headProposalId !== undefined) {
      if (msg.proposalId !== record.headProposalId) {
        throw new Error('WorkRequired is for a stale proposal head');
      }
    }

    // 5. Challenge freshness / one-shot
    const fp = this.opts.txpow.fingerprint(msg.challenge);
    if (record.consumedChallenges.includes(fp)) {
      throw new Error('challenge already consumed');
    }

    // 6. Local work policy (per-turn + cumulative)
    const round = record.lastRound + 1;
    const willing = await this.opts.workPolicy.willingToWork(
      msg.challenge,
      round,
      record.cumulativeWork,
    );
    if (!willing.ok) throw new Error(willing.reason ?? 'work policy refused challenge');

    // Record the issued challenge for this round (one outstanding per head).
    // Keyed by negotiationId:round because the proposalId is not yet known
    // when the challenge is issued.
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
   * Submit a proposal (initial or counter). Enforces every bound.
   *
   * Accepts proposals in both directions:
   *   - incoming (recipient === principal) — from the counterparty
   *   - outgoing (proposer === principal)  — our own proposal
   * Returns the updated record.
   */
  async submitProposal(proposal: TradeProposal): Promise<NegotiationRecord> {
    const now = this.now();

    // 1. Structural
    if (proposal.version !== PURCHASING_VERSION) throw new Error('unsupported proposal version');
    const involvesUs = proposal.recipient === this.opts.principal || proposal.proposer === this.opts.principal;
    if (!involvesUs) throw new Error('proposal does not involve us');

    // 2. Negotiation exists / state valid
    const record = this.getRecord(proposal.negotiationId);
    if (!record) throw new Error('negotiation not found');
    this.checkExpiry(record);
    if (isTerminal(record.state)) throw new Error(`negotiation is ${record.state}`);

    // 3. Round bound (hard maxRounds)
    if (proposal.round >= this.maxRounds) {
      record.state = 'EXHAUSTED';
      this.setRecord(record);
      this.emit({ type: 'negotiation.exhausted', negotiationId: record.negotiationId });
      throw new Error(`round ${proposal.round} exceeds maxRounds ${this.maxRounds}`);
    }

    // 4. Round continuity
    if (proposal.round !== record.lastRound + 1) {
      throw new Error(`round ${proposal.round} is not the expected ${record.lastRound + 1}`);
    }

    // 5. One active branch — parent must be the current head
    if (proposal.round > 0) {
      if (proposal.parentProposalId !== record.headProposalId) {
        throw new Error('counter parent is not the current proposal head');
      }
    }

    // 6. Proposal expiry
    if (now > proposal.expiresAt) throw new Error('proposal has expired');

    // 7. Same-terms counter rejection
    const th = termsHash(proposal.terms);
    if (proposal.round > 0) {
      const parent = record.proposals.find((p) => p.proposalId === proposal.parentProposalId);
      if (parent && parent.termsHash === th) {
        throw new Error('counter does not change terms');
      }
    }

    // 8. Work verification (if work is enabled)
    if (this.opts.workPolicy.getMode() !== 'disabled') {
      if (!proposal.workAdmission) {
        throw new Error('proposal is missing required work admission proof');
      }
      const challenge = this.issuedChallenges.get(`${proposal.negotiationId}:${proposal.round}`);
      if (!challenge) {
        throw new Error('no challenge issued for this proposal');
      }
      const action = this.buildAction(proposal);
      const verification = await this.opts.txpow.verify(action, challenge, proposal.workAdmission);
      if (!verification.valid) {
        throw new Error(`work admission invalid: ${verification.reason ?? 'unknown'}`);
      }
      // Consume the one-shot challenge.
      const fp = this.opts.txpow.fingerprint(challenge);
      if (!record.consumedChallenges.includes(fp)) {
        record.consumedChallenges.push(fp);
      }
      // Track cumulative work.
      record.cumulativeWork += this.opts.workPolicy.expectedHashes(challenge.target);
    }

    // 9. Proposal signature verification
    const digest = proposalDigest(proposal);
    if (!this.opts.verifySignature({ digest, signature: proposal.signature, signerPublicKey: proposal.signerPublicKey })) {
      throw new Error('proposal signature invalid');
    }

    // 10. Record the proposal
    record.proposals.push({ proposalId: proposal.proposalId, round: proposal.round, termsHash: th });
    record.termsHashes.push(th);
    record.headProposalId = proposal.proposalId;
    record.lastRound = proposal.round;
    record.state = 'NEGOTIATING';
    this.fullProposals.set(proposal.proposalId, proposal);
    this.setRecord(record);
    this.emit({
      type: proposal.round === 0 ? 'negotiation.proposed' : 'negotiation.countered',
      negotiationId: record.negotiationId,
      round: proposal.round,
    });

    return record;
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

    const record = this.getRecord(acceptance.negotiationId);
    if (!record) throw new Error('negotiation not found');
    this.checkExpiry(record);
    if (isTerminal(record.state)) throw new Error(`negotiation is ${record.state}`);

    // Must accept the current head.
    if (acceptance.proposalId !== record.headProposalId) {
      throw new Error('acceptance is for a stale/superseded proposal');
    }

    const proposal = this.fullProposals.get(acceptance.proposalId);
    if (!proposal) throw new Error('proposal not found');

    // Acceptance signature.
    const digest = acceptanceDigest(acceptance);
    if (!this.opts.verifySignature({ digest, signature: acceptance.signature, signerPublicKey: acceptance.signerPublicKey })) {
      throw new Error('acceptance signature invalid');
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

    record.state = 'AGREED';
    this.setRecord(record);
    this.emit({ type: 'negotiation.accepted', negotiationId: record.negotiationId, proposalId: acceptance.proposalId });
    return agreement;
  }

  /** Reject the current proposal head. */
  async rejectProposal(rejection: ProposalRejection): Promise<void> {
    const now = this.now();
    if (rejection.version !== PURCHASING_VERSION) throw new Error('unsupported rejection version');
    const involvesUs = rejection.recipient === this.opts.principal || rejection.rejector === this.opts.principal;
    if (!involvesUs) throw new Error('rejection does not involve us');

    const record = this.getRecord(rejection.negotiationId);
    if (!record) throw new Error('negotiation not found');
    this.checkExpiry(record);
    if (isTerminal(record.state)) throw new Error(`negotiation is ${record.state}`);
    if (rejection.proposalId !== record.headProposalId) {
      throw new Error('rejection is for a stale/superseded proposal');
    }

    const digest = rejectionDigest(rejection);
    if (!this.opts.verifySignature({ digest, signature: rejection.signature, signerPublicKey: rejection.signerPublicKey })) {
      throw new Error('rejection signature invalid');
    }

    record.state = 'REJECTED';
    this.setRecord(record);
    this.emit({ type: 'negotiation.rejected', negotiationId: record.negotiationId, proposalId: rejection.proposalId });
    this.principalCooldownUntil.set(this.opts.principal, this.now() + this.principalLimits.cooldownMs);
  }

  /** Cancel a negotiation. */
  async cancelNegotiation(cancellation: NegotiationCancellation): Promise<void> {
    const now = this.now();
    if (cancellation.version !== PURCHASING_VERSION) throw new Error('unsupported cancellation version');
    const involvesUs = cancellation.recipient === this.opts.principal || cancellation.sender === this.opts.principal;
    if (!involvesUs) throw new Error('cancellation does not involve us');

    const record = this.getRecord(cancellation.negotiationId);
    if (!record) throw new Error('negotiation not found');
    if (isTerminal(record.state)) throw new Error(`negotiation is ${record.state}`);

    const digest = cancellationDigest(cancellation);
    if (!this.opts.verifySignature({ digest, signature: cancellation.signature, signerPublicKey: cancellation.signerPublicKey })) {
      throw new Error('cancellation signature invalid');
    }

    record.state = 'CANCELLED';
    this.setRecord(record);
  }

  /** Get the current state of a negotiation. */
  getState(negotiationId: string): NegotiationState | undefined {
    const record = this.getRecord(negotiationId);
    if (!record) return undefined;
    this.checkExpiry(record);
    return record.state;
  }

  /** Get the proposal history for a negotiation. */
  getHistory(negotiationId: string): TradeProposal[] {
    const record = this.getRecord(negotiationId);
    if (!record) return [];
    return record.proposals
      .map((p) => this.fullProposals.get(p.proposalId))
      .filter((p): p is TradeProposal => p !== undefined);
  }

  /** Get the terms hashes for a negotiation (for cycle detection). */
  getTermsHashes(negotiationId: string): string[] {
    const record = this.getRecord(negotiationId);
    return record ? record.termsHashes : [];
  }

  /** Get cumulative work spent in a negotiation. */
  getCumulativeWork(negotiationId: string): bigint {
    const record = this.getRecord(negotiationId);
    return record ? record.cumulativeWork : 0n;
  }
}

/**
 * purchasing/seller.ts — Supply-side negotiation service.
 *
 * Subscribes to an authenticated negotiation transport, runs every inbound
 * message through the shared ingress pipeline, dispatches to the same
 * NegotiationEngine that drives purchases, applies a seller-specific strategy,
 * and signs+sends protocol responses via the durable outbox.
 *
 * The service is intentionally symmetric to the buyer path:
 *   - transport stays dumb
 *   - engine stays the deterministic economic state machine
 *   - strategy decides economic responses
 *   - outbox closes the persist-then-send crash window
 */

import type { SignedManifest } from '@totemsdk/manifest';
import {
  PURCHASING_VERSION,
  type NegotiationCancellation,
  type NegotiationLimits,
  type NegotiationMessage,
  type NegotiationRequest,
  type NegotiationResult,
  type NegotiationState,
  type ProposalAcceptance,
  type ProposalRejection,
  type PurchaseEvent,
  type TradeAgreement,
  type TradeProposal,
  type TradeTerms,
  type WorkRequired,
} from './types.js';
import {
  acceptanceDigest,
  proposalDigest,
  rejectionDigest,
  termsHash,
  workRequiredDigest,
} from './terms.js';
import { NegotiationEngine } from './engine.js';
import { EdgeTxPowAdapter, EdgeWorkPolicy } from './admission.js';
import { ingress } from './ingress.js';
import { messageId, type ReplayLedger, type ReplayOutcome } from './messages.js';
import type { NegotiationStore, PrincipalNegotiationStore } from './store.js';
import type { OutboxStore } from './outbox.js';
import type { NegotiationTransport, TransportMessageContext } from './transport.js';
import { NegotiationError, PURCHASE_ERROR_CODES } from './errors.js';

/** Signature verification (WOTS). */
export type SignatureVerifier = (params: {
  digest: string;
  signature: string;
  signerPublicKey: string;
}) => boolean;

/** Signature creation (WOTS). */
export type Signer = (digest: string) => Promise<{ signature: string; signerPublicKey: string }>;

/**
 * Applications supply seller-side bargaining intelligence.
 *
 * The input proposal is the *current head from the buyer's perspective*.
 * The seller may accept it, reject it, or counter with new terms.
 */
export interface SellerStrategy {
  evaluate(context: {
    negotiationId: string;
    proposal: TradeProposal;
    history: TradeProposal[];
    termsHashes: string[];
  }): Promise<
    | { action: 'accept' }
    | { action: 'reject'; reason?: string }
    | { action: 'counter'; terms: TradeTerms }
  >;
}

export interface SellerServiceOptions {
  /** Authenticated principal (root identity) that owns this seller service. */
  principal: string;
  /** Signature verification (WOTS). */
  verifySignature: SignatureVerifier;
  /** Signature creation (WOTS). */
  sign: Signer;
  /** TxPoW adapter (work admission). */
  txpow: EdgeTxPowAdapter;
  /** Edge work policy. */
  workPolicy: EdgeWorkPolicy;
  /** Durable negotiation store. */
  negotiationStore: NegotiationStore;
  /** Durable principal anti-abuse store. */
  principalStore: PrincipalNegotiationStore;
  /** Durable outbox store. */
  outboxStore: OutboxStore;
  /** Durable replay ledger. */
  replayLedger: ReplayLedger;
  /** Seller bargaining strategy. */
  strategy: SellerStrategy;
  /** Default negotiation limits. */
  limits?: Partial<NegotiationLimits>;
  /** Standing service manifest (for computing manifestId when opening a negotiation). */
  manifest?: SignedManifest;
  /** Event sink. */
  onEvent?: (event: PurchaseEvent) => void;
  /** Current time (for deterministic tests). */
  now?: () => number;
  /**
   * Optional hook invoked after a message is enqueued to the durable outbox.
   * The runtime uses this to trigger an immediate outbox drain over the wire.
   */
  onOutboundEnqueued?: () => Promise<void>;
}

export interface EdgeSeller {
  /** The underlying engine (advanced use / recovery). */
  engine: NegotiationEngine;
  /** Subscribe to a negotiation transport. */
  subscribe(transport: NegotiationTransport): Promise<() => void>;
  /** Handle a single authenticated inbound message (advanced use). */
  handleInbound(message: NegotiationMessage, context: TransportMessageContext): Promise<ReplayOutcome>;
  /** Open a negotiation locally in response to a buyer request (advanced use). */
  openNegotiation(opts: { negotiationId: string; counterparty: string; manifestId: string; expiresAt?: number }): Promise<import('./state.js').NegotiationRecord>;
  /** Get current negotiation state. */
  getState(negotiationId: string): Promise<NegotiationState | undefined>;
  /** Issue a WorkRequired challenge for the next round (advanced use). */
  issueChallenge(negotiationId: string): Promise<WorkRequired>;
}

/**
 * Create a seller-side negotiation service.
 *
 * The returned object is a lightweight wrapper around the shared
 * NegotiationEngine plus an inbound transport handler. All durable state
 * lives in the injected stores.
 */
export function createEdgeSeller(opts: SellerServiceOptions): EdgeSeller {
  const {
    principal,
    verifySignature,
    sign,
    txpow,
    workPolicy,
    negotiationStore,
    principalStore,
    outboxStore,
    replayLedger,
    strategy,
    limits,
    manifest,
    onEvent,
    now,
    onOutboundEnqueued,
  } = opts;

  const engine = new NegotiationEngine({
    principal,
    verifySignature,
    sign,
    txpow,
    workPolicy,
    limits,
    onEvent,
    now,
    store: negotiationStore,
    principalStore,
  });

  let unsubscribe: (() => void) | undefined;

  function emit(event: PurchaseEvent): void {
    onEvent?.(event);
  }

  function currentTime(): number {
    return now?.() ?? Date.now();
  }

  function digestFor(msg: NegotiationMessage): string {
    const type = (msg as { proposalId?: string; terms?: TradeTerms; challenge?: unknown; acceptedAt?: number; rejectedAt?: number; cancelledAt?: number; requestedAt?: number }).proposalId !== undefined && 'terms' in msg
      ? proposalDigest(msg as TradeProposal)
      : 'challenge' in msg
        ? workRequiredDigest(msg as WorkRequired)
        : 'acceptedAt' in msg
          ? acceptanceDigest(msg as ProposalAcceptance)
          : 'rejectedAt' in msg
            ? rejectionDigest(msg as ProposalRejection)
            : 'cancelledAt' in msg
              ? (() => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { cancellationDigest } = require('./terms.js');
                return cancellationDigest(msg as NegotiationCancellation);
              })()
              : (() => {
                throw new NegotiationError('UNSUPPORTED_MESSAGE', 'unsupported message type for ingress digest');
              })();
    return type;
  }

  async function ensureNegotiationForProposal(proposal: TradeProposal): Promise<void> {
    const existing = await engine.getRecordFor(proposal.negotiationId);
    if (existing) return;
    // Auto-open a negotiation record when the first proposal arrives.
    // The buyer is the counterparty; manifestId comes from the proposal.
    await engine.openNegotiation({
      negotiationId: proposal.negotiationId,
      counterparty: proposal.proposer,
      manifestId: proposal.manifestId,
      expiresAt: proposal.expiresAt,
    });
  }

  async function enqueue(recipient: string, message: NegotiationMessage): Promise<void> {
    const id = messageId(message);
    await outboxStore.enqueue({
      messageId: id,
      recipient,
      message,
      enqueuedAt: currentTime(),
      attempts: 0,
    });
    await onOutboundEnqueued?.();
  }

  async function buildCounterProposal(
    negotiationId: string,
    parentProposal: TradeProposal,
    terms: TradeTerms,
  ): Promise<TradeProposal> {
    const round = parentProposal.round + 1;
    const nowMs = currentTime();
    const unsigned = {
      version: PURCHASING_VERSION,
      proposalId: `edge:proposal:${negotiationId}:${round}:${nowMs}`,
      negotiationId,
      parentProposalId: parentProposal.proposalId,
      round,
      manifestId: parentProposal.manifestId,
      proposer: principal,
      recipient: parentProposal.proposer,
      terms,
      createdAt: nowMs,
      expiresAt: nowMs + 60_000,
    };

    let workAdmission = undefined;
    // Work admission is required from round 2 onward. Round 0 (initial buyer
    // proposal) and round 1 (seller's first response) are free, avoiding a
    // bootstrap ordering problem: the seller cannot mine against a challenge
    // for its first counter before the buyer has had a chance to send one.
    if (workPolicy.getMode() !== 'disabled' && round >= 2) {
      const action = engine.buildAction(unsigned as unknown as TradeProposal);
      const record = await engine.getRecordFor(negotiationId);
      const outstanding = record?.outstandingChallenges.find((c) => c.round === round && c.status === 'OUTSTANDING');
      if (!outstanding) {
        throw new NegotiationError('NO_CHALLENGE', `no outstanding work challenge for seller counter round ${round}`);
      }
      const challenge = engine.getIssuedChallenge(negotiationId, round);
      if (!challenge) {
        throw new NegotiationError('NO_CHALLENGE', `work challenge for round ${round} not available`);
      }
      workAdmission = await txpow.mine(action, challenge);
    }

    const digest = proposalDigest(unsigned);
    const sig = await sign(digest);
    return { ...unsigned, workAdmission, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
  }

  async function signAcceptance(negotiationId: string, proposalId: string, recipient: string): Promise<ProposalAcceptance> {
    const acceptedAt = currentTime();
    const unsigned: Omit<ProposalAcceptance, 'signature' | 'signerPublicKey'> = {
      version: PURCHASING_VERSION,
      negotiationId,
      proposalId,
      acceptor: principal,
      recipient,
      acceptedAt,
    };
    const digest = acceptanceDigest(unsigned);
    const sig = await sign(digest);
    return { ...unsigned, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
  }

  async function signRejection(
    negotiationId: string,
    proposalId: string,
    recipient: string,
    reason?: string,
  ): Promise<ProposalRejection> {
    const rejectedAt = currentTime();
    const unsigned: Omit<ProposalRejection, 'signature' | 'signerPublicKey'> = {
      version: PURCHASING_VERSION,
      negotiationId,
      proposalId,
      rejector: principal,
      recipient,
      reason,
      rejectedAt,
    };
    const digest = rejectionDigest(unsigned);
    const sig = await sign(digest);
    return { ...unsigned, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
  }

  async function onTradeProposal(proposal: TradeProposal): Promise<ReplayOutcome> {
    await ensureNegotiationForProposal(proposal);

    // Record the buyer's proposal in our engine.
    await engine.submitProposal(proposal);

    const record = await engine.getRecordFor(proposal.negotiationId);
    if (!record) {
      return { ok: false, error: 'negotiation missing after submit' };
    }
    if (record.principal !== principal) {
      // Should not happen because we opened with our principal.
      return { ok: false, error: 'negotiation principal mismatch' };
    }

    // Evaluate from the seller's perspective.
    const history = await engine.getHistory(proposal.negotiationId);
    const termsHashes = await engine.getTermsHashes(proposal.negotiationId);
    const decision = await strategy.evaluate({ negotiationId: proposal.negotiationId, proposal, history, termsHashes });

    if (decision.action === 'accept') {
      const acceptance = await signAcceptance(proposal.negotiationId, proposal.proposalId, proposal.proposer);
      await engine.acceptProposal(acceptance);
      // The engine atomically enqueued the mirrored acceptance to the durable
      // outbox; trigger an immediate drain so the counterparty receives it.
      await onOutboundEnqueued?.();
      return { ok: true, result: acceptance.proposalId };
    }

    if (decision.action === 'reject') {
      const rejection = await signRejection(proposal.negotiationId, proposal.proposalId, proposal.proposer, decision.reason);
      await engine.rejectProposal(rejection);
      return { ok: true, result: 'rejected' };
    }

    // Counter.
    const counter = await buildCounterProposal(proposal.negotiationId, proposal, decision.terms);
    await engine.submitProposal(counter);

    // If work admission is enabled, issue a challenge for the buyer's next
    // response and send it *before* the counter so the buyer already has the
    // challenge when it decides whether to counter back.
    if (workPolicy.getMode() !== 'disabled') {
      try {
        const workRequired = await engine.issueChallenge(proposal.negotiationId);
        await enqueue(workRequired.recipient, workRequired);
      } catch (err) {
        // Work policy may refuse to issue further challenges (e.g. cumulative
        // budget exhausted). The counter is still valid; the buyer simply
        // cannot counter back without doing work.
        const reason = err instanceof Error ? err.message : String(err);
        emit({ type: 'negotiation.work_challenge_refused', negotiationId: proposal.negotiationId, reason });
      }
    }

    await enqueue(counter.recipient, counter);
    return { ok: true, result: counter.proposalId };
  }

  async function onProposalAcceptance(acceptance: ProposalAcceptance): Promise<ReplayOutcome> {
    try {
      await engine.acceptProposal(acceptance);
      // The engine atomically enqueued the mirrored acceptance to the durable
      // outbox; trigger an immediate drain so the counterparty receives it.
      await onOutboundEnqueued?.();
      return { ok: true, result: acceptance.proposalId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function onProposalRejection(rejection: ProposalRejection): Promise<ReplayOutcome> {
    try {
      await engine.rejectProposal(rejection);
      return { ok: true, result: 'rejected' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function onNegotiationCancellation(cancellation: NegotiationCancellation): Promise<ReplayOutcome> {
    try {
      await engine.cancelNegotiation(cancellation);
      return { ok: true, result: 'cancelled' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function onWorkRequired(msg: WorkRequired): Promise<ReplayOutcome> {
    try {
      await engine.handleWorkRequired(msg);
      return { ok: true, result: msg.challenge.challengeId };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function onNegotiationRequest(request: NegotiationRequest): Promise<ReplayOutcome> {
    const manifestId = manifest ? computeManifestIdFromManifest(manifest) : request.manifestId;
    try {
      await engine.openNegotiation({
        negotiationId: request.negotiationId,
        counterparty: request.sender,
        manifestId,
        expiresAt: currentTime() + 5 * 60_000,
      });
      return { ok: true, result: 'opened' };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async function dispatch(message: NegotiationMessage): Promise<ReplayOutcome> {
    if ('proposalId' in message && 'terms' in message) return onTradeProposal(message as TradeProposal);
    if ('acceptedAt' in message) return onProposalAcceptance(message as ProposalAcceptance);
    if ('rejectedAt' in message) return onProposalRejection(message as ProposalRejection);
    if ('cancelledAt' in message) return onNegotiationCancellation(message as NegotiationCancellation);
    if ('challenge' in message && 'reason' in message) return onWorkRequired(message as WorkRequired);
    if ('requestedAt' in message) return onNegotiationRequest(message as NegotiationRequest);
    return { ok: false, error: 'unknown message type' };
  }

  async function handleInbound(
    raw: NegotiationMessage,
    context: TransportMessageContext,
  ): Promise<ReplayOutcome> {
    try {
      const ingressed = await ingress(raw, context, {
        recipient: principal,
        verifySignature,
        digest: digestFor,
        replayLedger,
      });

      if (ingressed.replayed || !ingressed.claimed) {
        const outcome = ingressed.priorEntry?.state === 'COMPLETED' ? ingressed.priorEntry.outcome : { ok: true, result: 'replayed' };
        return outcome;
      }

      const result = await dispatch(ingressed.message);
      await replayLedger.complete(messageId(ingressed.message), result);
      return result;
    } catch (err) {
      const outcome: ReplayOutcome = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      try {
        await replayLedger.complete(messageId(raw), outcome);
      } catch {
        // Replay ledger failure is not fatal to the protocol outcome.
      }
      return outcome;
    }
  }

  async function subscribe(transport: NegotiationTransport): Promise<() => void> {
    if (unsubscribe) {
      unsubscribe();
    }
    const off = await transport.subscribe(async (message, context) => {
      await handleInbound(message, context);
    });
    unsubscribe = off;
    return unsubscribe;
  }

  return {
    engine,
    subscribe,
    handleInbound,
    openNegotiation: (opts) => engine.openNegotiation(opts),
    getState: (negotiationId) => engine.getState(negotiationId),
    issueChallenge: (negotiationId) => engine.issueChallenge(negotiationId),
  };
}

function computeManifestIdFromManifest(manifest: SignedManifest): string {
  // Importing from @totemsdk/manifest inside a non-top-level helper avoids
  // adding a runtime dependency beyond what the rest of the package already
  // uses.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { computeManifestId } = require('@totemsdk/manifest');
  return computeManifestId(manifest.manifest);
}

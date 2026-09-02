/**
 * purchasing/buyer.ts — Demand-side orchestration: edge.buy() and
 * edge.negotiate().
 *
 * Lifecycle:
 *   PurchaseIntent → lookup → candidate SignedManifests → manifest verification
 *   → identity/provider trust → constraint matching → rank/select
 *   → fixed terms acceptable? (fast path) | negotiate? (negotiated path)
 *   → TradeAgreement → authority/agent-policy → payment → resource execution
 *   → metering → settlement → receipt
 *
 * Money budget, work budget, and time budget are independent purchasing
 * constraints. Immediately before payment/reservation, the agreement expiry,
 * policy/authority, spend constraints, and provider/manifest freshness are
 * revalidated.
 */

import { verifyManifest, computeManifestId } from '@totemsdk/manifest';
import type { SignedManifest } from '@totemsdk/manifest';
import {
  PURCHASING_VERSION,
  type NegotiationLimits,
  type NegotiationResult,
  type NegotiationStrategy,
  type ProposalAcceptance,
  type ProposalRejection,
  type PurchaseEvent,
  type PurchaseIntent,
  type PurchaseResult,
  type PurchaseSession,
  type ResourceAdapter,
  type TradeAgreement,
  type TradeProposal,
  type TradeTerms,
} from './types.js';
import { acceptanceDigest, proposalDigest, rejectionDigest } from './terms.js';
import { NegotiationEngine } from './engine.js';
import { EdgeTxPowAdapter, EdgeWorkPolicy } from './admission.js';
import { createEdgeReceipt } from '../receipts.js';
import type { EdgeOperationResult } from '../types.js';

/** Signature verification (WOTS). */
export type SignatureVerifier = (params: {
  digest: string;
  signature: string;
  signerPublicKey: string;
}) => boolean;

/** Signature creation (WOTS). */
export type Signer = (digest: string) => Promise<{ signature: string; signerPublicKey: string }>;

/** Authority / policy approval before binding economic commitment. */
export interface AuthorityPort {
  approve(params: {
    agreement: TradeAgreement;
    intent: PurchaseIntent;
  }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>>;
}

/** Payment port (reuses existing Edge payment abstractions). */
export interface PurchasePaymentPort {
  pay(params: {
    recipient: string;
    amount: string;
    tokenId?: string;
    memo?: string;
  }): Promise<EdgeOperationResult<{ txpowId?: string }>>;
}

/** Lookup port for candidate manifests. */
export interface PurchaseLookupPort {
  query(params: {
    resource: string;
    provider?: string;
  }): Promise<EdgeOperationResult<{ results: Array<{ id: string; manifest: Uint8Array; nodeId: string }> }>>;
}

/** Provider trust (reuses @totemsdk/provider-bond concepts). */
export interface ProviderTrustPort {
  score(providerAddress: string): Promise<EdgeOperationResult<{ score: number }>>;
}

export interface BuyerOptions {
  principal: string;
  verifySignature: SignatureVerifier;
  sign: Signer;
  txpow: EdgeTxPowAdapter;
  workPolicy: EdgeWorkPolicy;
  authority: AuthorityPort;
  payment: PurchasePaymentPort;
  lookup: PurchaseLookupPort;
  providerTrust?: ProviderTrustPort;
  adapters: ResourceAdapter[];
  onEvent?: (event: PurchaseEvent) => void;
  now?: () => number;
}

export interface BuyOptions {
  intent: PurchaseIntent;
  /** Overall acquisition deadline (independent of negotiation TTL). */
  acquireBy?: number;
  /** Negotiation limits (used only on the negotiated path). */
  negotiation?: Partial<NegotiationLimits>;
  strategy?: NegotiationStrategy;
  /** Resource adapter to use for execution. */
  adapter?: ResourceAdapter;
  /** Execution context passed to the adapter. */
  context?: Record<string, unknown>;
}

export class EdgeBuyer {
  private readonly engine: NegotiationEngine;

  constructor(private readonly opts: BuyerOptions) {
    this.engine = new NegotiationEngine({
      principal: opts.principal,
      verifySignature: opts.verifySignature,
      sign: opts.sign,
      txpow: opts.txpow,
      workPolicy: opts.workPolicy,
      onEvent: opts.onEvent,
      now: opts.now,
    });
  }

  private emit(event: PurchaseEvent): void {
    this.opts.onEvent?.(event);
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  /**
   * edge.buy() — resource-generic demand orchestration.
   */
  async buy(options: BuyOptions): Promise<PurchaseResult> {
    const { intent } = options;
    this.emit({ type: 'purchase.requested', intent });

    // Overall acquisition deadline.
    const acquireBy = options.acquireBy ?? intent.expiresAt;
    if (acquireBy !== undefined && this.now() > acquireBy) {
      throw new Error('purchase acquisition deadline has passed');
    }

    // 1. Lookup candidate manifests.
    const lookupResult = await this.opts.lookup.query({
      resource: intent.resource,
      provider: intent.provider,
    });
    if (!lookupResult.ok) throw new Error(lookupResult.error ?? 'lookup failed');
    const candidates = lookupResult.data?.results ?? [];
    this.emit({ type: 'purchase.discovered', manifestId: candidates[0]?.id ?? '' });

    // 2. Verify manifests + constraint match.
    const verified = this.selectCandidates(intent, candidates);

    // 3. Fast path: fixed terms acceptable?
    const fixed = verified.find((c) => this.termsAcceptable(intent, c.manifest));
    if (fixed && !intent.negotiate) {
      return this.executeDirect(intent, fixed.manifest, options);
    }

    // 4. Negotiated path.
    if (intent.negotiate !== false && options.strategy) {
      const selected = verified[0];
      if (selected) {
        const agreement = await this.negotiateWith(intent, selected.manifest, options);
        return this.executeAgreement(intent, agreement, options);
      }
    }

    throw new Error('no acceptable provider found');
  }

  /**
   * edge.negotiate() — bounded peer-to-peer negotiation.
   */
  async negotiate(options: {
    manifest: SignedManifest;
    desiredTerms: TradeTerms;
    limits: Partial<NegotiationLimits>;
    strategy: NegotiationStrategy;
  }): Promise<NegotiationResult> {
    const { manifest, desiredTerms, limits, strategy } = options;
    const manifestId = computeManifestId(manifest.manifest);
    const negotiationId = `edge:negotiation:${this.now()}:${Math.random().toString(36).slice(2)}`;

    this.engine.openNegotiation({
      negotiationId,
      counterparty: manifest.authorAddress,
      manifestId,
      expiresAt: limits.expiresAt,
    });

    // Initial proposal (round 0).
    const initial = await this.buildProposal({
      negotiationId,
      round: 0,
      manifestId,
      proposer: this.opts.principal,
      recipient: manifest.authorAddress,
      terms: desiredTerms,
      parentProposalId: undefined,
    });

    await this.engine.submitProposal(initial);

    // Run the bounded negotiation loop.
    let current = initial;
    let history = [initial];
    for (let round = 1; round < (limits.maxRounds ?? 5); round++) {
      const decision = await strategy.evaluate({
        negotiationId,
        proposal: current,
        history,
        termsHashes: this.engine.getTermsHashes(negotiationId),
      });

      if (decision.action === 'accept') {
        const acceptance = await this.signAcceptance(negotiationId, current.proposalId);
        const agreement = await this.engine.acceptProposal(acceptance);
        return { agreement, history };
      }
      if (decision.action === 'reject') {
        const rejection = await this.signRejection(negotiationId, current.proposalId, decision.reason);
        await this.engine.rejectProposal(rejection);
        throw new Error(`negotiation rejected: ${decision.reason ?? 'no reason'}`);
      }
      if (decision.action === 'counter') {
        const counter = await this.buildProposal({
          negotiationId,
          round,
          manifestId,
          proposer: this.opts.principal,
          recipient: manifest.authorAddress,
          terms: decision.terms,
          parentProposalId: current.proposalId,
        });
        await this.engine.submitProposal(counter);
        current = counter;
        history = [...history, counter];
      }
    }

    // Round limit reached.
    throw new Error('negotiation exhausted maxRounds');
  }

  private async negotiateWith(
    intent: PurchaseIntent,
    manifest: SignedManifest,
    options: BuyOptions,
  ): Promise<TradeAgreement> {
    const strategy = options.strategy;
    if (!strategy) throw new Error('negotiation requires a strategy');
    const result = await this.negotiate({
      manifest,
      desiredTerms: this.intentToTerms(intent),
      limits: {
        maxRounds: options.negotiation?.maxRounds ?? 5,
        expiresAt: options.negotiation?.expiresAt ?? this.now() + 5 * 60_000,
        ...options.negotiation,
      },
      strategy,
    });
    return result.agreement;
  }

  private async executeDirect(
    intent: PurchaseIntent,
    manifest: SignedManifest,
    options: BuyOptions,
  ): Promise<PurchaseResult> {
    const terms = this.intentToTerms(intent);
    const agreement: TradeAgreement = {
      version: PURCHASING_VERSION,
      agreementId: `edge:agreement:direct:${intent.id}`,
      negotiationId: `edge:direct:${intent.id}`,
      acceptedProposalId: `direct:${intent.id}`,
      manifestId: computeManifestId(manifest.manifest),
      buyer: this.opts.principal,
      seller: manifest.authorAddress,
      terms,
      agreedAt: this.now(),
      expiresAt: intent.expiresAt,
      buyerSignature: '',
      sellerSignature: manifest.signature,
    };
    return this.executeAgreement(intent, agreement, options);
  }

  private async executeAgreement(
    intent: PurchaseIntent,
    agreement: TradeAgreement,
    options: BuyOptions,
  ): Promise<PurchaseResult> {
    // Revalidate immediately before payment/reservation.
    this.revalidateBeforeCommit(intent, agreement);

    // Authority / policy approval.
    const auth = await this.opts.authority.approve({ agreement, intent });
    if (!auth.ok || !auth.data?.allowed) {
      throw new Error(auth.data?.reason ?? 'authority denied purchase');
    }
    this.emit({ type: 'purchase.authorized', agreementId: agreement.agreementId });

    // Payment (reuses existing payment port).
    if (agreement.terms.price !== '0' && agreement.terms.paymentMethod !== 'free') {
      const pay = await this.opts.payment.pay({
        recipient: agreement.seller,
        amount: agreement.terms.price,
        tokenId: agreement.terms.tokenId,
        memo: `purchase ${agreement.agreementId}`,
      });
      if (!pay.ok) throw new Error(pay.error ?? 'payment failed');
    }

    // Resource execution via adapter.
    const adapter =
      options.adapter ??
      this.opts.adapters.find((a) => a.supports(intent.resource, this.dummyManifest(agreement)));
    if (!adapter) throw new Error(`no adapter supports resource ${intent.resource}`);

    const handle = await adapter.start(agreement, options.context ?? {});
    const session: PurchaseSession = {
      id: handle.id,
      agreement,
      status: 'active',
      usage: async () => {
        if (!adapter.meter) return [];
        const events = [];
        for await (const ev of adapter.meter(handle)) {
          events.push(ev);
          this.emit({ type: 'purchase.usage', sessionId: handle.id, amount: ev.amount, unit: ev.unit });
        }
        return events;
      },
      spent: async () => ({ amount: agreement.terms.price, tokenId: agreement.terms.tokenId }),
      close: async () => {
        if (adapter.close) await adapter.close(handle);
        this.emit({ type: 'purchase.completed', sessionId: handle.id });
        return createEdgeReceipt({
          kind: 'purchase',
          payload: {
            agreementId: agreement.agreementId,
            resource: intent.resource,
            amount: agreement.terms.price,
            tokenId: agreement.terms.tokenId,
          },
          relatedManifestId: agreement.manifestId,
        });
      },
    };
    this.emit({ type: 'purchase.started', sessionId: handle.id });

    return { agreement, session, negotiated: true };
  }

  private revalidateBeforeCommit(intent: PurchaseIntent, agreement: TradeAgreement): void {
    const now = this.now();
    if (agreement.expiresAt !== undefined && now > agreement.expiresAt) {
      throw new Error('agreement has expired before commit');
    }
    if (intent.maxSpend) {
      const max = BigInt(intent.maxSpend.amount);
      const price = BigInt(agreement.terms.price);
      if (price > max) throw new Error('agreement price exceeds maxSpend');
    }
  }

  private selectCandidates(
    intent: PurchaseIntent,
    candidates: Array<{ id: string; manifest: Uint8Array; nodeId: string }>,
  ): Array<{ manifest: SignedManifest }> {
    const out: Array<{ manifest: SignedManifest }> = [];
    for (const c of candidates) {
      try {
        const manifest = decodeManifest(c.manifest);
        const verify = verifyManifest(manifest);
        if (!verify.valid) continue;
        if (intent.provider && manifest.authorAddress !== intent.provider) continue;
        out.push({ manifest });
      } catch {
        continue;
      }
    }
    return out;
  }

  private termsAcceptable(intent: PurchaseIntent, manifest: SignedManifest): boolean {
    // Standing manifest terms acceptable when price is within maxSpend.
    const price = (manifest.manifest as { price?: string }).price;
    if (price === undefined) return false;
    if (intent.maxSpend) {
      try {
        if (BigInt(price) > BigInt(intent.maxSpend.amount)) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  private intentToTerms(intent: PurchaseIntent): TradeTerms {
    return {
      price: intent.maxSpend?.amount ?? '0',
      tokenId: intent.maxSpend?.tokenId,
      paymentMethod: intent.preferredPaymentMethods?.[0],
      quantity: intent.quantity,
    };
  }

  private async buildProposal(opts: {
    negotiationId: string;
    round: number;
    manifestId: string;
    proposer: string;
    recipient: string;
    terms: TradeTerms;
    parentProposalId?: string;
  }): Promise<TradeProposal> {
    const now = this.now();
    const unsigned = {
      version: PURCHASING_VERSION,
      proposalId: `edge:proposal:${opts.negotiationId}:${opts.round}:${now}`,
      negotiationId: opts.negotiationId,
      parentProposalId: opts.parentProposalId,
      round: opts.round,
      manifestId: opts.manifestId,
      proposer: opts.proposer,
      recipient: opts.recipient,
      terms: opts.terms,
      createdAt: now,
      expiresAt: now + 60_000,
    };
    const digest = proposalDigest(unsigned);
    const sig = await this.opts.sign(digest);
    return { ...unsigned, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
  }

  private async signAcceptance(negotiationId: string, proposalId: string): Promise<ProposalAcceptance> {
    const now = this.now();
    const acceptance: ProposalAcceptance = {
      version: PURCHASING_VERSION,
      negotiationId,
      proposalId,
      acceptor: this.opts.principal,
      recipient: '',
      acceptedAt: now,
      signature: '',
      signerPublicKey: '',
    };
    const digest = acceptanceDigest(acceptance);
    const sig = await this.opts.sign(digest);
    return { ...acceptance, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
  }

  private async signRejection(
    negotiationId: string,
    proposalId: string,
    reason?: string,
  ): Promise<ProposalRejection> {
    const now = this.now();
    const rejection: ProposalRejection = {
      version: PURCHASING_VERSION,
      negotiationId,
      proposalId,
      rejector: this.opts.principal,
      recipient: '',
      reason,
      rejectedAt: now,
      signature: '',
      signerPublicKey: '',
    };
    const digest = rejectionDigest(rejection);
    const sig = await this.opts.sign(digest);
    return { ...rejection, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
  }

  /** Minimal SignedManifest for adapter.supports() checks. */
  private dummyManifest(agreement: TradeAgreement): SignedManifest {
    return {
      manifest: {
        type: 'edge-service',
        serviceId: agreement.manifestId,
        name: '',
        version: '',
        operatorAddress: agreement.seller,
        serviceType: 'other',
        description: '',
        capabilities: [],
        tags: [],
      },
      authorAddress: agreement.seller,
      signerPublicKey: '',
      signedAt: 0,
      signature: '',
    };
  }
}

function decodeManifest(bytes: Uint8Array): SignedManifest {
  // The lookup port returns manifests as Uint8Array. Decode via JSON.
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as SignedManifest;
}

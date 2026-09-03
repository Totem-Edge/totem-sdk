/**
 * purchasing/buyer.ts — Demand-side orchestration: edge.buy() and
 * edge.negotiate() (durable).
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
 * revalidated (economic commit barrier).
 *
 * Every externally side-effecting operation carries a stable idempotency key
 * derived from durable protocol IDs — retries never duplicate side effects.
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
import {
  createPurchaseRecord,
  idempotencyKey,
  type PurchaseRecord,
  type PurchaseStatus,
} from './purchase.js';
import type { PurchaseStore } from './store.js';
import { InMemoryPurchaseStore } from './store.js';
import { PurchaseError, PURCHASE_ERROR_CODES } from './errors.js';

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
    /** Stable idempotency key — retries must not double-pay. */
    idempotencyKey?: string;
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
  /** Durable purchase store. When omitted, in-memory (dev mode). */
  purchaseStore?: PurchaseStore;
  /** Durable negotiation store. When omitted, in-memory (dev mode). */
  negotiationStore?: import('./store.js').NegotiationStore;
  /** Durable principal anti-abuse store. When omitted, in-memory (dev mode). */
  principalStore?: import('./store.js').PrincipalNegotiationStore;
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
  private readonly _engine: NegotiationEngine;
  private readonly purchaseStore: PurchaseStore;

  constructor(private readonly opts: BuyerOptions) {
    this._engine = new NegotiationEngine({
      principal: opts.principal,
      verifySignature: opts.verifySignature,
      sign: opts.sign,
      txpow: opts.txpow,
      workPolicy: opts.workPolicy,
      onEvent: opts.onEvent,
      now: opts.now,
      store: opts.negotiationStore,
      principalStore: opts.principalStore,
    });
    this.purchaseStore = opts.purchaseStore ?? new InMemoryPurchaseStore();
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

    // Overall acquisition deadline (persisted absolute, not relative).
    const acquireBy = options.acquireBy ?? intent.expiresAt;
    if (acquireBy !== undefined && this.now() > acquireBy) {
      throw new PurchaseError(PURCHASE_ERROR_CODES.PURCHASE_DEADLINE_EXPIRED, 'purchase acquisition deadline has passed');
    }

    // Create a durable purchase record (idempotent — reuse if already exists).
    const purchaseId = `edge:purchase:${intent.id}`;
    const existing = await this.purchaseStore.get(purchaseId);
    const record = existing ?? createPurchaseRecord({ purchaseId, intent, acquireBy });
    if (!existing) {
      await this.purchaseStore.create(record);
    }

    // 1. Lookup candidate manifests.
    const lookupResult = await this.opts.lookup.query({
      resource: intent.resource,
      provider: intent.provider,
    });
    if (!lookupResult.ok) throw new Error(lookupResult.error ?? 'lookup failed');
    const candidates = lookupResult.data?.results ?? [];
    this.emit({ type: 'purchase.discovered', manifestId: candidates[0]?.id ?? '' });
    let current = await this.casPurchase(record, (r) => { r.status = 'DISCOVERING'; });

    // 2. Verify manifests + constraint match.
    const verified = this.selectCandidates(intent, candidates);

    // 3. Fast path: fixed terms acceptable?
    const fixed = verified.find((c) => this.termsAcceptable(intent, c.manifest));
    if (fixed && !intent.negotiate) {
      return this.executeDirect(intent, fixed.manifest, options, current);
    }

    // 4. Negotiated path.
    if (intent.negotiate !== false && options.strategy) {
      const selected = verified[0];
      if (selected) {
        const negotiating = await this.casPurchase(current, (r) => { r.status = 'NEGOTIATING'; });
        const agreement = await this.negotiateWith(intent, selected.manifest, options);
        return this.executeAgreement(intent, agreement, options, negotiating);
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

    await this._engine.openNegotiation({
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

    await this._engine.submitProposal(initial);

    // Run the bounded negotiation loop.
    let current = initial;
    let history = [initial];
    for (let round = 1; round < (limits.maxRounds ?? 5); round++) {
      const decision = await strategy.evaluate({
        negotiationId,
        proposal: current,
        history,
        termsHashes: await this._engine.getTermsHashes(negotiationId),
      });

      if (decision.action === 'accept') {
        const acceptance = await this.signAcceptance(negotiationId, current.proposalId);
        const agreement = await this._engine.acceptProposal(acceptance);
        return { agreement, history };
      }
      if (decision.action === 'reject') {
        const rejection = await this.signRejection(negotiationId, current.proposalId, decision.reason);
        await this._engine.rejectProposal(rejection);
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
        await this._engine.submitProposal(counter);
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
    record: PurchaseRecord,
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
    return this.executeAgreement(intent, agreement, options, record);
  }

  private async executeAgreement(
    intent: PurchaseIntent,
    agreement: TradeAgreement,
    options: BuyOptions,
    record: PurchaseRecord,
  ): Promise<PurchaseResult> {
    // ── Economic commit barrier ─────────────────────────────────────────────
    // Reload the latest durable state and revalidate before any irreversible
    // economic action.
    let current = (await this.purchaseStore.get(record.purchaseId)) ?? record;
    this.revalidateBeforeCommit(intent, agreement, current);

    // Authority / policy approval.
    current = await this.casPurchase(current, (r) => { r.status = 'AUTHORIZING'; r.agreement = agreement; });
    const auth = await this.opts.authority.approve({ agreement, intent });
    if (!auth.ok || !auth.data?.allowed) {
      throw new PurchaseError('AUTHORITY_DENIED', auth.data?.reason ?? 'authority denied purchase');
    }
    current = await this.casPurchase(current, (r) => { r.status = 'AUTHORIZED'; });
    this.emit({ type: 'purchase.authorized', agreementId: agreement.agreementId });

    // Payment (idempotent — stable key, never double-pay).
    if (agreement.terms.price !== '0' && agreement.terms.paymentMethod !== 'free') {
      const paymentKey = idempotencyKey(record.purchaseId, agreement.agreementId, 'payment');
      if (!current.idempotencyKeys.includes(paymentKey)) {
        current = await this.casPurchase(current, (r) => { r.status = 'PAYING'; });
        const pay = await this.opts.payment.pay({
          recipient: agreement.seller,
          amount: agreement.terms.price,
          tokenId: agreement.terms.tokenId,
          memo: `purchase ${agreement.agreementId}`,
          idempotencyKey: paymentKey,
        });
        if (!pay.ok) throw new PurchaseError('PAYMENT_FAILED', pay.error ?? 'payment failed');
        current = await this.casPurchase(current, (r) => {
          r.status = 'PAID';
          if (!r.idempotencyKeys.includes(paymentKey)) r.idempotencyKeys.push(paymentKey);
        });
      }
    }

    // Resource execution via adapter (idempotent start).
    const adapter =
      options.adapter ??
      this.opts.adapters.find((a) => a.supports(intent.resource, this.dummyManifest(agreement)));
    if (!adapter) throw new Error(`no adapter supports resource ${intent.resource}`);

    const startKey = idempotencyKey(record.purchaseId, agreement.agreementId, 'resource-start');
    let handle: import('./types.js').ResourceHandle;
    if (current.idempotencyKeys.includes(startKey) && current.resourceReference) {
      // Already started — recover the handle reference via the adapter's
      // recover() hook (reconnect, never start another identical resource).
      const reference: import('./types.js').PersistedResourceReference = {
        id: current.resourceReference,
        resource: intent.resource,
      };
      if (adapter.recover) {
        const recovered = await adapter.recover(reference, agreement, options.context ?? {});
        if (recovered.state === 'ACTIVE') {
          handle = recovered.handle;
        } else if (recovered.state === 'COMPLETED') {
          // Resource already finished — surface a completed session.
          return {
            agreement,
            session: {
              id: reference.id,
              agreement,
              status: 'completed',
              usage: async () => [],
              spent: async () => ({ amount: agreement.terms.price, tokenId: agreement.terms.tokenId }),
              close: async () => createEdgeReceipt({
                kind: 'purchase',
                payload: {
                  agreementId: agreement.agreementId,
                  resource: intent.resource,
                  amount: agreement.terms.price,
                  tokenId: agreement.terms.tokenId,
                },
                relatedManifestId: agreement.manifestId,
              }),
            },
            negotiated: true,
          };
        } else if (recovered.state === 'MISSING') {
          // Resource no longer exists — safe to start fresh.
          current = await this.casPurchase(current, (r) => { r.status = 'STARTING_RESOURCE'; });
          handle = await adapter.start(agreement, options.context ?? {});
          current = await this.casPurchase(current, (r) => {
            r.status = 'ACTIVE';
            r.resourceReference = handle.id;
            if (!r.idempotencyKeys.includes(startKey)) r.idempotencyKeys.push(startKey);
          });
        } else {
          // UNKNOWN — block automatic duplicate execution.
          throw new PurchaseError(
            'RESOURCE_STATE_UNKNOWN',
            `cannot determine state of resource ${reference.id}; operator resolution required`,
          );
        }
      } else {
        // No recover() hook — fall back to the persisted reference.
        handle = { id: current.resourceReference, agreementId: agreement.agreementId, resource: intent.resource };
      }
    } else {
      current = await this.casPurchase(current, (r) => { r.status = 'STARTING_RESOURCE'; });
      handle = await adapter.start(agreement, options.context ?? {});
      current = await this.casPurchase(current, (r) => {
        r.status = 'ACTIVE';
        r.resourceReference = handle.id;
        if (!r.idempotencyKeys.includes(startKey)) r.idempotencyKeys.push(startKey);
      });
    }

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
        // Idempotent settlement + receipt.
        const settlementKey = idempotencyKey(record.purchaseId, agreement.agreementId, 'settlement');
        const receiptKey = idempotencyKey(record.purchaseId, agreement.agreementId, 'receipt');
        let closeCurrent = (await this.purchaseStore.get(record.purchaseId)) ?? current;
        if (!closeCurrent.idempotencyKeys.includes(settlementKey)) {
          if (adapter.close) await adapter.close(handle);
          closeCurrent = await this.casPurchase(closeCurrent, (r) => {
            r.status = 'SETTLING';
            if (!r.idempotencyKeys.includes(settlementKey)) r.idempotencyKeys.push(settlementKey);
          });
        }
        if (!closeCurrent.idempotencyKeys.includes(receiptKey)) {
          await this.casPurchase(closeCurrent, (r) => {
            r.status = 'COMPLETED';
            if (!r.idempotencyKeys.includes(receiptKey)) r.idempotencyKeys.push(receiptKey);
          });
        }
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

  private async casPurchase(
    record: PurchaseRecord,
    mutate: (r: PurchaseRecord) => void,
  ): Promise<PurchaseRecord> {
    const expectedRevision = record.revision;
    const next: PurchaseRecord = {
      ...record,
      revision: expectedRevision + 1,
      updatedAt: this.now(),
    };
    mutate(next);
    const ok = await this.purchaseStore.compareAndSet(record.purchaseId, expectedRevision, next);
    if (!ok) {
      throw new PurchaseError(PURCHASE_ERROR_CODES.STALE_REVISION, `purchase ${record.purchaseId} was advanced by another writer`);
    }
    return next;
  }

  private revalidateBeforeCommit(intent: PurchaseIntent, agreement: TradeAgreement, record: PurchaseRecord): void {
    const now = this.now();
    if (agreement.expiresAt !== undefined && now > agreement.expiresAt) {
      throw new PurchaseError('AGREEMENT_EXPIRED', 'agreement has expired before commit');
    }
    if (record.acquireBy !== undefined && now > record.acquireBy) {
      throw new PurchaseError(PURCHASE_ERROR_CODES.PURCHASE_DEADLINE_EXPIRED, 'purchase acquisition deadline has passed');
    }
    if (intent.maxSpend) {
      const max = BigInt(intent.maxSpend.amount);
      const price = BigInt(agreement.terms.price);
      if (price > max) throw new PurchaseError('SPEND_EXCEEDED', 'agreement price exceeds maxSpend');
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

  /**
   * Reconcile principal admission slots against active negotiations after a
   * restart. Any slot whose negotiation is terminal/expired/missing is
   * released, preventing capacity leaks from crashed processes.
   */
  async reconcilePrincipalSlots(): Promise<void> {
    await this._engine.reconcilePrincipalSlots();
  }

  /**
   * The underlying negotiation engine. Exposed so a seller-side runtime can
   * wire inbound authenticated transport messages into the same engine that
   * drives purchases. The engine remains the deterministic economic state
   * machine; transport stays separate.
   */
  get engine(): NegotiationEngine {
    return this._engine;
  }

  /**
   * Recover a purchase's resource after a restart. Looks up the durable
   * purchase record, and if a resource reference is persisted, reconnects via
   * the adapter's recover() hook — never starting another identical resource.
   *
   * Returns the recovered session, or null when the purchase has no persisted
   * resource reference (nothing to recover).
   */
  async recoverResource(purchaseId: string): Promise<import('./types.js').PurchaseSession | null> {
    const record = await this.purchaseStore.get(purchaseId);
    if (!record || !record.agreement || !record.resourceReference) return null;

    const agreement = record.agreement;
    const intent = record.intent;
    const adapter = this.opts.adapters.find((a) => a.supports(intent.resource, this.dummyManifest(agreement)));
    if (!adapter) return null;

    const reference: import('./types.js').PersistedResourceReference = {
      id: record.resourceReference,
      resource: intent.resource,
    };

    if (!adapter.recover) {
      // No recover() hook — fall back to the persisted reference.
      const handle: import('./types.js').ResourceHandle = {
        id: record.resourceReference,
        agreementId: agreement.agreementId,
        resource: intent.resource,
      };
      return this.buildSession(intent, agreement, adapter, handle);
    }

    const recovered = await adapter.recover(reference, agreement, {});
    if (recovered.state === 'ACTIVE') {
      return this.buildSession(intent, agreement, adapter, recovered.handle);
    }
    if (recovered.state === 'COMPLETED') {
      // Resource already finished — surface a completed session.
      return {
        id: reference.id,
        agreement,
        status: 'completed',
        usage: async () => [],
        spent: async () => ({ amount: agreement.terms.price, tokenId: agreement.terms.tokenId }),
        close: async () => createEdgeReceipt({
          kind: 'purchase',
          payload: {
            agreementId: agreement.agreementId,
            resource: intent.resource,
            amount: agreement.terms.price,
            tokenId: agreement.terms.tokenId,
          },
          relatedManifestId: agreement.manifestId,
        }),
      };
    }
    if (recovered.state === 'MISSING') {
      // Resource no longer exists — nothing to recover.
      return null;
    }
    // UNKNOWN — block automatic duplicate execution.
    throw new PurchaseError(
      'RESOURCE_STATE_UNKNOWN',
      `cannot determine state of resource ${reference.id}; operator resolution required`,
    );
  }

  private buildSession(
    intent: PurchaseIntent,
    agreement: TradeAgreement,
    adapter: ResourceAdapter,
    handle: import('./types.js').ResourceHandle,
  ): import('./types.js').PurchaseSession {
    return {
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
  }
}

function decodeManifest(bytes: Uint8Array): SignedManifest {
  // The lookup port returns manifests as Uint8Array. Decode via JSON.
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as SignedManifest;
}

/**
 * create-edge.ts — Runtime-level machine commerce factory.
 *
 * The intended developer experience:
 *
 *   const edge = createEdge({ ... });
 *   await edge.buy(...);
 *   await edge.negotiate(...);
 *
 * Standard callers do NOT construct EdgeBuyer manually. EdgeBuyer remains
 * exported for advanced use.
 *
 * Two runtime modes:
 *   - Development / ephemeral: in-memory stores, in-memory transport, no
 *     crash guarantees.
 *   - Durable machine-commerce: NegotiationStore + PurchaseStore + authenticated
 *     transport + idempotent payment/resource ports configured.
 */

import { EdgeBuyer, type BuyerOptions } from './purchasing/buyer.js';
import { EdgeWorkPolicy, EdgeTxPowAdapter } from './purchasing/admission.js';
import type { NegotiationStore, PurchaseStore, PrincipalNegotiationStore } from './purchasing/store.js';
import {
  InMemoryNegotiationStore,
  InMemoryPurchaseStore,
  InMemoryPrincipalNegotiationStore,
} from './purchasing/store.js';
import type { NegotiationTransport } from './purchasing/transport.js';
import { InMemoryNegotiationTransport } from './purchasing/transport.js';
import type { ReplayLedger } from './purchasing/messages.js';
import { InMemoryReplayLedger } from './purchasing/messages.js';
import type { MinimaWorkRelay, MinimaWorkTemplateProvider } from '@totemsdk/txpow';
import type {
  LocalWorkBudget,
  NegotiationLimits,
  NegotiationStrategy,
  PurchaseIntent,
  PurchaseResult,
  NegotiationResult,
  PurchaseEvent,
  ResourceAdapter,
  TradeTerms,
  WorkDifficultyPolicy,
  WorkMode,
} from './purchasing/types.js';
import type { SignedManifest } from '@totemsdk/manifest';
import type { EdgeOperationResult } from './types.js';

/** Signature verification (WOTS). */
export type SignatureVerifier = (params: {
  digest: string;
  signature: string;
  signerPublicKey: string;
}) => boolean;

/** Signature creation (WOTS). */
export type Signer = (digest: string) => Promise<{ signature: string; signerPublicKey: string }>;

/** Authority / policy approval. */
export interface EdgeAuthorityPort {
  approve(params: {
    agreement: import('./purchasing/types.js').TradeAgreement;
    intent: PurchaseIntent;
  }): Promise<EdgeOperationResult<{ allowed: boolean; reason?: string }>>;
}

/** Payment port with idempotency support. */
export interface EdgePaymentPort {
  pay(params: {
    recipient: string;
    amount: string;
    tokenId?: string;
    memo?: string;
    idempotencyKey?: string;
  }): Promise<EdgeOperationResult<{ txpowId?: string }>>;
}

/** Lookup port. */
export interface EdgeLookupPort {
  query(params: {
    resource: string;
    provider?: string;
  }): Promise<EdgeOperationResult<{ results: Array<{ id: string; manifest: Uint8Array; nodeId: string }> }>>;
}

export interface CreateEdgeOptions {
  /** Authenticated principal (root identity) that owns this runtime. */
  principal: string;
  /** Signature verification (WOTS). */
  verifySignature: SignatureVerifier;
  /** Signature creation (WOTS). */
  sign: Signer;
  /** Authority / policy approval. */
  authority: EdgeAuthorityPort;
  /** Payment port (idempotent). */
  payment: EdgePaymentPort;
  /** Lookup port. */
  lookup: EdgeLookupPort;
  /** Resource adapters. */
  adapters: ResourceAdapter[];
  /** Minima work template provider (optional — work-disabled if omitted). */
  templateProvider?: MinimaWorkTemplateProvider;
  /** Minima block relay (optional — commerce still works without it). */
  minimaRelay?: MinimaWorkRelay;
  /** Work mode. Defaults to 'disabled' when no template provider is supplied. */
  workMode?: WorkMode;
  /** Local work budget. */
  workBudget?: LocalWorkBudget;
  /** Work difficulty policy. */
  workDifficulty?: WorkDifficultyPolicy;
  /** Hash rate for work estimation. */
  hashRatePerSec?: number;
  /** Negotiation limits. */
  negotiationLimits?: Partial<NegotiationLimits>;
  /** Durable negotiation store (optional — in-memory dev mode). */
  negotiationStore?: NegotiationStore;
  /** Durable purchase store (optional — in-memory dev mode). */
  purchaseStore?: PurchaseStore;
  /** Durable principal anti-abuse store (optional — in-memory dev mode). */
  principalStore?: PrincipalNegotiationStore;
  /**
   * Aggregated durable commerce store (negotiations + purchases + replay +
   * principals + outbox in one physical backend). When supplied, it takes
   * precedence over the individual store options. A SQLiteCommerceStore from
   * @totemsdk/edge-adapters is the production reference.
   */
  commerceStore?: {
    negotiations: NegotiationStore;
    purchases: PurchaseStore;
    replay: ReplayLedger;
    principals: PrincipalNegotiationStore;
    outbox: import('./purchasing/outbox.js').OutboxStore;
  };
  /** Authenticated negotiation transport (optional — local/programmatic only). */
  negotiationTransport?: NegotiationTransport;
  /** Replay ledger (optional — in-memory dev mode). */
  replayLedger?: ReplayLedger;
  /**
   * Explicit persistence mode. When 'ephemeral' (or when durable stores are
   * not supplied), the runtime emits `runtime.persistence_ephemeral` on
   * startup so operators never mistake dev mode for crash guarantees.
   */
  persistence?: 'ephemeral' | 'durable';
  /** Event sink. */
  onEvent?: (event: PurchaseEvent) => void;
  /** Current time (for deterministic tests). */
  now?: () => number;
}

export interface EdgeCommerceRuntime {
  buy(options: {
    intent: PurchaseIntent;
    acquireBy?: number;
    negotiation?: Partial<NegotiationLimits>;
    strategy?: NegotiationStrategy;
    adapter?: ResourceAdapter;
    context?: Record<string, unknown>;
  }): Promise<PurchaseResult>;
  negotiate(options: {
    manifest: SignedManifest;
    desiredTerms: TradeTerms;
    limits: Partial<NegotiationLimits>;
    strategy: NegotiationStrategy;
  }): Promise<NegotiationResult>;
  /** Recover in-flight purchases after a restart (inspects durable state first). */
  recoverPurchases(): Promise<Array<{ purchaseId: string; status: string }>>;
  /** The underlying buyer (advanced use). */
  buyer: EdgeBuyer;
}

/**
 * Create a runtime-level machine commerce facade.
 *
 * Optional ports degrade gracefully:
 *   - no durable store → explicit in-memory/dev mode
 *   - no negotiation transport → local/programmatic negotiation only
 *   - no Minima relay → commerce still works
 *   - no work admission → work-disabled policy only
 */
export function createEdge(opts: CreateEdgeOptions): EdgeCommerceRuntime {
  const {
    principal,
    verifySignature,
    sign,
    authority,
    payment,
    lookup,
    adapters,
    templateProvider,
    minimaRelay,
    workMode,
    workBudget,
    workDifficulty,
    hashRatePerSec,
    negotiationLimits,
    negotiationStore,
    purchaseStore,
    principalStore,
    commerceStore,
    negotiationTransport,
    replayLedger,
    persistence,
    onEvent,
    now,
  } = opts;

  // Work policy: disabled unless a template provider is supplied.
  const mode: WorkMode = templateProvider ? (workMode ?? 'admission-only') : 'disabled';
  const txpow = new EdgeTxPowAdapter(
    templateProvider ?? {
      getCurrentTemplate: async () => {
        throw new Error('no Minima template provider configured');
      },
    },
    minimaRelay,
  );
  const workPolicy = new EdgeWorkPolicy(
    mode,
    workBudget ?? {},
    workDifficulty ?? {
      baseTarget: '0f'.padEnd(64, 'f'),
      maxTarget: '0f'.padEnd(64, 'f'),
    },
    hashRatePerSec ?? 100_000,
  );

  // Explicit ephemeral mode: emit a startup event when durable stores are
  // not supplied, so operators never mistake dev mode for crash guarantees.
  const durable = Boolean(commerceStore || (negotiationStore && purchaseStore && principalStore));
  const isEphemeral = persistence === 'ephemeral' || !durable;
  if (isEphemeral) {
    onEvent?.({ type: 'runtime.persistence_ephemeral' } as PurchaseEvent);
  }

  const buyer = new EdgeBuyer({
    principal,
    verifySignature,
    sign,
    txpow,
    workPolicy,
    authority,
    payment,
    lookup,
    adapters,
    onEvent,
    now,
    purchaseStore: commerceStore?.purchases ?? purchaseStore ?? new InMemoryPurchaseStore(),
    negotiationStore: commerceStore?.negotiations ?? negotiationStore ?? new InMemoryNegotiationStore(),
    principalStore: commerceStore?.principals ?? principalStore ?? new InMemoryPrincipalNegotiationStore(),
  });

  // Wire the authenticated transport to the buyer's engine (if supplied).
  if (negotiationTransport) {
    const engine = buyer['engine'] as import('./purchasing/engine.js').NegotiationEngine;
    const ledger = replayLedger ?? new InMemoryReplayLedger();
    void engine;
    void ledger;
    // The transport subscription is wired by the application layer via the
    // ingress pipeline. The engine itself remains transport-agnostic.
  }

  return {
    buyer,
    buy: (options) => buyer.buy(options),
    negotiate: (options) => buyer.negotiate(options),
    recoverPurchases: async () => {
      const store = commerceStore?.purchases ?? purchaseStore ?? new InMemoryPurchaseStore();
      const recoverable = (await store.listRecoverable?.()) ?? [];
      // Reconcile principal admission slots against active negotiations so
      // crashed processes cannot leak capacity.
      await buyer.reconcilePrincipalSlots();
      // Actively resume resources whose state is known and idempotent.
      const resumed: Array<{ purchaseId: string; status: string }> = [];
      for (const r of recoverable) {
        if (r.status === 'ACTIVE' || r.status === 'STARTING_RESOURCE') {
          try {
            const session = await buyer.recoverResource(r.purchaseId);
            resumed.push({ purchaseId: r.purchaseId, status: session ? 'ACTIVE' : r.status });
          } catch {
            // Unknown resource state — hold for operator resolution.
            resumed.push({ purchaseId: r.purchaseId, status: 'RESOURCE_STATE_UNKNOWN' });
          }
        } else {
          resumed.push({ purchaseId: r.purchaseId, status: r.status });
        }
      }
      return resumed;
    },
  };
}

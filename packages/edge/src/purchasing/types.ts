/**
 * purchasing/types.ts — Machine-native purchasing and bounded peer-to-peer
 * economic negotiation types for @totemsdk/edge.
 *
 * The economic lifecycle:
 *   Manifest          "What I generally provide." (standing supply — @totemsdk/manifest)
 *   PurchaseIntent    "What I want."
 *   TradeProposal     "These are the exact terms I offer now."
 *   Counterproposal   "A new TradeProposal linked to the previous proposal."
 *   TradeAgreement    "These are the exact mutually accepted terms."
 *   PurchaseSession   "The resource/value exchange is active."
 *   EdgeReceipt       "This is what happened."
 *
 * Negotiation is bounded protocol machinery, not an endless conversation.
 * Every counteroffer consumes one finite round and may consume fresh work.
 */

import type { MachineWorkAdmissionProof, WorkChallenge } from '@totemsdk/txpow';
import type { SignedManifest } from '@totemsdk/manifest';

/** Current purchasing protocol version. */
export const PURCHASING_VERSION = 1;

/** Default maximum negotiation rounds (rounds 0..maxRounds-1 are allowed). */
export const DEFAULT_MAX_ROUNDS = 5;

/** Default negotiation TTL (ms). */
export const DEFAULT_NEGOTIATION_TTL_MS = 5 * 60 * 1000;

/** Default per-principal concurrency limit. */
export const DEFAULT_MAX_CONCURRENT_NEGOTIATIONS = 4;

/** Default cooldown after a terminal negotiation (ms). */
export const DEFAULT_NEGOTIATION_COOLDOWN_MS = 30_000;

/** Default max negotiations per rolling window. */
export const DEFAULT_MAX_NEGOTIATIONS_PER_WINDOW = 20;

/** Default rolling window (ms). */
export const DEFAULT_NEGOTIATION_WINDOW_MS = 10 * 60 * 1000;

/**
 * A generic demand-side intent.
 *
 * `Resource` is an open-ended string (e.g. "compute", "storage", "bandwidth",
 * "energy", "sensor-data", "api", "robot-action"). `Constraints` is a typed
 * extensible payload — not an unrestricted giant Record.
 */
export interface PurchaseIntent<
  Resource extends string = string,
  Constraints = unknown,
> {
  id: string;
  resource: Resource;
  constraints?: Constraints;
  quantity?: {
    amount: string;
    unit: string;
  };
  maxSpend?: {
    amount: string;
    tokenId?: string;
  };
  preferredPaymentMethods?: string[];
  provider?: string;
  negotiate?: boolean;
  expiresAt?: number;
}

/**
 * Resource-generic trade terms.
 *
 * Supports machine negotiations over price, quantity, duration, unit, latency,
 * location, payment asset, payment method, settlement interval, proof
 * requirements, SLA, priority, availability window, quality, and cancellation.
 * Uses typed extensibility via `extras` rather than an unrestricted giant
 * Record<string, unknown>.
 */
export interface TradeTerms {
  /** Price in the token's native unit (string to preserve precision). */
  price: string;
  /** Minima tokenId, or '0x00' for native Minima. */
  tokenId?: string;
  /** Payment method (e.g. 'omnia', 'onchain', 'invoice', 'free'). */
  paymentMethod?: string;
  quantity?: {
    amount: string;
    unit: string;
  };
  /** Duration in milliseconds. */
  durationMs?: number;
  /** Maximum acceptable latency in milliseconds. */
  maxLatencyMs?: number;
  /** Geographic region / location constraint. */
  location?: string;
  /** Settlement interval in milliseconds. */
  settlementIntervalMs?: number;
  /** Proof requirements (e.g. 'location-proof', 'none'). */
  proofRequirements?: string[];
  /** Service-level agreement label. */
  sla?: string;
  /** Priority level. */
  priority?: number;
  /** Availability window [startMs, endMs]. */
  availabilityWindowMs?: [number, number];
  /** Quality level. */
  quality?: string;
  /** Cancellation policy label. */
  cancellationPolicy?: string;
  /** Typed extensibility — domain-specific terms. */
  extras?: Record<string, string>;
}

/**
 * A role-neutral signed proposal used for:
 *   - initial buyer proposal
 *   - seller quote
 *   - buyer counter
 *   - seller counter
 *
 * A counteroffer is NOT a separate protocol object — it is a TradeProposal
 * with `parentProposalId` set and `round = parent.round + 1`.
 */
export interface TradeProposal {
  version: number;
  proposalId: string;
  negotiationId: string;
  parentProposalId?: string;
  round: number;
  manifestId: string;
  proposer: string;
  recipient: string;
  terms: TradeTerms;
  createdAt: number;
  expiresAt: number;
  /** Optional Machine Work Admission proof bound to this proposal. */
  workAdmission?: MachineWorkAdmissionProof;
  /** WOTS signature over the canonical proposal digest. */
  signature: string;
  /** WOTS public-key digest (hex) of the proposer — for verification. */
  signerPublicKey: string;
}

/**
 * An accepted proposal becomes a distinct immutable agreement.
 */
export interface TradeAgreement {
  version: number;
  agreementId: string;
  negotiationId: string;
  acceptedProposalId: string;
  manifestId: string;
  buyer: string;
  seller: string;
  terms: TradeTerms;
  agreedAt: number;
  expiresAt?: number;
  buyerSignature: string;
  sellerSignature: string;
}

/**
 * A signed Edge protocol message wrapping a WorkChallenge.
 *
 * WorkChallenge itself is intentionally unsigned generic TxPoW data. Edge
 * authenticates the challenge issuer by wrapping it in a signed message.
 */
export interface WorkRequired {
  version: number;
  negotiationId: string;
  proposalId?: string;
  sender: string;
  recipient: string;
  challenge: WorkChallenge;
  reason: 'initial-proposal' | 'counterproposal' | 'resource-admission';
  signature: string;
  signerPublicKey: string;
}

/** Acceptance of the current proposal head. */
export interface ProposalAcceptance {
  version: number;
  negotiationId: string;
  proposalId: string;
  acceptor: string;
  recipient: string;
  acceptedAt: number;
  signature: string;
  signerPublicKey: string;
}

/** Rejection of the current proposal head. */
export interface ProposalRejection {
  version: number;
  negotiationId: string;
  proposalId: string;
  rejector: string;
  recipient: string;
  reason?: string;
  rejectedAt: number;
  signature: string;
  signerPublicKey: string;
}

/** Cancellation of a negotiation. */
export interface NegotiationCancellation {
  version: number;
  negotiationId: string;
  sender: string;
  recipient: string;
  reason?: string;
  cancelledAt: number;
  signature: string;
  signerPublicKey: string;
}

/** Initial negotiation request (before any proposal). */
export interface NegotiationRequest {
  version: number;
  negotiationId: string;
  sender: string;
  recipient: string;
  manifestId: string;
  desiredTerms: TradeTerms;
  requestedAt: number;
  signature: string;
  signerPublicKey: string;
}

/** The minimum set of peer-to-peer negotiation messages. */
export type NegotiationMessage =
  | NegotiationRequest
  | WorkRequired
  | TradeProposal
  | ProposalAcceptance
  | ProposalRejection
  | NegotiationCancellation;

/** Negotiation state machine states. */
export type NegotiationState =
  | 'OPEN'
  | 'NEGOTIATING'
  | 'AGREED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXHAUSTED'
  | 'EXPIRED';

/** All terminal states. */
export const TERMINAL_NEGOTIATION_STATES: ReadonlySet<NegotiationState> = new Set([
  'AGREED',
  'REJECTED',
  'CANCELLED',
  'EXHAUSTED',
  'EXPIRED',
]);

/**
 * Local work budget — Edge-level policy for whether the machine is willing to
 * perform a challenge. Cryptographic verification still depends on
 * challenge.target, not local timing estimates.
 */
export interface LocalWorkBudget {
  /** Maximum expected hashes for a single challenge. */
  maxExpectedHashes?: bigint;
  /** Maximum estimated local duration (ms) for a single challenge. */
  maxEstimatedLocalMs?: number;
  /** Maximum cumulative expected hashes across the whole negotiation. */
  maxCumulativeWorkPerNegotiation?: bigint;
  /** Require Minima-backed proofs (superLevel >= 0) when true. */
  requireMinimaBacked?: boolean;
}

/** Work modes. */
export type WorkMode = 'disabled' | 'admission-only' | 'minima-backed';

/**
 * Progressive counteroffer work difficulty policy.
 *
 * Bounds difficulty growth through local policy — never hard-coded exponential
 * semantics in the protocol.
 */
export interface WorkDifficultyPolicy {
  /** Base difficulty target (hex) for round 0. */
  baseTarget: string;
  /**
   * Optional per-round difficulty targets. When provided, the target for a
   * given round is looked up here (clamped to the last entry). When omitted,
   * the base target is used for every round.
   */
  roundTargets?: string[];
  /** Maximum allowed difficulty (hex) — a harder target than this is refused. */
  maxTarget: string;
}

/**
 * Per-principal anti-abuse limits.
 *
 * Keyed on the authenticated principal/root identity, never on an arbitrary
 * child agentId.
 */
export interface PrincipalLimits {
  maxConcurrentNegotiations?: number;
  cooldownMs?: number;
  maxNegotiationsPerWindow?: number;
  windowMs?: number;
}

/** Negotiation limits. */
export interface NegotiationLimits {
  maxRounds: number;
  expiresAt: number;
  /** Optional overall acquisition deadline (edge.buy). */
  acquireBy?: number;
  /** Per-principal anti-abuse limits. */
  principal?: PrincipalLimits;
}

/**
 * Applications supply bargaining intelligence. The core SDK supplies
 * protocol mechanics only — no LLM, no private reservation price.
 */
export interface NegotiationStrategy {
  evaluate(context: {
    negotiationId: string;
    proposal: TradeProposal;
    history: TradeProposal[];
    /** Canonical terms hashes of all prior proposals (for cycle detection). */
    termsHashes: string[];
  }): Promise<
    | { action: 'accept' }
    | { action: 'reject'; reason?: string }
    | { action: 'counter'; terms: TradeTerms }
  >;
}

/**
 * Resource adapter boundary — purchasing core must not know how every
 * resource executes.
 */
export interface ResourceAdapter {
  supports(resource: string, manifest: SignedManifest): boolean;
  start(agreement: TradeAgreement, context: Record<string, unknown>): Promise<ResourceHandle>;
  /**
   * Recover a resource that may have been started before a crash.
   *
   * `reference` is the stable external identity persisted in the purchase
   * record (e.g. compute job ID, container ID, storage lease ID, robot task
   * ID). The adapter must NOT start another identical resource — it reconnects
   * to the existing one.
   *
   * Returns:
   *   ACTIVE    — the resource is running; a usable handle is returned.
   *   COMPLETED — the resource already finished; no handle needed.
   *   MISSING   — the resource no longer exists; safe to treat as not started.
   *   UNKNOWN   — cannot determine state; block automatic duplicate execution.
   */
  recover?(
    reference: PersistedResourceReference,
    agreement: TradeAgreement,
    context: Record<string, unknown>,
  ): Promise<
    | { state: 'ACTIVE'; handle: ResourceHandle }
    | { state: 'COMPLETED'; result?: unknown }
    | { state: 'MISSING' }
    | { state: 'UNKNOWN' }
  >;
  meter?(handle: ResourceHandle): AsyncIterable<UsageEvent>;
  close?(handle: ResourceHandle): Promise<void>;
}

/**
 * A stable external resource identity that survives restart. Never persist
 * opaque process-local JavaScript handles as crash recovery state.
 */
export interface PersistedResourceReference {
  /** The stable external identifier (job ID, lease ID, task ID, etc.). */
  id: string;
  /** The resource type (e.g. 'compute', 'storage'). */
  resource: string;
  /** Optional adapter-specific recovery metadata. */
  metadata?: Record<string, unknown>;
}

export interface ResourceHandle {
  id: string;
  agreementId: string;
  resource: string;
}

export interface UsageEvent {
  at: number;
  amount: string;
  unit: string;
}

/**
 * A long-running resource exchange session.
 */
export interface PurchaseSession {
  id: string;
  agreement: TradeAgreement;
  status: 'authorized' | 'active' | 'settling' | 'completed' | 'failed' | 'cancelled';
  usage(): Promise<UsageEvent[]>;
  spent(): Promise<{ amount: string; tokenId?: string }>;
  close(): Promise<import('../types.js').EdgeReceipt>;
}

/** Result of a purchase. */
export interface PurchaseResult {
  agreement: TradeAgreement;
  session?: PurchaseSession;
  receipt?: import('../types.js').EdgeReceipt;
  /** True when the purchase went through the negotiated path. */
  negotiated: boolean;
}

/** Result of a negotiation. */
export interface NegotiationResult {
  agreement: TradeAgreement;
  /** Full proposal history (for observability). */
  history: TradeProposal[];
}

/** Events emitted by the purchasing engine. */
export type PurchaseEvent =
  | { type: 'runtime.persistence_ephemeral' }
  | { type: 'purchase.requested'; intent: PurchaseIntent }
  | { type: 'purchase.discovered'; manifestId: string }
  | { type: 'negotiation.opened'; negotiationId: string }
  | { type: 'negotiation.work_required'; negotiationId: string; round: number }
  | { type: 'negotiation.proposed'; negotiationId: string; round: number }
  | { type: 'negotiation.countered'; negotiationId: string; round: number }
  | { type: 'negotiation.accepted'; negotiationId: string; proposalId: string }
  | { type: 'negotiation.rejected'; negotiationId: string; proposalId: string }
  | { type: 'negotiation.exhausted'; negotiationId: string }
  | { type: 'negotiation.expired'; negotiationId: string }
  | { type: 'work.block_found'; superLevel: number }
  | { type: 'purchase.authorized'; agreementId: string }
  | { type: 'purchase.started'; sessionId: string }
  | { type: 'purchase.usage'; sessionId: string; amount: string; unit: string }
  | { type: 'purchase.settling'; sessionId: string }
  | { type: 'purchase.completed'; sessionId: string }
  | { type: 'purchase.failed'; sessionId: string; reason: string };

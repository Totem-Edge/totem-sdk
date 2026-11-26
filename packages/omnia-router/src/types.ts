/**
 * @totemsdk/omnia-router — public types
 *
 * All monetary values are scaled bigints (SCALE = 10^8).
 * The router uses local mirrors of OmniaChannel/HTLCRecord so the package
 * has no hard runtime dependency on @totemsdk/omnia — callers pass the
 * real objects (structural typing ensures compatibility).
 */

// ─── Internal channel mirrors (structural superset of OmniaChannel fields used) ──

export interface ChannelParty {
  partyId: string;
  publicKeyDigest: string;
  addressIndex: number;
}

export type HTLCStatus = 'pending' | 'fulfilled' | 'timed_out';

export interface ChannelHTLC {
  htlcId: string;
  amount: bigint;
  hashlock: string;
  timeoutBlock: bigint;
  direction: 'offered' | 'received';
  status: HTLCStatus;
  htlcAddress: string;
  senderPublicKeyDigest: string;
  recipientPublicKeyDigest: string;
}

export interface ChannelSigner {
  publicKeyDigest: string;
}

/**
 * Minimal mirror of OmniaChannel — the fields the router actually reads.
 * Structurally compatible with @totemsdk/omnia's OmniaChannel so callers
 * can pass real channel objects without an adapter.
 */
export interface RouterChannel {
  channelId: string;
  tokenId: string;
  parties: ChannelParty[];
  balances: Record<string, bigint>;
  pendingHTLCs: ChannelHTLC[];
  totalValue: bigint;
  currentSequence: number;
  status: string;
  localSigner?: ChannelSigner;
  /**
   * Eltoo contest window embedded in the funding script (OMN-081). The router
   * derives the per-hop HTLC expiry spread from this: an intermediary needs the
   * full contest period plus a recovery margin between its incoming and
   * outgoing deadlines. Defaults to 256 for channels opened by this SDK.
   */
  contestDelayBlocks?: number;
}

/**
 * Parameters for adding an HTLC — mirrors @totemsdk/omnia's AddHTLCParams.
 */
export interface HTLCParams {
  amount: bigint;
  hashlock: string;
  timeoutBlock: bigint;
  direction: 'offered' | 'received';
  counterpartPublicKeyDigest: string;
}

/**
 * Opaque lease-provider handle — the router passes it through to the
 * underlying HTLC operations but never inspects it.
 */
export type LeaseProvider = unknown;

/**
 * Dependency-injected HTLC operations.
 *
 * In production, wire in the real functions from @totemsdk/omnia:
 *   import { addHTLC, fulfillHTLC, timeoutHTLC } from '@totemsdk/omnia';
 *   const ops: ChannelOps = { addHTLC, fulfillHTLC, timeoutHTLC };
 *
 * In tests, pass mocks directly — no jest.mock() needed.
 */
export interface ChannelOps {
  addHTLC(
    channel: RouterChannel,
    params: HTLCParams,
    leaseProvider: LeaseProvider,
  ): Promise<{ channel: RouterChannel; htlcId: string; error?: string }>;

  fulfillHTLC(
    channel: RouterChannel,
    htlcId: string,
    preimage: string,
    leaseProvider: LeaseProvider,
  ): Promise<{
    channel: RouterChannel;
    error?: string;
    /**
     * OMN-083: the authenticated state pair the fulfilment produced. When an
     * implementation can supply it, the router emits an authenticated fee proof;
     * otherwise the proof is marked unauthenticated.
     */
    previousState?: RouterSignedState;
    nextState?: RouterSignedState;
  }>;

  timeoutHTLC(
    channel: RouterChannel,
    htlcId: string,
    leaseProvider: LeaseProvider,
  ): Promise<{ channel: RouterChannel; error?: string }>;
}

// ─── Graph ────────────────────────────────────────────────────────────────────

/**
 * A directed edge in the channel graph.
 * For a bidirectional channel, add two edges (one per direction).
 */
export interface ChannelGraphEdge {
  channelId: string;
  /** Sender's public key digest */
  from: string;
  /** Recipient's public key digest */
  to: string;
  tokenId: string;
  /** Sender's available balance in scaled units */
  availableBalance: bigint;
  /** Maximum additional HTLC capacity in scaled units */
  htlcCapacity: bigint;
  /** Fee per SCALE units of amount (e.g. 100_000n = 0.1%) */
  feeRate: bigint;
}

/**
 * In-memory channel graph with a swap announcement index.
 *
 * A single logical channel may have up to two directed edges (one per
 * direction of flow, e.g. Alice→Bob and Bob→Alice).  Both edges share the
 * same `channelId` and are stored together in `edgesByChannel`.
 */
export interface ChannelGraph {
  /** Directed edges keyed by sender pubkey */
  nodeEdges: Map<string, ChannelGraphEdge[]>;
  /**
   * All directed edges for a channel, keyed by channelId.
   * Value is an array because a bidirectional channel has two directed edges.
   */
  edgesByChannel: Map<string, ChannelGraphEdge[]>;
  /** Swap announcements keyed by `${tokenIn}:${tokenOut}` */
  swapIndex: Map<string, SwapAnnouncement[]>;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export interface RoutingHop {
  channelId: string;
  from: string;
  to: string;
  amount: bigint;
  tokenId: string;
  /**
   * Absolute timeout (block) for an outgoing HTLC on this hop (RFC-035). Each
   * hop must be strictly earlier than its incoming HTLC so a failed route can
   * unwind in order; the routing envelope carries it to the forwarder.
   */
  timeoutBlock?: bigint;
  /** Edge fee rate (per SCALE); populated by the routing engine. */
  feeRate?: bigint;
  /** Populated during payment execution */
  htlcId?: string;
}

export interface SwapHop extends RoutingHop {
  isSwap: true;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  /** "amountOut per amountIn" expressed as decimal string, e.g. "0.95" */
  rate: string;
  inboundChannelId: string;
  outboundChannelId: string;
}

export interface Route {
  hops: (RoutingHop | SwapHop)[];
  totalFees: bigint;
  tokenIn: string;
  tokenOut: string;
  estimatedBlocks: number;
}

export interface CrossTokenRoute extends Route {
  swapHops: SwapHop[];
}

// ─── Swap announcements ───────────────────────────────────────────────────────

export interface SwapAnnouncement {
  intermediaryPubKey: string;
  tokenIn: string;
  tokenOut: string;
  /** How many tokenOut scaled units per tokenIn scaled unit */
  rate: string;
  inboundChannelId: string;
  outboundChannelId: string;
  maxAmountIn: bigint;
}

// ─── Payment requests ─────────────────────────────────────────────────────────

export interface PaymentRequest {
  /** SHA3-256 hex of preimage */
  hashlock: string;
  /**
   * Known to the payer (returned by buildPaymentRequest).
   * Strip this before sharing the request with intermediaries.
   */
  preimage?: string;
  amount: bigint;
  tokenId: string;
  expiryBlock: bigint;
  description?: string;
}

// ─── Payment results ──────────────────────────────────────────────────────────

/**
 * A verifiable fee-provenance record for a settled hop (#29): the artifact a
 * pool's `recordPoolFee` earn-proof consumes. Binds channel + HTLC + recipient
 * + amount so a fee record traces to a real fulfilled payment.
 */
/**
 * A channel state the router can reason about without depending on `omnia`
 * (OMN-083). Only the fields the fee proof binds are modelled.
 */
export interface RouterSignedState {
  sequence: number;
  balances: Record<string, bigint>;
  pendingHTLCs?: Array<{
    htlcId: string;
    amount: bigint;
    recipientPublicKeyDigest?: string;
    status?: string;
  }>;
  stateVariables?: Array<{ port: number; value: unknown }>;
  signatures?: Record<string, unknown>;
}

export interface RouterStateTransition {
  previous: RouterSignedState;
  next: RouterSignedState;
}

export interface RouterFeeProof {
  channelId: string;
  htlcId: string;
  recipientPublicKeyDigest: string;
  amount: bigint;
  tokenId: string;
  settledAt: number;
  /**
   * OMN-083: true only when the proof was derived from an authenticated
   * predecessor→successor transition. A hash over descriptive fields is not
   * settlement evidence, so `false` proofs must not be treated as income.
   */
  authenticated: boolean;
  /** Fee the intermediary retained on this hop, when both legs are known. */
  feeAmount?: bigint;
  previousSequence?: number;
  sequence?: number;
  previousStateCommitmentV2?: string;
  stateCommitmentV2?: string;
  balanceDelta?: bigint;
  proofHash: string;
}

/** An HTLC that failed to release during rollback and is still locked. */
export interface PendingRefund {
  channelId: string;
  htlcId: string;
  /** Why it could not be released (usually: timeout block not reached). */
  reason: string;
  /** Block at which the HTLC becomes releasable, when known. */
  timeoutBlock?: string;
}

export interface PaymentResult {
  success: boolean;
  /**
   * Explicit lifecycle state. `success` is only true for the terminal
   * `recipient-settled` state; intermediate states are reported separately.
   */
  state?:
    | 'initiated'
    | 'first-hop-accepted'
    | 'forwarded'
    | 'recipient-settled'
    | 'reconciled'
    | 'failed'
    | 'recovering'
    | 'cancelled';
  /** True only when the payment is in a terminal state. */
  terminal?: boolean;
  /** Hex preimage revealed during settlement (present on success) */
  preimage?: string;
  error?: string;
  /** Machine-readable failure code (e.g. ROUTE_REVALIDATION_FAILED). */
  errorCode?: string;
  /** htlcIds that were successfully settled */
  settledHops: string[];
  /** Verifiable fee proofs for each settled hop — feeds recordPoolFee earn-proofs. */
  feeProofs?: RouterFeeProof[];
  /**
   * HTLCs that rollback could not release (CAN-015). Present on failure when
   * liquidity is still locked; `success: false` alone does not mean released.
   */
  pendingRefunds?: PendingRefund[];
}

// ─── Pathfinding options ──────────────────────────────────────────────────────

export interface RouteOptions {
  /**
   * Maximum number of hops for the whole route (default: 8). For cross-token
   * routes this is a global end-to-end budget.
   */
  maxHops?: number;
}

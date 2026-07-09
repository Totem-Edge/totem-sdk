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
  ): Promise<{ channel: RouterChannel; error?: string }>;

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

export interface PaymentResult {
  success: boolean;
  /** Hex preimage revealed during settlement (present on success) */
  preimage?: string;
  error?: string;
  /** htlcIds that were successfully settled */
  settledHops: string[];
}

// ─── Pathfinding options ──────────────────────────────────────────────────────

export interface RouteOptions {
  /** Maximum number of hops (default: 8) */
  maxHops?: number;
}

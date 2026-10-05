/**
 * @totemsdk/lookup-protocol — Message type definitions
 *
 * Every message exchanged between a Totem lookup node and its clients
 * is one of these discriminated-union variants.
 */

import type { WotsIndices } from '@totemsdk/core';

/**
 * RFC-032: lookup-protocol v2 is post-quantum. Authentication uses WOTS
 * (hash-based, quantum-resistant) instead of Ed25519. There is no separate
 * AUTH_CHALLENGE/AUTH_RESPONSE handshake; each authenticated message carries a
 * self-contained `auth` envelope (identity + nonce + expiry + WOTS signature).
 * This is a hard switch — v1 and v2 peers do not interoperate.
 */
export const PROTOCOL_VERSION = 2;

export type MessageType =
  | 'HELLO'
  | 'SESSION_OPEN'
  | 'SESSION_TICKET'
  | 'SESSION_CLOSE'
  | 'WATCH_REGISTER'
  | 'WATCH_REMOVE'
  | 'GET_COINS'
  | 'GET_COIN'
  | 'GET_PROOF'
  | 'GET_TIP'
  | 'GET_TOKEN'
  | 'BROADCAST_TXPOW'
  | 'COIN_UPDATE'
  | 'PROOF_RESPONSE'
  | 'COINS_RESPONSE'
  | 'COIN_RESPONSE'
  | 'TIP_RESPONSE'
  | 'TOKEN_RESPONSE'
  | 'BROADCAST_RESPONSE'
  | 'LEASE_RESERVE'
  | 'LEASE_COMMIT'
  | 'LEASE_BURN'
  | 'LEASE_WATERMARK'
  | 'LEASE_RESPONSE'
  | 'APP_ANNOUNCE'
  | 'APP_QUERY'
  | 'APP_RESULT'
  | 'AGENT_ANNOUNCE'
  | 'AGENT_QUERY'
  | 'AGENT_RESULT'
  | 'TRUST_RECORD'
  | 'TRUST_QUERY'
  | 'TRUST_RESPONSE'
  | 'POLICY_ANNOUNCE'
  | 'POLICY_QUERY'
  | 'POLICY_RESULT'
  | 'POLICY_WATCH'
  | 'POLICY_UPDATE'
  | 'POLICY_SIGN_REQUEST'
  | 'POLICY_SIGN_RESPONSE'
  | 'POLICY_SIGN_CANCEL'
  | 'VERSION_MISMATCH'
  | 'ERROR'
  | 'PING'
  | 'PONG';

/**
 * RFC-032: post-quantum authentication envelope.
 *
 * Flat WOTS/TreeKey signature over `sha3_256(canonicalJson({type,id?,payload} ‖ nonce ‖ expiresAt))`.
 * - `rootPublicKey`: hex of the signer's 32-byte WOTS PKdigest (what `wotsVerifyDigest` needs).
 * - `signature`: hex WOTS signature.
 * - `nonce`: monotonic per-identity anti-replay value.
 * - `expiresAt`: absolute expiry (epoch ms); the node rejects stale messages.
 * - `rootIdentityProof` (optional): opaque proof binding the signer to a root
 *   identity, verified by a registered `proofVerifiers['root-identity']`.
 * - `address` (optional): Minima address; only trusted when the proof verifies.
 */
export interface WotsAuthEnvelope {
  rootPublicKey: string;
  signature: string;
  nonce: number;
  expiresAt: number;
  rootIdentityProof?: string;
  address?: string;
}

/**
 * RFC-032 Amendment A: reference to a node-issued session ticket, used to
 * amortise one-time WOTS use. `seq` is a client-monotonic counter that provides
 * anti-replay for ticket-authenticated messages.
 */
export interface SessionTicketRef {
  ticketId: string;
  seq: number;
}

interface BaseMessage {
  type: MessageType;
  version: number;
  id?: string;
  /** RFC-032 post-quantum authentication (present on authenticated messages). */
  auth?: WotsAuthEnvelope;
  /**
   * RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
   * Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.
   */
  ticket?: SessionTicketRef;
}

export interface HelloMessage extends BaseMessage {
  type: 'HELLO';
  payload: {
    clientVersion: number;
    nodeId?: string;
  };
}

/**
 * RFC-032-A: establish a session, consuming exactly one WOTS use. Carries the
 * RFC-032 `auth` envelope; the node verifies it and mints a session ticket.
 */
export interface SessionOpenMessage extends BaseMessage {
  type: 'SESSION_OPEN';
  payload: {
    /** Requested ticket lifetime in ms (node clamps to its max). */
    ttlMs?: number;
  };
}

/** RFC-032-A: node → client ticket grant after a verified SESSION_OPEN. */
export interface SessionTicketMessage extends BaseMessage {
  type: 'SESSION_TICKET';
  payload: SessionTicket;
}

/** RFC-032-A: client → node best-effort session teardown. */
export interface SessionCloseMessage extends BaseMessage {
  type: 'SESSION_CLOSE';
  payload: { ticketId: string };
}

/** RFC-032-A: a node-signed session ticket. */
export interface SessionTicket {
  ticketId: string;
  /** Root public key (hex) the ticket is bound to. */
  subject: string;
  nodeId: string;
  issuedAt: number;
  expiresAt: number;
  maxRequests: number;
  /** Node WOTS signature (hex) over {@link sessionTicketDigest}. */
  signature: string;
}

export interface WatchRegisterMessage extends BaseMessage {
  type: 'WATCH_REGISTER';
  payload: {
    addresses: string[];
    tokenIds?: string[];
  };
}

export interface WatchRemoveMessage extends BaseMessage {
  type: 'WATCH_REMOVE';
  payload: {
    addresses: string[];
  };
}

export interface GetCoinsMessage extends BaseMessage {
  type: 'GET_COINS';
  payload: {
    address?: string;
    tokenId?: string;
    sendable?: boolean;
    relevant?: boolean;
  };
}

export interface GetCoinMessage extends BaseMessage {
  type: 'GET_COIN';
  payload: {
    coinId: string;
  };
}

export interface GetProofMessage extends BaseMessage {
  type: 'GET_PROOF';
  payload: {
    coinId: string;
  };
}

export interface GetTipMessage extends BaseMessage {
  type: 'GET_TIP';
  payload: Record<string, never>;
}

export interface GetTokenMessage extends BaseMessage {
  type: 'GET_TOKEN';
  payload: {
    tokenId: string;
  };
}

export interface BroadcastTxPoWMessage extends BaseMessage {
  type: 'BROADCAST_TXPOW';
  payload: {
    txpowHex: string;
  };
}

export interface CoinUpdateMessage extends BaseMessage {
  type: 'COIN_UPDATE';
  payload: {
    eventType: 'new' | 'spent' | 'confirmed';
    coin: unknown;
    block: number;
  };
}

export interface ProofResponseMessage extends BaseMessage {
  type: 'PROOF_RESPONSE';
  payload: {
    coinId: string;
    proof: unknown;
  };
}

export interface LeaseReserveMessage extends BaseMessage {
  type: 'LEASE_RESERVE';
  payload: {
    treeId: string;
    branchId?: string;
    deviceId?: string;
    ttlMs?: number;
    payloadHash?: string;
    purpose?: string;
    /** Optional — when present, the node must reserve these exact indices
     *  (quorum attestation) instead of allocating the next free slot. */
    indices?: WotsIndices;
  };
}

export interface LeaseCommitMessage extends BaseMessage {
  type: 'LEASE_COMMIT';
  payload: {
    reservationId: string;
    txId: string;
    indices: WotsIndices;
  };
}

export interface LeaseBurnMessage extends BaseMessage {
  type: 'LEASE_BURN';
  payload: {
    reservationId: string;
    reason: string;
    indices: WotsIndices;
  };
}

export interface LeaseWatermarkMessage extends BaseMessage {
  type: 'LEASE_WATERMARK';
  payload: {
    treeId: string;
    addressCursor: number;
    l1Cursor: number;
    l2Cursor: number;
    unavailableCount: number;
    lastSyncTimestamp: number;
  };
}

export interface AppAnnounceMessage extends BaseMessage {
  type: 'APP_ANNOUNCE';
  payload: {
    manifest: Uint8Array;
    appId: string;
    expiresAt: number;
    /**
     * RFC-032: the manifest is a WOTS-signed `SignedManifest` (see @totemsdk/manifest),
     * which already carries its own WOTS signature + signerPublicKey. The message-level
     * `auth` envelope (BaseMessage) additionally binds the announcing identity.
     * The former Ed25519 `publicKey`/`signature` fields are removed.
     */
    /**
     * Minima address of the app author — stored as a filterable column for APP_QUERY.
     * Authoritative source is inside the manifest; this top-level field enables
     * discovery before a full AppManifest parser is available.
     */
    authorAddress?: string;
    /** If true the app charges no fees — used for freeOnly filter in APP_QUERY. */
    isFree?: boolean;
  };
}

export interface AppQueryMessage extends BaseMessage {
  type: 'APP_QUERY';
  payload: {
    category?: string[];
    authorAddress?: string;
    minVersion?: number;
    freeOnly?: boolean;
    limit?: number;
  };
}

export interface AppResultMessage extends BaseMessage {
  type: 'APP_RESULT';
  payload: {
    apps: Array<{
      appId: string;
      manifest: Uint8Array;
      nodeId: string;
    }>;
  };
}

export interface AgentAnnounceMessage extends BaseMessage {
  type: 'AGENT_ANNOUNCE';
  payload: {
    manifest: Uint8Array;
    capabilityId: string;
    expiresAt: number;
    /**
     * RFC-032: the manifest is a WOTS-signed `SignedManifest`; the message-level
     * `auth` envelope binds the announcing identity. Ed25519 fields removed.
     */
    /** Capability tags for filtering (e.g. ['translation', 'gpt-4']) */
    tags?: string[];
    /** Price per RPC call in smallest unit (for maxPricePerCall filter) */
    pricePerCall?: number;
    /** Expected latency in milliseconds (for maxLatencyMs filter) */
    latencyMs?: number;
  };
}

export interface AgentQueryMessage extends BaseMessage {
  type: 'AGENT_QUERY';
  payload: {
    capabilityName?: string;
    tags?: string[];
    maxPricePerCall?: number;
    maxLatencyMs?: number;
    limit?: number;
  };
}

export interface AgentResultMessage extends BaseMessage {
  type: 'AGENT_RESULT';
  payload: {
    agents: Array<{
      capabilityId: string;
      manifest: Uint8Array;
      nodeId: string;
    }>;
  };
}

export interface TrustRecordMessage extends BaseMessage {
  type: 'TRUST_RECORD';
  payload: {
    subjectId: string;
    rating: number;
    comment?: string;
    reviewerAddress: string;
    /** Hex WOTS signature over the canonical review payload (RFC-032). */
    signature: string;
    /** Hex WOTS PKdigest of the reviewer, when supplied (else derived via session). */
    reviewerPublicKey?: string;
  };
}

export interface TrustQueryMessage extends BaseMessage {
  type: 'TRUST_QUERY';
  payload: {
    subjectId: string;
    subjectType: 'app' | 'agent' | 'node';
  };
}

export interface VersionMismatchMessage extends BaseMessage {
  type: 'VERSION_MISMATCH';
  payload: {
    serverVersion: number;
    clientVersion: number;
    message: string;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: 'ERROR';
  payload: {
    code: string;
    message: string;
    requestId?: string;
  };
}

// ---------------------------------------------------------------------------
// Response message types (server → client)
// ---------------------------------------------------------------------------

export interface CoinsResponseMessage extends BaseMessage {
  type: 'COINS_RESPONSE';
  payload: { coins: unknown[] };
}

export interface CoinResponseMessage extends BaseMessage {
  type: 'COIN_RESPONSE';
  payload: { coin: unknown };
}

export interface TipResponseMessage extends BaseMessage {
  type: 'TIP_RESPONSE';
  payload: { block: number; hash: string; time: string };
}

export interface TokenResponseMessage extends BaseMessage {
  type: 'TOKEN_RESPONSE';
  payload: { token: unknown };
}

export interface BroadcastResponseMessage extends BaseMessage {
  type: 'BROADCAST_RESPONSE';
  payload: { success: boolean; message?: string; txpowid?: string };
}

export interface LeaseResponseMessage extends BaseMessage {
  type: 'LEASE_RESPONSE';
  payload: {
    action: 'reserved' | 'committed' | 'burned';
    reservation?: unknown;
    certificate?: unknown;
  };
}

export interface TrustResponseMessage extends BaseMessage {
  type: 'TRUST_RESPONSE';
  payload: {
    subjectId: string;
    subjectType: 'app' | 'agent' | 'node';
    avgRating: number;
    count: number;
    reviews: unknown[];
  };
}

export interface PingMessage extends BaseMessage {
  type: 'PING';
  payload: { ts: number };
}

export interface PongMessage extends BaseMessage {
  type: 'PONG';
  payload: { ts: number; echo: number };
}

// ─── Policy discovery ──────────────────────────────────────────────────────

export interface PolicyAnnounceMessage extends BaseMessage {
  type: 'POLICY_ANNOUNCE';
  payload: {
    policyId: string;
    subjectId: string;
    policyRoot: string;
    policyVersion: number;
    policyEpoch: number;
    authorityIdentityId: string;
    capabilities: string[];
    manifest: Uint8Array;
    expiresAt: number;
    retrievalEndpoints?: Array<{
      type: 'hyperswarm' | 'https' | 'mqtt' | 'websocket' | 'custom';
      uri: string;
    }>;
  };
}

export interface PolicyQueryMessage extends BaseMessage {
  type: 'POLICY_QUERY';
  payload: {
    policyId?: string;
    subjectId?: string;
    policyRoot?: string;
    authorityIdentityId?: string;
    capability?: string;
    minVersion?: number;
    minEpoch?: number;
    activeOnly?: boolean;
    limit?: number;
  };
}

export interface PolicyResultMessage extends BaseMessage {
  type: 'POLICY_RESULT';
  payload: {
    results: Array<{
      policyId: string;
      policyRoot: string;
      policyVersion: number;
      policyEpoch: number;
      manifest: Uint8Array;
      nodeId: string;
      expiresAt: number;
    }>;
  };
}

export interface PolicyWatchMessage extends BaseMessage {
  type: 'POLICY_WATCH';
  payload: {
    policyId: string;
    afterEpoch?: number;
  };
}

export interface PolicyUpdateMessage extends BaseMessage {
  type: 'POLICY_UPDATE';
  payload: {
    policyId: string;
    previousRoot?: string;
    currentRoot: string;
    policyVersion: number;
    policyEpoch: number;
    manifest: Uint8Array;
  };
}

// ─── Policy signing coordination ───────────────────────────────────────────

export interface PolicySignRequestMessage extends BaseMessage {
  type: 'POLICY_SIGN_REQUEST';
  payload: {
    request: Uint8Array;
  };
}

export interface PolicySignResponseMessage extends BaseMessage {
  type: 'POLICY_SIGN_RESPONSE';
  payload: {
    response: Uint8Array;
  };
}

export interface PolicySignCancelMessage extends BaseMessage {
  type: 'POLICY_SIGN_CANCEL';
  payload: {
    requestId: string;
    policyId: string;
    reason?: string;
  };
}

export type LookupMessage =
  | HelloMessage
  | SessionOpenMessage
  | SessionTicketMessage
  | SessionCloseMessage
  | WatchRegisterMessage
  | WatchRemoveMessage
  | GetCoinsMessage
  | GetCoinMessage
  | GetProofMessage
  | GetTipMessage
  | GetTokenMessage
  | BroadcastTxPoWMessage
  | CoinUpdateMessage
  | ProofResponseMessage
  | CoinsResponseMessage
  | CoinResponseMessage
  | TipResponseMessage
  | TokenResponseMessage
  | BroadcastResponseMessage
  | LeaseReserveMessage
  | LeaseCommitMessage
  | LeaseBurnMessage
  | LeaseWatermarkMessage
  | LeaseResponseMessage
  | AppAnnounceMessage
  | AppQueryMessage
  | AppResultMessage
  | AgentAnnounceMessage
  | AgentQueryMessage
  | AgentResultMessage
  | TrustRecordMessage
  | TrustQueryMessage
  | TrustResponseMessage
  | PolicyAnnounceMessage
  | PolicyQueryMessage
  | PolicyResultMessage
  | PolicyWatchMessage
  | PolicyUpdateMessage
  | PolicySignRequestMessage
  | PolicySignResponseMessage
  | PolicySignCancelMessage
  | VersionMismatchMessage
  | ErrorMessage
  | PingMessage
  | PongMessage;

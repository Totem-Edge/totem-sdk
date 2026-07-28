/**
 * @totemsdk/lookup-protocol — Message type definitions
 *
 * Every message exchanged between a Totem lookup node and its clients
 * is one of these discriminated-union variants.
 */

import type { WotsIndices } from '@totemsdk/core';

export const PROTOCOL_VERSION = 1;

export type MessageType =
  | 'HELLO'
  | 'AUTH_CHALLENGE'
  | 'AUTH_RESPONSE'
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

interface BaseMessage {
  type: MessageType;
  version: number;
  id?: string;
  sig?: string;
}

export interface HelloMessage extends BaseMessage {
  type: 'HELLO';
  payload: {
    clientVersion: number;
    nodeId?: string;
  };
}

export interface AuthChallengeMessage extends BaseMessage {
  type: 'AUTH_CHALLENGE';
  payload: {
    challenge: string;
    expiresAt: number;
  };
}

export interface AuthResponseMessage extends BaseMessage {
  type: 'AUTH_RESPONSE';
  payload: {
    challenge: string;
    publicKey: string;
    signature: string;
  };
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
    /** Hex-encoded Ed25519 public key of the signer (required for signature verification) */
    publicKey?: string;
    /** Hex-encoded Ed25519 signature over manifest bytes */
    signature?: string;
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
    /** Hex-encoded Ed25519 public key of the signer */
    publicKey?: string;
    /** Hex-encoded Ed25519 signature over manifest bytes */
    signature?: string;
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
    signature: string;
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
  | AuthChallengeMessage
  | AuthResponseMessage
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

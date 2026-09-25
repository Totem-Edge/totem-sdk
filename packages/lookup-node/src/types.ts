/**
 * @totemsdk/lookup-node — shared types
 */

import type { ChainStateProvider } from '@totemsdk/chain-provider';
import type { StorageAdapter } from '@totemsdk/core';
import type { TrustRecordMessage } from '@totemsdk/lookup-protocol';

export type { ChainStateProvider };

// ---------------------------------------------------------------------------
// Transport interface (compatible with lookup-client's ITransport)
// ---------------------------------------------------------------------------

export interface ITransport {
  on(event: 'data', handler: (chunk: Uint8Array) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  send(data: Uint8Array): void;
  close(): void;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface RelayConfig {
  enabled: true;
  /**
   * Optional work verifier override.
   * When omitted, `verifyTxPoWWork` from `@totemsdk/txpow` is used.
   */
  verifyWorkFn?: (txpowHex: string) => boolean | Promise<boolean>;
  /** Max entries in the relay dedup table before oldest are evicted. Default: 10_000 */
  maxDedupSize?: number;
  /** Minimum byte length to accept (spam filter). Default: 100 bytes */
  spamMinBytes?: number;
}

export interface LeaseConfig {
  enabled: true;
  storage?: StorageAdapter;
}

export interface AppRegistryConfig {
  enabled: true;
  /**
   * Require a valid Ed25519 signature on every APP_ANNOUNCE.
   * Default: true (secure by default — rejects unsigned or invalidly-signed announcements).
   * Set to false only on private/trusted networks.
   */
  requireSignature?: boolean;
}

export interface AgentRegistryConfig {
  enabled: true;
  expiryCheckIntervalMs?: number;
  /**
   * Require a valid Ed25519 signature on every AGENT_ANNOUNCE.
   * Default: true (secure by default — rejects unsigned or invalidly-signed announcements).
   * Set to false only on private/trusted networks.
   */
  requireSignature?: boolean;
}

export interface TrustIndexConfig {
  enabled: true;
  /**
   * Require reviewer signatures to be cryptographically verified before a
   * TRUST_RECORD is persisted. Default: true (fail closed). When true, a record
   * is only accepted if `verifyReviewerSignature` is configured AND returns
   * true. Set to false only for development/testing.
   */
  requireVerifiedSignature?: boolean;
  /**
   * Cryptographic verifier for a TRUST_RECORD payload. Required when
   * `requireVerifiedSignature` is true; when omitted, every TRUST_RECORD is
   * rejected (fail closed). The `record` argument is the signed review payload
   * and `authenticatedPublicKey` is the public key bound to the authenticated
   * session (when available), so the verifier can check the reviewer's WOTS
   * signature against the key recovered from the chain.
   */
  verifyReviewerSignature?: (
    record: TrustRecordMessage['payload'],
    authenticatedPublicKey?: string,
  ) => boolean | Promise<boolean>;
}

/** SQLite storage configuration. Defaults to ':memory:' if omitted. */
export interface SqliteConfig {
  /** Path to the SQLite database file. Use ':memory:' for ephemeral storage. */
  dbPath: string;
  /** TTL for result cache entries in ms. Default: 30_000 */
  cacheTtlMs?: number;
}

/**
 * MegaMMR / indexer mode configuration.
 *
 * When enabled:
 *   - GET_COINS requests without an `address` filter are accepted (chain-wide indexer).
 *   - The provider is expected to implement full UTXO index queries
 *     (e.g. MinimaRpcProvider connected to a MegaMMR-enabled node).
 *   - Standard nodes reject unfiltered GET_COINS requests to prevent unbounded scans.
 */
export interface MegaMMRConfig {
  enabled: true;
}

export interface LookupNodeConfig {
  /** Chain state source — MinimaRpcProvider or any ChainStateProvider */
  provider: ChainStateProvider;
  /** Block polling interval in ms. Default: 5_000 */
  pollIntervalMs?: number;
  /** Auth challenge TTL in ms. Default: 30_000 */
  challengeTtlMs?: number;
  /** Max authenticated requests per minute per client. Default: 120 */
  rateLimitRpm?: number;
  /** Unique node identifier (hex string). Generated randomly if omitted. */
  nodeId?: string;
  /** SQLite persistence. Defaults to ':memory:' (always SQLite, never plain Maps). */
  sqlite?: SqliteConfig;
  relay?: RelayConfig;
  lease?: LeaseConfig;
  appRegistry?: AppRegistryConfig;
  agentRegistry?: AgentRegistryConfig;
  trustIndex?: TrustIndexConfig;
  /** MegaMMR / indexer mode — enables chain-wide GET_COINS without address filter. */
  megammr?: MegaMMRConfig;
  /** @internal — skip auth signature verification (testing only) */
  _skipAuth?: boolean;
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface SessionState {
  readonly sessionId: string;
  authenticated: boolean;
  publicKeyHex?: string;
  readonly connectedAt: number;
  rpmCount: number;
  rpmWindowStart: number;
}

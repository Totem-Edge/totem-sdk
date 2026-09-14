/**
 * @module @totemsdk/intelligence/types
 *
 * Provider-neutral intelligence contracts.
 *
 * These types describe what a local or remote inference provider can do,
 * without naming any concrete provider (QVAC, OpenAI, Ollama, …). Consumers
 * depend on these types; providers implement them.
 *
 * Design principle: the AI proposes, Totem authorizes. An IntelligenceProvider
 * is a compute surface, never a signing surface. All authorization happens in
 * policy layers upstream (agent-policy, authority) keyed by proposalId/runId.
 */

import type { IntelligenceCapability, IntelligenceDomain } from './constants.js';
import type { IntelligenceErrorCode } from './errors.js';

/**
 * Domain discriminator for operations and usages.
 *
 * `IntelligenceDomain` is the canonical closed set; `(string & {})` lets
 * providers advertise extension domains while IDE autocomplete still surfaces
 * the canonical literals first.
 */
export type IntelligenceDomainOrString = IntelligenceDomain | (string & {});

/**
 * Usage metering for a single inference operation.
 *
 * The unit of consumption is provider-specific. `@totemsdk/qvac` reports
 * tokens and milliseconds; other providers may report their own units.
 * Policy layers convert this into budget spend.
 */
export interface IntelligenceUsage {
  readonly domain: IntelligenceDomainOrString;
  readonly op: string;
  readonly model?: string;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly durationMs?: number;
  readonly metadata?: Record<string, number | string>;
}

/**
 * Operation context — ties an inference call back to the governance layer.
 */
export interface IntelligenceContext {
  readonly agentId?: string;
  readonly proposalId?: string;
  readonly runId?: string;
  readonly principal?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * A single provider-neutral inference operation.
 *
 * `params` is intentionally `Record<string, unknown>` at the contract level;
 * each provider adapter narrows it to its domain's typed parameter set.
 */
export interface IntelligenceOperation<T = unknown> {
  readonly requestId?: string;
  readonly domain: IntelligenceDomainOrString;
  readonly op: string;
  readonly params: Record<string, unknown>;
  readonly context?: IntelligenceContext;
  readonly signal?: AbortSignal;
}

/**
 * Streaming operation shape — the provider decides the chunk vocabulary.
 */
export interface IntelligenceStreamOperation {
  readonly requestId?: string;
  readonly domain: IntelligenceDomainOrString;
  readonly op: string;
  readonly params: Record<string, unknown>;
  readonly context?: IntelligenceContext;
  readonly signal?: AbortSignal;
  readonly onChunk?:
    | ((chunk: IntelligenceStreamChunk) => void)
    | ((partial: unknown, kind?: string) => void);
}

/**
 * Successful result of an intelligence operation.
 */
export interface IntelligenceResult<T = unknown> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: T;
  readonly usage?: IntelligenceUsage;
  readonly receipt?: unknown;
}

/**
 * Failed result of an intelligence operation (soft-fail path — no throw).
 */
export interface IntelligenceErrorResult {
  readonly ok: false;
  readonly requestId: string;
  readonly code: IntelligenceErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export type IntelligenceOutcome<T = unknown> =
  | IntelligenceResult<T>
  | IntelligenceErrorResult;

/**
 * Port-facing result shape used by { @link EdgeIntelligencePort }.
 *
 * Mirrors @totemsdk/edge's `EdgeOperationResult` so the port stays
 * host-agnostic; created by {@link ../port.ts!createEdgeIntelligencePort}.
 */
export interface IntelligencePortResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * Edge-compatible intelligence port contract.
 *
 * Lives in @totemsdk/intelligence (not @totemsdk/edge) so that adapters like
 * `@totemsdk/qvac/edge` can implement a port for @totemsdk/edge without
 * depending on edge itself. @totemsdk/edge re-exports this type and hosts
 * implementations via `EdgeRuntimePorts.intelligence`.
 */
export interface EdgeIntelligencePort {
  /** Stable provider id (e.g. 'qvac'). */
  readonly providerId: string;
  /** Capability strings advertised (e.g. ['intelligence:llm', …]). */
  readonly capabilities: readonly string[];
  invoke(params: {
    requestId?: string;
    domain: string;
    op: string;
    params: Record<string, unknown>;
    context?: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<IntelligencePortResult<{
    data: unknown;
    usage?: Record<string, unknown>;
    receipt?: unknown;
  }>>;
  cancel?(requestId: string): Promise<IntelligencePortResult>;
  close?(): Promise<void>;
}

/**
 * Stream chunk types surfaced by intelligence providers.
 */
export type IntelligenceStreamChunk =
  | { readonly type: 'token'; readonly text: string }
  | { readonly type: 'segment'; readonly text: string; readonly index?: number }
  | { readonly type: 'audio'; readonly data: unknown; readonly mimeType?: string }
  | { readonly type: 'image'; readonly data: unknown; readonly mimeType?: string }
  | { readonly type: 'progress'; readonly percent?: number; readonly step?: string; readonly message?: string }
  | { readonly type: 'delta'; readonly data: Record<string, unknown> }
  | { readonly type: 'done'; readonly usage?: IntelligenceUsage };

/**
 * Receipt for an executed inference operation.
 *
 * v1 receipts are unsigned advisories produced by the provider adapter.
 * WOTS-signed inference receipts are a documented follow-up in the wallet/
 * authority layer (`signedBy` anticipates that attestation).
 */
export interface IntelligenceReceipt {
  readonly receiptId: string;
  readonly provider: string;
  readonly requestId: string;
  readonly proposalId?: string;
  readonly runId?: string;
  readonly domain: IntelligenceDomainOrString;
  readonly op: string;
  readonly model?: string;
  readonly usage: {
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly durationMs: number;
  };
  readonly issuedAt: number;
  readonly signedBy?: string;
}

/**
 * Provider-neutral intelligence interface.
 *
 * Implementors wrap a concrete inference runtime (QVAC, remote LLM gateway,
 * embedded model host, …). The provider is compute-only: it cannot sign,
 * cannot move value, and must never hold private keys.
 */
export interface IntelligenceProvider {
  /** Stable provider identifier, e.g. 'qvac'. */
  readonly id: string;
  /** Human-readable provider name, e.g. 'QVAC In-situ Inference'. */
  readonly displayName: string;
  /** Wrapped provider runtime version. */
  readonly version: string;
  /** Domains the provider currently supports. */
  readonly capabilities: readonly IntelligenceCapability[];
  /** True if the provider is connected / ready. */
  readonly isReady: boolean;

  /**
   * Execute a single inference operation.
   *
   * Implementations MAY throw IntelligenceError for hard failures but should
   * prefer returning IntelligenceErrorResult for operational failures so the
   * caller can inspect code/retryable without try/catch.
   */
  invoke<T = unknown>(op: IntelligenceOperation<T>): Promise<IntelligenceOutcome<T>>;

  /**
   * Execute a streaming inference operation.
   *
   * Returns an async iterable of stream chunks. If the operation is not
   * stream-capable, the implementation must throw NOT_IMPLEMENTED.
   */
  invokeStream(op: IntelligenceStreamOperation): AsyncIterable<IntelligenceStreamChunk>;

  /** Cancel an in-flight operation by request id. */
  cancel(requestId: string): Promise<IntelligenceOutcome<void>>;

  /** Release provider resources. Further invoke calls should reject. */
  close(): Promise<void>;
}

/**
 * Capability advertisement for discovery — a snapshot of a provider's
 * supported surface at a point in time.
 */
export interface IntelligenceProviderInfo {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly capabilities: readonly IntelligenceCapability[];
  readonly domains: readonly IntelligenceDomain[];
  readonly isReady: boolean;
}

/**
 * Constructor options shared by provider adapters.
 */
export interface IntelligenceProviderOptions {
  /** Auto-connect on construction. Defaults to true. */
  readonly lazyConnect?: boolean;
  /** Timeout for individual operations (ms). Default provider-specific. */
  readonly defaultTimeoutMs?: number;
  /** Logger hook receiving operational diagnostics. */
  readonly onLog?: (level: string, message: string, context?: unknown) => void;
}

export type {
  IntelligenceCapability,
  IntelligenceDomain,
} from './constants.js';
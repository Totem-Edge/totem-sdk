/**
 * @totemsdk/qvac — minimal structural surface of @qvac/sdk that this adapter
 * consumes.
 *
 * The real @qvac/sdk runtime ships heavy native/bare dependencies. To keep the
 * Totem workspace buildable and testable without it, the adapter consumes a
 * structural `QvacSdkLike` object that the consumer injects (typically the
 * `@qvac/sdk` module itself, or a mock in tests). This file describes exactly
 * the seam the adapter depends on.
 */

import type { IntelligenceUsage } from '@totemsdk/intelligence';

/**
 * Result of a single QVAC invocation, normalised by the adapter.
 */
export interface QvacCallResult {
  readonly data: unknown;
  readonly usage?: Partial<IntelligenceUsage>;
}

/**
 * A single resolvable QVAC operation.
 */
export interface QvacOpHandler {
  (
    params: Record<string, unknown>,
    opts: { signal?: AbortSignal },
  ): Promise<QvacCallResult>;
}

/**
 * Structural QVAC SDK surface.
 *
 * Consumers provide either the real `@qvac/sdk` module or a compatible mock.
 * `id`, `version`, and `plugins` are optional discovery hints; when absent the
 * provider falls back to defaults.
 */
export interface QvacSdkLike {
  readonly id?: string;
  readonly version?: string;
  /**
   * Canonical op callables, keyed by op name (e.g. `completion`, `embed`,
   * `ragSearch`). The default handler resolves `sdk[op]` when present and
   * throws NOT_IMPLEMENTED otherwise.
   */
  readonly [op: string]: unknown;
  close?(): Promise<void>;
}

/**
 * Per-domain op resolution.
 *
 * Consumers with a non-trivial mapping (e.g. plugin-loaded ops) can supply a
 * custom resolver; the default resolver reads `sdk[op]` directly.
 */
export interface QvacOpResolver {
  (domain: string, op: string): QvacOpHandler | undefined;
}

/**
 * Options for the QVAC intelligence adapter.
 */
export interface QvacProviderOptions {
  /**
   * QVAC SDK (or structural equivalent) to wrap. Optional — see `sdkLoader`.
   * Most consumers can skip this and supply `sdkLoader`, or install
   * `@qvac/sdk` and rely on the lazy default load.
   */
  readonly sdk?: QvacSdkLike;
  /**
   * Async SDK loader, used when `sdk` is not provided. The idiomatic form is
   * `() => import('@qvac/sdk')`. If neither `sdk` nor `sdkLoader` is given,
   * the provider attempts `require('@qvac/sdk')` lazily at first use and
   * returns UNAVAILABLE when the package is not installed.
   *
   * Injection via `sdk`/`sdkLoader` keeps the adapter testable and lets
   * runtimes supply a custom surface without the heavy native dependency tree.
   */
  readonly sdkLoader?: () => Promise<QvacSdkLike> | QvacSdkLike;
  /** Auto-connect semantics — defaults to true (no-op for local SDK). */
  readonly lazyConnect?: boolean;
  /** Override the default op resolver. */
  readonly resolveOp?: QvacOpResolver;
  /** Override the DSL op→usage mapping used by the provider. */
  readonly usageExtractor?: QvacUsageExtractor;
  /** Logger hook receiving operational diagnostics. */
  readonly onLog?: (level: string, message: string, context?: unknown) => void;
  /** Timeout for individual operations (ms). Default: none. */
  readonly defaultTimeoutMs?: number;
}

/**
 * Extracts usage from an op result. Best-effort: looks for `stats`,
 * `usage`, or flat token/duration fields.
 */
export type QvacUsageExtractor = (domain: string, op: string, raw: unknown) => Partial<IntelligenceUsage> | undefined;
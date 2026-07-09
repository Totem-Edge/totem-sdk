/**
 * @totemsdk/proof-integritas — Config and raw API response types.
 *
 * These types mirror the shapes returned by the Integritas v2 REST API
 * (https://integritas.minima.global/core/v2). They are raw — normalization
 * to ProofOperationResult / ProofVerifyResult is done in normalize.ts.
 */

import type { ProofProviderCapability } from '@totemsdk/proof';

/**
 * Integritas-specific capabilities beyond the base ProofProviderCapability set.
 * The full set covers Integritas v2 extended operations.
 */
export type IntegritasExtendedCapability = 'report:pdf' | 'nft:trace' | 'minima:onchain';

export type IntegritasCapability = ProofProviderCapability | IntegritasExtendedCapability;

/**
 * Configuration for the Integritas proof provider.
 */
export interface IntegritasConfig {
  baseUrl?: string;
  apiKey?: string;
  requestIdFactory?: () => string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Raw shape returned by POST /core/v2/timestamp/post
 */
export interface IntegritasStampResponse {
  status: string;
  hash?: string;
  txId?: string;
  timestamp?: number;
  message?: string;
}

/**
 * Raw shape returned by POST /core/v2/file/check
 */
export interface IntegritasCheckResponse {
  status: string;
  hash?: string;
  txId?: string;
  timestamp?: number;
  message?: string;
}

/**
 * Raw shape returned by POST /core/v2/verify/file
 */
export interface IntegritasVerifyResponse {
  status: string;
  hash?: string;
  txId?: string;
  timestamp?: number;
  message?: string;
  report?: string;
}

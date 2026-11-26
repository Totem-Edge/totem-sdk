/**
 * The claim envelope: a payload, a policy and a version.
 *
 * The envelope is intentionally payload-agnostic. What is being claimed and who
 * may claim it are independent; settlement and transport live outside it. The
 * canonical hash is what a claim link, receipt or signature commits to.
 */

import { canonicalJson, hashCanonical } from '@totemsdk/core';
import type { ClaimPolicy } from './policy.js';

export interface NativeClaimPayload {
  kind: 'native';
  amount: string;
}

export interface TokenClaimPayload {
  kind: 'token';
  tokenId: string;
  amount: string;
  decimals: number;
  symbol?: string;
}

export interface NftClaimPayload {
  kind: 'nft';
  tokenId: string;
  metadata?: Record<string, unknown>;
}

export interface BasketClaimPayload {
  kind: 'basket';
  items: ClaimPayload[];
}

export interface VtxoClaimPayload {
  kind: 'vtxo';
  poolId: string;
  vtxoId: string;
  tokenId: string;
  amount: string;
  claimPolicy?: ClaimPolicy;
}

export interface StatechainClaimPayload {
  kind: 'statechain';
  chainId: string;
  coinId: string;
  tokenId: string;
  amount: string;
}

export interface LiquidityPositionClaimPayload {
  kind: 'liquidity-position';
  positionId: string;
  receiptId: string;
}

export interface ProofClaimPayload {
  kind: 'proof';
  proof: unknown;
}

export interface ManifestClaimPayload {
  kind: 'manifest';
  manifest: unknown;
}

export interface MandateClaimPayload {
  kind: 'mandate';
  mandate: unknown;
  budget?: ClaimPayload;
}

export interface DataClaimPayload {
  kind: 'data';
  descriptor: unknown;
  ciphertextRef: string;
}

export interface CustomClaimPayload {
  kind: 'custom';
  namespace: string;
  type: string;
  value: unknown;
}

export type ClaimPayload =
  | NativeClaimPayload
  | TokenClaimPayload
  | NftClaimPayload
  | BasketClaimPayload
  | VtxoClaimPayload
  | StatechainClaimPayload
  | LiquidityPositionClaimPayload
  | ProofClaimPayload
  | ManifestClaimPayload
  | MandateClaimPayload
  | DataClaimPayload
  | CustomClaimPayload;

export interface ClaimEnvelope {
  version: 1;
  payload: ClaimPayload;
  policy: ClaimPolicy;
  /**
   * Opaque, untrusted metadata (issuer branding, campaign id, transport hints).
   * Never use it for authorization or settlement decisions.
   */
  metadata?: Record<string, unknown>;
}

/** Domain separator for the canonical envelope hash. */
export const CLAIM_ENVELOPE_DOMAIN = 'totemsdk/claim/envelope/v1';

/**
 * Normalise a value for canonical serialization.
 *
 * `canonicalJson` sorts object keys but does not handle `bigint`; policies may
 * carry bigint totals. Bigints become decimal strings, which is the same
 * representation used on the wire.
 */
export function normalizeClaimValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeClaimValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeClaimValue(entry),
      ]),
    );
  }
  return value;
}

/** Canonical JSON for transport or storage. */
export function serializeClaimEnvelope(envelope: ClaimEnvelope): string {
  return canonicalJson(normalizeClaimValue(envelope));
}

/**
 * The canonical envelope hash. This is the commitment a claim link or receipt
 * can carry; re-serialising the same envelope always produces the same digest.
 */
export function computeClaimEnvelopeHash(envelope: ClaimEnvelope): string {
  return hashCanonical(CLAIM_ENVELOPE_DOMAIN, normalizeClaimValue(envelope));
}

/**
 * Minimal structural validation. This is not a schema validator: it checks the
 * properties the policy evaluator depends on and lets the caller validate the
 * payload with the adapter that owns it.
 */
export function assertClaimEnvelope(envelope: ClaimEnvelope): void {
  if (!envelope || envelope.version !== 1) {
    throw new Error('Unsupported claim envelope version');
  }
  if (!envelope.payload || typeof envelope.payload.kind !== 'string') {
    throw new Error('Claim envelope payload is missing a kind');
  }
  if (!envelope.policy || typeof envelope.policy.type !== 'string') {
    throw new Error('Claim envelope policy is missing a type');
  }
}

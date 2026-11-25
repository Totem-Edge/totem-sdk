/**
 * Canonical open-quote terms (OMN-064 / OMN-069).
 *
 * A quote is a signed offer, so every field that has financial meaning must be
 * committed to by the signature. This module is the single definition of that
 * commitment:
 *
 *  - `openQuoteTerms()` — the terms object, built from the quote fields.
 *  - `openQuoteTermsHash()` — the domain-separated canonical hash of those
 *    terms; it is what `quote.termsHash` must equal.
 *  - `openQuoteSigningPayload()` — the exact string a signer signs and a
 *    verifier checks. It is the terms hash plus the offer identifiers that do
 *    not affect economics (quote id, expiry) so a quote cannot be replayed
 *    under a different id.
 *  - `assertOpenQuoteTerms()` — recomputes the hash from the received fields
 *    and rejects any quote whose terms were edited after signing.
 *
 * Keeping this in `omnia-lsp` matters: a consumer, a provider and an auditor all
 * need the same bytes. If each side rebuilt the hash itself, a "verified" quote
 * would only prove that the data is self-consistent.
 */

import { hashCanonical } from '@totemsdk/core';

export const OMNIA_LSP_OPEN_TERMS_VERSION = 'omnia-lsp/open-terms/v1' as const;
export const OMNIA_LSP_OPEN_QUOTE_SIGNING_DOMAIN = 'totemsdk/omnia-lsp/open-quote/v1' as const;

/** Fields that a quote must expose for its terms to be recomputed. */
export interface OpenQuoteTermsSource {
  providerId: string;
  consumerAddress: string;
  consumerPartyId: string;
  consumerPublicKeyDigest: string;
  consumerSettlementAddress?: string | null;
  consumerTransportPubkey?: string | null;
  tokenId: string;
  /** Consumer side of the initial channel balance. */
  localAmount: string;
  /** Provider side of the initial channel balance. */
  remoteAmount: string;
  openFee: string;
  leaseFee?: string | null;
  providerPartyId: string;
  providerPublicKeyDigest: string;
  providerSettlementAddress: string;
  expiresAt: number;
}

export interface OmniaLspOpenQuoteTerms extends OpenQuoteTermsSource {
  version: typeof OMNIA_LSP_OPEN_TERMS_VERSION;
  /** Optional fields are always present, using null when absent. */
  consumerSettlementAddress: string | null;
  consumerTransportPubkey: string | null;
  leaseFee: string | null;
}

export interface OpenQuoteSignatureFields {
  version: string;
  quoteId: string;
  termsHash: string;
  expiresAt: number;
}

export interface OpenQuoteTermsValidation {
  ok: boolean;
  errors: string[];
  /** Hash recomputed from the quote's own fields. */
  computedTermsHash: string;
}

function withHexPrefix(value: string): string {
  return value.startsWith('0x') ? value : `0x${value}`;
}

/**
 * The canonical terms for a quote. Field order is fixed here and nowhere else;
 * `hashCanonical` already sorts object keys, but a single builder keeps the two
 * sides from drifting if this shape changes.
 */
export function openQuoteTerms(source: OpenQuoteTermsSource): OmniaLspOpenQuoteTerms {
  return {
    version: OMNIA_LSP_OPEN_TERMS_VERSION,
    providerId: source.providerId,
    consumerAddress: source.consumerAddress,
    consumerPartyId: source.consumerPartyId,
    consumerPublicKeyDigest: source.consumerPublicKeyDigest,
    consumerSettlementAddress: source.consumerSettlementAddress ?? null,
    consumerTransportPubkey: source.consumerTransportPubkey ?? null,
    tokenId: source.tokenId,
    localAmount: source.localAmount,
    remoteAmount: source.remoteAmount,
    openFee: source.openFee,
    leaseFee: source.leaseFee ?? null,
    providerPartyId: source.providerPartyId,
    providerPublicKeyDigest: source.providerPublicKeyDigest,
    providerSettlementAddress: source.providerSettlementAddress,
    expiresAt: source.expiresAt,
  };
}

/** 0x-prefixed canonical hash of the terms. */
export function openQuoteTermsHash(terms: OpenQuoteTermsSource): string {
  return withHexPrefix(hashCanonical(OMNIA_LSP_OPEN_TERMS_VERSION, openQuoteTerms(terms)));
}

/**
 * The exact string a provider signs and a verifier checks.
 *
 * It binds the terms hash to the quote id, quote version and expiry, so a valid
 * signature cannot be lifted onto a different quote id or a different expiry
 * while leaving the economics untouched.
 */
export function openQuoteSigningPayload(quote: OpenQuoteSignatureFields): string {
  const canonical = JSON.stringify({
    domain: OMNIA_LSP_OPEN_QUOTE_SIGNING_DOMAIN,
    version: quote.version,
    quoteId: quote.quoteId,
    termsHash: quote.termsHash,
    expiresAt: quote.expiresAt,
  });
  return canonical;
}

/**
 * Recompute a received quote's terms hash and compare it with the one it
 * carries. A mismatch means the quote was altered after the provider signed it.
 */
export function validateOpenQuoteTerms(
  quote: OpenQuoteTermsSource & { termsHash: string },
): OpenQuoteTermsValidation {
  const computedTermsHash = openQuoteTermsHash(quote);
  const errors: string[] = [];
  if (computedTermsHash.toLowerCase() !== String(quote.termsHash).toLowerCase()) {
    errors.push('quote.termsHash does not match the quote terms');
  }
  return { ok: errors.length === 0, errors, computedTermsHash };
}

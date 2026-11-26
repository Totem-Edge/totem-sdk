import { hashCanonical } from '@totemsdk/core';
import { parseDecimalUnits } from './decimal.js';
import type { OmniaLspFeeBasis } from './fees.js';
import type { OmniaLspManifest } from './manifest.js';

export const OMNIA_LSP_OPEN_QUOTE_VERSION = 'omnia-lsp/open-quote/v1' as const;

/** Domain + version of the canonical terms object a quote commits to. */
export const OMNIA_LSP_OPEN_TERMS_VERSION = 'omnia-lsp/open-terms/v1' as const;

/** Domain separator for the payload a provider signs. */
export const OMNIA_LSP_OPEN_QUOTE_SIGNING_DOMAIN = 'omnia-lsp:open-quote:v1' as const;

export interface OmniaLspOpenQuote {
  version: typeof OMNIA_LSP_OPEN_QUOTE_VERSION;
  quoteId: string;
  providerId: string;
  consumerAddress: string;
  /** Consumer Omnia party id (identity id or channel party id). */
  consumerPartyId: string;
  /** Consumer channel key digest (32-byte hex). */
  consumerPublicKeyDigest: string;
  consumerSettlementAddress?: string;
  consumerTransportPubkey?: string;
  tokenId: string;
  /** Consumer side of the initial channel balance. */
  localAmount: string;
  /** Provider side of the initial channel balance. */
  remoteAmount: string;
  openFee: string;
  leaseFee?: string;
  /**
   * What the percentage fees were applied to. Required on quotes issued from
   * OMN-072 onward; absent on pre-OMN-072 quotes, which were priced on the
   * consumer contribution.
   */
  feeBasis?: OmniaLspFeeBasis;
  providerPartyId: string;
  providerPublicKeyDigest: string;
  providerSettlementAddress: string;
  termsHash: string;
  expiresAt: number;
  signature: string;
}

/** The exact object the provider commits to. Every field is signed. */
export interface OmniaLspOpenTerms {
  version: typeof OMNIA_LSP_OPEN_TERMS_VERSION;
  providerId: string;
  consumerAddress: string;
  consumerPartyId: string;
  consumerPublicKeyDigest: string;
  consumerSettlementAddress: string | null;
  consumerTransportPubkey: string | null;
  tokenId: string;
  localAmount: string;
  remoteAmount: string;
  openFee: string;
  leaseFee: string | null;
  feeBasis: OmniaLspFeeBasis;
  providerPartyId: string;
  providerPublicKeyDigest: string;
  providerSettlementAddress: string;
  expiresAt: number;
}

export interface QuoteValidationOptions {
  now?: number;
  expectedProviderId?: string;
  expectedConsumerAddress?: string;
  expectedTokenId?: string;
}

export interface QuoteValidationResult {
  ok: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && parseDecimalUnits(value, { allowZero: true }).ok;
}

function isPositiveDecimal(value: unknown): value is string {
  return typeof value === 'string' && parseDecimalUnits(value).ok;
}

function isHex64(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function push(errors: string[], condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

/**
 * Structural validation only.
 *
 * Passing this does not establish that the quote is authentic: it does not
 * recompute the terms hash or verify the signature. Use `verifyOpenQuote` for
 * that (OMN-071).
 */
export function validateOpenQuote(
  value: unknown,
  options: QuoteValidationOptions = {},
): QuoteValidationResult {
  const errors: string[] = [];
  const now = options.now ?? Date.now();

  if (!isRecord(value)) {
    return { ok: false, errors: ['quote must be an object'] };
  }

  push(errors, value.version === OMNIA_LSP_OPEN_QUOTE_VERSION, `version must be ${OMNIA_LSP_OPEN_QUOTE_VERSION}`);
  push(errors, isNonEmptyString(value.quoteId), 'quoteId must be a non-empty string');
  push(errors, isNonEmptyString(value.providerId), 'providerId must be a non-empty string');
  push(errors, isNonEmptyString(value.consumerAddress), 'consumerAddress must be a non-empty string');
  push(errors, isNonEmptyString(value.consumerPartyId), 'consumerPartyId must be a non-empty string');
  push(errors, isHex64(value.consumerPublicKeyDigest), 'consumerPublicKeyDigest must be a 32-byte hex string');
  if (value.consumerSettlementAddress !== undefined) {
    push(
      errors,
      isNonEmptyString(value.consumerSettlementAddress),
      'consumerSettlementAddress must be a non-empty string when present',
    );
  }
  if (value.consumerTransportPubkey !== undefined) {
    push(
      errors,
      isNonEmptyString(value.consumerTransportPubkey),
      'consumerTransportPubkey must be a non-empty string when present',
    );
  }
  push(errors, value.tokenId === '0x00' || isHex64(value.tokenId), 'tokenId must be 0x00 or a 32-byte token id');
  push(errors, isPositiveDecimal(value.localAmount), 'localAmount must be a positive decimal string');
  push(errors, isPositiveDecimal(value.remoteAmount), 'remoteAmount must be a positive decimal string');
  push(errors, isDecimal(value.openFee), 'openFee must be a non-negative decimal string');
  if (value.leaseFee !== undefined) {
    push(errors, isDecimal(value.leaseFee), 'leaseFee must be a non-negative decimal string');
  }
  if (value.feeBasis !== undefined) {
    push(errors, value.feeBasis === 'consumer' || value.feeBasis === 'total', 'feeBasis must be consumer or total');
  }
  push(errors, isNonEmptyString(value.providerPartyId), 'providerPartyId must be a non-empty string');
  push(errors, isHex64(value.providerPublicKeyDigest), 'providerPublicKeyDigest must be a 32-byte hex string');
  push(errors, isNonEmptyString(value.providerSettlementAddress), 'providerSettlementAddress must be a non-empty string');
  push(errors, isHex64(value.termsHash), 'termsHash must be a 32-byte hex string');
  push(
    errors,
    typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) && value.expiresAt > now,
    'expiresAt must be a future unix epoch ms number',
  );
  push(errors, isNonEmptyString(value.signature), 'signature must be a non-empty string');

  if (options.expectedProviderId !== undefined) {
    push(errors, value.providerId === options.expectedProviderId, 'providerId does not match the expected provider');
  }
  if (options.expectedConsumerAddress !== undefined) {
    push(
      errors,
      value.consumerAddress === options.expectedConsumerAddress,
      'consumerAddress does not match the expected consumer',
    );
  }
  if (options.expectedTokenId !== undefined) {
    push(errors, value.tokenId === options.expectedTokenId, 'tokenId does not match the expected asset');
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidOpenQuote(
  value: unknown,
  options: QuoteValidationOptions = {},
): asserts value is OmniaLspOpenQuote {
  const result = validateOpenQuote(value, options);
  if (!result.ok) {
    throw new Error(`Invalid Omnia LSP open quote: ${result.errors.join('; ')}`);
  }
}

export function quoteIsFresh(quote: OmniaLspOpenQuote, now = Date.now()): boolean {
  return quote.expiresAt > now;
}

function normalizeHash(hash: string): string {
  return hash.startsWith('0x') ? hash : `0x${hash}`;
}

export interface BuildOpenTermsInput {
  manifest: OmniaLspManifest;
  consumerAddress: string;
  consumerPartyId: string;
  consumerPublicKeyDigest: string;
  consumerSettlementAddress?: string;
  consumerTransportPubkey?: string;
  tokenId: string;
  localAmount: string;
  remoteAmount: string;
  openFee: string;
  leaseFee?: string;
  feeBasis: OmniaLspFeeBasis;
  expiresAt: number;
}

/**
 * Build the canonical terms object.
 *
 * This is the single definition: quote issuance and quote verification both
 * call it, so the hashed field set cannot drift between them.
 */
export function buildOpenTerms(input: BuildOpenTermsInput): OmniaLspOpenTerms {
  return {
    version: OMNIA_LSP_OPEN_TERMS_VERSION,
    providerId: input.manifest.providerId,
    consumerAddress: input.consumerAddress,
    consumerPartyId: input.consumerPartyId,
    consumerPublicKeyDigest: input.consumerPublicKeyDigest,
    consumerSettlementAddress: input.consumerSettlementAddress ?? null,
    consumerTransportPubkey: input.consumerTransportPubkey ?? null,
    tokenId: input.tokenId,
    localAmount: input.localAmount,
    remoteAmount: input.remoteAmount,
    openFee: input.openFee,
    leaseFee: input.leaseFee ?? null,
    feeBasis: input.feeBasis,
    providerPartyId: input.manifest.channel.partyId,
    providerPublicKeyDigest: input.manifest.channel.publicKeyDigest,
    providerSettlementAddress: input.manifest.channel.settlementAddress,
    expiresAt: input.expiresAt,
  };
}

export function openTermsHash(terms: OmniaLspOpenTerms): string {
  return normalizeHash(hashCanonical(OMNIA_LSP_OPEN_TERMS_VERSION, terms));
}

/** Rebuild the signed terms from a quote. Requires `feeBasis` (OMN-072). */
export function openQuoteTerms(quote: OmniaLspOpenQuote): OmniaLspOpenTerms {
  if (quote.feeBasis === undefined) {
    throw new Error(
      'quote has no feeBasis; it was issued before OMN-072 and its signed terms cannot be recomputed',
    );
  }
  return {
    version: OMNIA_LSP_OPEN_TERMS_VERSION,
    providerId: quote.providerId,
    consumerAddress: quote.consumerAddress,
    consumerPartyId: quote.consumerPartyId,
    consumerPublicKeyDigest: quote.consumerPublicKeyDigest,
    consumerSettlementAddress: quote.consumerSettlementAddress ?? null,
    consumerTransportPubkey: quote.consumerTransportPubkey ?? null,
    tokenId: quote.tokenId,
    localAmount: quote.localAmount,
    remoteAmount: quote.remoteAmount,
    openFee: quote.openFee,
    leaseFee: quote.leaseFee ?? null,
    feeBasis: quote.feeBasis,
    providerPartyId: quote.providerPartyId,
    providerPublicKeyDigest: quote.providerPublicKeyDigest,
    providerSettlementAddress: quote.providerSettlementAddress,
    expiresAt: quote.expiresAt,
  };
}

export function openQuoteTermsHash(quote: OmniaLspOpenQuote): string {
  return openTermsHash(openQuoteTerms(quote));
}

export interface OpenQuoteSigningPayload {
  domain: typeof OMNIA_LSP_OPEN_QUOTE_SIGNING_DOMAIN;
  termsHash: string;
  /** The exact string a provider signs and a verifier checks. */
  payload: string;
}

/**
 * The bytes a provider signs: `domain|termsHash`.
 *
 * Signing the terms hash (rather than the whole quote object) means a verifier
 * never has to agree on object key order, and any field change invalidates the
 * signature as soon as the hash is recomputed.
 */
export function openQuoteSigningPayload(
  quote: Pick<OmniaLspOpenQuote, 'termsHash'>,
): OpenQuoteSigningPayload {
  const termsHash = normalizeHash(quote.termsHash);
  return {
    domain: OMNIA_LSP_OPEN_QUOTE_SIGNING_DOMAIN,
    termsHash,
    payload: `${OMNIA_LSP_OPEN_QUOTE_SIGNING_DOMAIN}|${termsHash}`,
  };
}

export interface VerifyOpenQuoteOptions {
  /** Trusted clock. Defaults to Date.now(). */
  now?: number;
  /**
   * Verify the signature over `openQuoteSigningPayload(quote).payload`.
   * Signature schemes are injected so the package stays runtime-neutral.
   */
  verifySignature?: (
    input: OpenQuoteSigningPayload & { signature: string; quote: OmniaLspOpenQuote },
  ) => boolean | Promise<boolean>;
  /** When false, a quote may be verified without a signature check. Default true. */
  requireSignature?: boolean;
  expectedProviderId?: string;
  expectedConsumerAddress?: string;
  expectedConsumerPartyId?: string;
  expectedConsumerPublicKeyDigest?: string;
  expectedTokenId?: string;
}

export interface VerifyOpenQuoteResult {
  ok: boolean;
  errors: string[];
  terms?: OmniaLspOpenTerms;
}

/**
 * Verify that a quote is authentic and still applies (OMN-071 / OMN-066).
 *
 * Checks, in order: structural validity, freshness against the supplied clock,
 * that the quoted fields reproduce `termsHash`, that the provider identity
 * matches the manifest and token offering, that the quote is bound to the
 * expected consumer (when supplied), and the signature over the recomputed
 * terms hash.
 */
export async function verifyOpenQuote(
  value: unknown,
  manifest: OmniaLspManifest,
  options: VerifyOpenQuoteOptions = {},
): Promise<VerifyOpenQuoteResult> {
  const structural = validateOpenQuote(value, {
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.expectedProviderId !== undefined ? { expectedProviderId: options.expectedProviderId } : {}),
    ...(options.expectedConsumerAddress !== undefined
      ? { expectedConsumerAddress: options.expectedConsumerAddress }
      : {}),
    ...(options.expectedTokenId !== undefined ? { expectedTokenId: options.expectedTokenId } : {}),
  });
  if (!structural.ok) return { ok: false, errors: structural.errors };

  const quote = value as OmniaLspOpenQuote;
  const errors: string[] = [];

  let terms: OmniaLspOpenTerms | undefined;
  try {
    terms = openQuoteTerms(quote);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }

  const recomputed = openTermsHash(terms);
  if (recomputed !== normalizeHash(quote.termsHash)) {
    errors.push('termsHash does not match the quoted terms');
  }

  const manifestBinding = quoteMatchesManifest(quote, manifest);
  errors.push(...manifestBinding.errors);

  if (options.expectedConsumerPartyId !== undefined
    && quote.consumerPartyId !== options.expectedConsumerPartyId) {
    errors.push('consumerPartyId does not match the expected consumer');
  }
  if (options.expectedConsumerPublicKeyDigest !== undefined
    && quote.consumerPublicKeyDigest !== options.expectedConsumerPublicKeyDigest) {
    errors.push('consumerPublicKeyDigest does not match the expected consumer');
  }

  const requireSignature = options.requireSignature !== false;
  if (!options.verifySignature) {
    if (requireSignature) errors.push('quote signature was not verified: no verifier supplied');
  } else if (errors.length === 0) {
    const payload = openQuoteSigningPayload(quote);
    try {
      const verified = await options.verifySignature({
        ...payload,
        signature: quote.signature,
        quote,
      });
      if (!verified) errors.push('quote signature does not verify');
    } catch (error) {
      errors.push(`quote signature cannot be verified: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { ok: errors.length === 0, errors, terms };
}

/**
 * Bind a quote to the provider manifest fields it claims to represent.
 * A quote is not a substitute for manifest verification; it must be checked
 * after the manifest signature and identity binding have been verified.
 */
export function quoteMatchesManifest(
  quote: OmniaLspOpenQuote,
  manifest: OmniaLspManifest,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (quote.providerId !== manifest.providerId) errors.push('quote.providerId does not match manifest');
  if (quote.providerPartyId !== manifest.channel.partyId) errors.push('quote.providerPartyId does not match manifest');
  if (quote.providerPublicKeyDigest !== manifest.channel.publicKeyDigest) {
    errors.push('quote.providerPublicKeyDigest does not match manifest');
  }
  if (quote.providerSettlementAddress !== manifest.channel.settlementAddress) {
    errors.push('quote.providerSettlementAddress does not match manifest');
  }
  if (!manifest.assets.some((asset) => asset.tokenId === quote.tokenId)) {
    errors.push('quote.tokenId is not offered by the manifest');
  }
  return { ok: errors.length === 0, errors };
}

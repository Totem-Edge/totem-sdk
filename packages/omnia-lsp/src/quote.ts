import { OMNIA_LSP_VERSION, type OmniaLspManifest } from './manifest.js';

export const OMNIA_LSP_OPEN_QUOTE_VERSION = 'omnia-lsp/open-quote/v1' as const;

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
  providerPartyId: string;
  providerPublicKeyDigest: string;
  providerSettlementAddress: string;
  termsHash: string;
  expiresAt: number;
  signature: string;
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
  return typeof value === 'string' && /^\d+(\.\d+)?$/.test(value);
}

function isPositiveDecimal(value: unknown): value is string {
  return isDecimal(value) && Number(value) > 0;
}

function isHex64(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function push(errors: string[], condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

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
  push(errors, isDecimal(value.openFee), 'openFee must be a decimal string');
  if (value.leaseFee !== undefined) {
    push(errors, isDecimal(value.leaseFee), 'leaseFee must be a decimal string');
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

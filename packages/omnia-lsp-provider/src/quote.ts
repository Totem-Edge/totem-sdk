import type { OmniaLspManifest, OmniaLspOpenQuote } from '@totemsdk/omnia-lsp';
import { openQuoteTermsHash } from '@totemsdk/omnia-lsp';
import type { OmniaLspOpenRequest } from './policy.js';
import { addAmounts, applyBps } from './amounts.js';

export type UnsignedOmniaLspOpenQuote = Omit<OmniaLspOpenQuote, 'signature'>;

/** Distinguishes two quotes issued for identical terms in the same millisecond. */
let quoteSequence = 0;

export interface CreateQuoteOptions {
  manifest: OmniaLspManifest;
  request: OmniaLspOpenRequest;
  now?: number;
  ttlMs?: number;
  quoteId?: string;
}

/**
 * Build the provider's unsigned open quote. The provider host signs it before
 * returning it to the consumer; a quote without a signature is not authoritative.
 *
 * Fee basis (OMN-070): variable fees are charged on the consumer's contribution
 * (`localAmount`) and are ADDED to the flat opening fee. The previous code used
 * `openFlat ?? openBps(localAmount)`, so a manifest that declared both silently
 * dropped the percentage fee, and the admission check only looked at the bps
 * value — a flat-fee-only provider could quote any amount above a consumer's
 * limit.
 */
export function createUnsignedOpenQuote(options: CreateQuoteOptions): UnsignedOmniaLspOpenQuote {
  const { manifest, request } = options;
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 60_000;
  const expiresAt = now + ttlMs;

  const variableOpenFee =
    manifest.fees.openBps !== undefined
      ? applyBps(request.localAmount, manifest.fees.openBps)
      : '0';
  if (variableOpenFee === null) {
    throw new Error('localAmount is not a valid decimal amount for fee calculation');
  }
  const openFee = addAmounts(manifest.fees.openFlat ?? '0', variableOpenFee);
  if (openFee === null) {
    throw new Error('manifest open fee is not a valid decimal amount');
  }

  let leaseFee: string | undefined;
  if (request.lease === true && manifest.fees.leaseBps !== undefined) {
    const computed = applyBps(request.localAmount, manifest.fees.leaseBps);
    if (computed === null) {
      throw new Error('localAmount is not a valid decimal amount for lease fee calculation');
    }
    leaseFee = computed;
  }

  const termsHash = openQuoteTermsHash({
    providerId: manifest.providerId,
    consumerAddress: request.consumerAddress,
    consumerPartyId: request.consumerPartyId,
    consumerPublicKeyDigest: request.consumerPublicKeyDigest,
    consumerSettlementAddress: request.consumerSettlementAddress ?? null,
    consumerTransportPubkey: request.consumerTransportPubkey ?? null,
    tokenId: request.tokenId,
    localAmount: request.localAmount,
    remoteAmount: request.remoteAmount,
    openFee,
    leaseFee: leaseFee ?? null,
    providerPartyId: manifest.channel.partyId,
    providerPublicKeyDigest: manifest.channel.publicKeyDigest,
    providerSettlementAddress: manifest.channel.settlementAddress,
    expiresAt,
  });

  return {
    version: 'omnia-lsp/open-quote/v1',
    // A quote id must be unique even for identical requests: two quotes for the
    // same terms in the same millisecond previously collided, so the capacity
    // reservation and single-use ledger treated them as one quote.
    quoteId: options.quoteId ?? `quote-${termsHash.slice(2, 18)}-${now.toString(36)}-${(quoteSequence++).toString(36)}`,
    providerId: manifest.providerId,
    consumerAddress: request.consumerAddress,
    consumerPartyId: request.consumerPartyId,
    consumerPublicKeyDigest: request.consumerPublicKeyDigest,
    ...(request.consumerSettlementAddress
      ? { consumerSettlementAddress: request.consumerSettlementAddress }
      : {}),
    ...(request.consumerTransportPubkey
      ? { consumerTransportPubkey: request.consumerTransportPubkey }
      : {}),
    tokenId: request.tokenId,
    localAmount: request.localAmount,
    remoteAmount: request.remoteAmount,
    openFee,
    ...(leaseFee !== undefined ? { leaseFee } : {}),
    providerPartyId: manifest.channel.partyId,
    providerPublicKeyDigest: manifest.channel.publicKeyDigest,
    providerSettlementAddress: manifest.channel.settlementAddress,
    termsHash,
    expiresAt,
  };
}

/**
 * Sign an unsigned quote with a provider identity signer. The signer is injected
 * so the package stays runtime-neutral and never holds a private key.
 *
 * The signature must cover `openQuoteSigningPayload(quote)` from
 * `@totemsdk/omnia-lsp` — that binds the terms hash, quote id, version and
 * expiry. Verifiers are handed exactly that payload.
 */
export function signOpenQuote(
  quote: UnsignedOmniaLspOpenQuote,
  sign: (quote: UnsignedOmniaLspOpenQuote) => Promise<string> | string,
): Promise<OmniaLspOpenQuote> {
  return Promise.resolve(sign(quote)).then((signature) => ({ ...quote, signature }));
}

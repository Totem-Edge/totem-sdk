import {
  buildOpenTerms,
  computeOpenFees,
  DEFAULT_FEE_BASIS,
  openQuoteSigningPayload,
  openTermsHash,
} from '@totemsdk/omnia-lsp';
import type {
  OmniaLspFeeBasis,
  OmniaLspManifest,
  OmniaLspOpenQuote,
  OpenQuoteSigningPayload,
} from '@totemsdk/omnia-lsp';
import type { OmniaLspOpenRequest } from './policy.js';

export type UnsignedOmniaLspOpenQuote = Omit<OmniaLspOpenQuote, 'signature'>;

export interface CreateQuoteOptions {
  manifest: OmniaLspManifest;
  request: OmniaLspOpenRequest;
  now?: number;
  ttlMs?: number;
  quoteId?: string;
  /** Fee basis for percentage fees. Defaults to the total channel value. */
  feeBasis?: OmniaLspFeeBasis;
}

/**
 * Build the provider's unsigned open quote. The provider host signs it before
 * returning it to the consumer; a quote without a signature is not authoritative.
 *
 * The quoted fees come from the shared schedule (OMN-072) and the terms object
 * is built by `buildOpenTerms`, which is the same function the verifier uses to
 * recompute the hash.
 */
export function createUnsignedOpenQuote(options: CreateQuoteOptions): UnsignedOmniaLspOpenQuote {
  const { manifest, request } = options;
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 60_000;
  const expiresAt = now + ttlMs;
  const basis = options.feeBasis ?? DEFAULT_FEE_BASIS;

  const fees = computeOpenFees(manifest, request, basis);
  if (!fees.ok) {
    throw new Error(`cannot quote open request: ${fees.error}`);
  }
  const schedule = fees.schedule;

  const terms = buildOpenTerms({
    manifest,
    consumerAddress: request.consumerAddress,
    consumerPartyId: request.consumerPartyId,
    consumerPublicKeyDigest: request.consumerPublicKeyDigest,
    ...(request.consumerSettlementAddress !== undefined
      ? { consumerSettlementAddress: request.consumerSettlementAddress }
      : {}),
    ...(request.consumerTransportPubkey !== undefined
      ? { consumerTransportPubkey: request.consumerTransportPubkey }
      : {}),
    tokenId: request.tokenId,
    localAmount: request.localAmount,
    remoteAmount: request.remoteAmount,
    openFee: schedule.openFee,
    ...(schedule.leaseFee !== undefined ? { leaseFee: schedule.leaseFee } : {}),
    feeBasis: schedule.basis,
    expiresAt,
  });
  const termsHash = openTermsHash(terms);

  return {
    version: 'omnia-lsp/open-quote/v1',
    quoteId: options.quoteId ?? `quote-${termsHash.slice(2, 18)}-${now.toString(36)}`,
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
    openFee: schedule.openFee,
    ...(schedule.leaseFee !== undefined ? { leaseFee: schedule.leaseFee } : {}),
    feeBasis: schedule.basis,
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
 * The second argument is the exact payload to sign (`domain|termsHash`). A
 * one-argument signer keeps working; a signer that ignores the payload must sign
 * this same string to produce quotes that `verifyOpenQuote` accepts.
 */
export function signOpenQuote(
  quote: UnsignedOmniaLspOpenQuote,
  sign: (
    quote: UnsignedOmniaLspOpenQuote,
    payload: OpenQuoteSigningPayload,
  ) => Promise<string> | string,
): Promise<OmniaLspOpenQuote> {
  const payload = openQuoteSigningPayload(quote);
  return Promise.resolve(sign(quote, payload)).then((signature) => ({ ...quote, signature }));
}

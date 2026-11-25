import { hashCanonical } from '@totemsdk/core';
import type { OmniaLspManifest, OmniaLspOpenQuote } from '@totemsdk/omnia-lsp';
import type { OmniaLspOpenRequest } from './policy.js';

export type UnsignedOmniaLspOpenQuote = Omit<OmniaLspOpenQuote, 'signature'>;

export interface CreateQuoteOptions {
  manifest: OmniaLspManifest;
  request: OmniaLspOpenRequest;
  now?: number;
  ttlMs?: number;
  quoteId?: string;
}

const DECIMAL_SCALE = 18n;
const DECIMAL_FACTOR = 10n ** DECIMAL_SCALE;

function decimalKey(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return (
    BigInt(whole) * DECIMAL_FACTOR +
    BigInt(fraction.padEnd(Number(DECIMAL_SCALE), '0').slice(0, Number(DECIMAL_SCALE)))
  );
}

function formatScaled(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / DECIMAL_FACTOR;
  const fraction = absolute % DECIMAL_FACTOR;
  const fractionText = fraction
    .toString()
    .padStart(Number(DECIMAL_SCALE), '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''}`;
}

function applyBps(amount: string, bps: number): string {
  return formatScaled((decimalKey(amount) * BigInt(bps)) / 10_000n);
}

/**
 * Build the provider's unsigned open quote. The provider host signs it before
 * returning it to the consumer; a quote without a signature is not authoritative.
 */
export function createUnsignedOpenQuote(options: CreateQuoteOptions): UnsignedOmniaLspOpenQuote {
  const { manifest, request } = options;
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 60_000;
  const expiresAt = now + ttlMs;

  const openFee =
    manifest.fees.openFlat ??
    (manifest.fees.openBps ? applyBps(request.localAmount, manifest.fees.openBps) : '0');
  const leaseFee =
    request.lease === true && manifest.fees.leaseBps
      ? applyBps(request.localAmount, manifest.fees.leaseBps)
      : undefined;

  const terms = {
    version: 'omnia-lsp/open-terms/v1' as const,
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
  };
  const rawTermsHash = hashCanonical('omnia-lsp:open-terms:v1', terms);
  const termsHash = rawTermsHash.startsWith('0x') ? rawTermsHash : `0x${rawTermsHash}`;

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
 */
export function signOpenQuote(
  quote: UnsignedOmniaLspOpenQuote,
  sign: (quote: UnsignedOmniaLspOpenQuote) => Promise<string> | string,
): Promise<OmniaLspOpenQuote> {
  return Promise.resolve(sign(quote)).then((signature) => ({ ...quote, signature }));
}

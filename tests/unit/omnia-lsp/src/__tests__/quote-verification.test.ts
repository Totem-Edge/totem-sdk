import {
  openQuoteSigningPayload,
  openQuoteTermsHash,
  validateOpenQuoteTerms,
  verifyOpenQuote,
  type OmniaLspOpenQuote,
} from '../index';

/**
 * OMN-069 — a quote's signature must be verifiable, not merely present.
 *
 * `validateOpenQuote()` used to accept any non-empty `signature` string, so a
 * forged quote passed structural validation. These tests pin the three checks a
 * consumer needs: structure, a terms hash recomputed from the received fields,
 * and a valid provider signature over the canonical payload.
 */

const NOW = 1_700_000_000_000;

function unsignedQuote(): Omit<OmniaLspOpenQuote, 'signature'> {
  const fields = {
    providerId: 'prov-moka-launch-1',
    consumerAddress: 'MxCONSUMER000000000000000000000000000000000000000000000000000001',
    consumerPartyId: 'party-consumer-1',
    consumerPublicKeyDigest: `0x${'55'.repeat(32)}`,
    consumerSettlementAddress: 'MxCONSUMER000000000000000000000000000000000000000000000000000001',
    consumerTransportPubkey: null,
    tokenId: '0x00',
    localAmount: '100',
    remoteAmount: '100',
    openFee: '0',
    leaseFee: null,
    providerPartyId: 'party-provider-1',
    providerPublicKeyDigest: `0x${'22'.repeat(32)}`,
    providerSettlementAddress: 'MxPROVIDERSETTLEMENT000000000000000000000000000000000000000000002',
    expiresAt: NOW + 60_000,
  };
  return {
    version: 'omnia-lsp/open-quote/v1',
    quoteId: 'quote-test-1',
    providerId: fields.providerId,
    consumerAddress: fields.consumerAddress,
    consumerPartyId: fields.consumerPartyId,
    consumerPublicKeyDigest: fields.consumerPublicKeyDigest,
    consumerSettlementAddress: fields.consumerSettlementAddress,
    tokenId: fields.tokenId,
    localAmount: fields.localAmount,
    remoteAmount: fields.remoteAmount,
    openFee: fields.openFee,
    providerPartyId: fields.providerPartyId,
    providerPublicKeyDigest: fields.providerPublicKeyDigest,
    providerSettlementAddress: fields.providerSettlementAddress,
    termsHash: openQuoteTermsHash(fields),
    expiresAt: fields.expiresAt,
  };
}

function signedQuote(): OmniaLspOpenQuote {
  const quote = unsignedQuote();
  return { ...quote, signature: `sig:${openQuoteSigningPayload(quote)}` };
}

/** Verifies the test scheme: signature over the canonical payload. */
const verify = (payload: string, quote: OmniaLspOpenQuote): boolean =>
  quote.signature === `sig:${payload}`;

describe('verifyOpenQuote', () => {
  test('accepts a quote signed over its canonical terms', async () => {
    const result = await verifyOpenQuote(signedQuote(), verify, { now: NOW });
    expect(result).toEqual({ ok: true, errors: [] });
  });

  test('rejects a quote whose signature is only present, not valid', async () => {
    const result = await verifyOpenQuote({ ...signedQuote(), signature: '0xdeadbeef' }, verify, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/signature/);
  });

  test('rejects a quote whose economic terms were edited after signing', async () => {
    const tampered = { ...signedQuote(), remoteAmount: '400' };
    const result = await verifyOpenQuote(tampered, verify, { now: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/termsHash/);
  });

  test('rejects a signature lifted onto a different quote id', async () => {
    const original = signedQuote();
    const moved = { ...original, quoteId: 'quote-other-1' };
    const result = await verifyOpenQuote(moved, verify, { now: NOW });
    expect(result.ok).toBe(false);
  });

  test('rejects an expired quote', async () => {
    const result = await verifyOpenQuote(signedQuote(), verify, { now: NOW + 120_000 });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expiresAt/);
  });

  test('rejects malformed input without calling the verifier', async () => {
    const verifier = jest.fn(() => true);
    const result = await verifyOpenQuote({ version: 'nope' }, verifier, { now: NOW });
    expect(result.ok).toBe(false);
    expect(verifier).not.toHaveBeenCalled();
  });
});

describe('validateOpenQuoteTerms', () => {
  test('recomputes the hash from the received fields', () => {
    const quote = signedQuote();
    expect(validateOpenQuoteTerms(quote)).toMatchObject({ ok: true, computedTermsHash: quote.termsHash });
  });

  test('detects a changed provider settlement address', () => {
    const quote = { ...signedQuote(), providerSettlementAddress: 'MxATTACKER' };
    const result = validateOpenQuoteTerms(quote);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/termsHash/);
  });
});

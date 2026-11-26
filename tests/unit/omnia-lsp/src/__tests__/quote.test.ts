import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyBpsUnits,
  buildOpenTerms,
  formatDecimalUnits,
  openQuoteSigningPayload,
  openQuoteTerms,
  openQuoteTermsHash,
  parseDecimalUnits,
  verifyOpenQuote,
  type OmniaLspManifest,
  type OmniaLspOpenQuote,
} from '../index';

const VECTORS = join(__dirname, '../../../../../packages/omnia-lsp/test-vectors');

function manifest(): OmniaLspManifest {
  return JSON.parse(readFileSync(join(VECTORS, 'manifest.valid.json'), 'utf8')) as OmniaLspManifest;
}

function signedQuote(overrides: Partial<OmniaLspOpenQuote> = {}, now = 1_700_000_000_000): OmniaLspOpenQuote {
  const m = manifest();
  const base = {
    version: 'omnia-lsp/open-quote/v1' as const,
    quoteId: 'quote-test-1',
    providerId: m.providerId,
    consumerAddress: 'MxCONSUMER000000000000000000000000000000000000000000000000000001',
    consumerPartyId: 'party-consumer-1',
    consumerPublicKeyDigest: `0x${'55'.repeat(32)}`,
    tokenId: '0x00',
    localAmount: '100',
    remoteAmount: '25',
    openFee: '0',
    feeBasis: 'total' as const,
    providerPartyId: m.channel.partyId,
    providerPublicKeyDigest: m.channel.publicKeyDigest,
    providerSettlementAddress: m.channel.settlementAddress,
    expiresAt: now + 60_000,
  };
  const terms = buildOpenTerms({
    manifest: m,
    consumerAddress: base.consumerAddress,
    consumerPartyId: base.consumerPartyId,
    consumerPublicKeyDigest: base.consumerPublicKeyDigest,
    tokenId: base.tokenId,
    localAmount: base.localAmount,
    remoteAmount: base.remoteAmount,
    openFee: base.openFee,
    feeBasis: base.feeBasis,
    expiresAt: base.expiresAt,
  });
  const termsHash = openQuoteTermsHash({ ...base, termsHash: '', signature: '' } as OmniaLspOpenQuote);
  return {
    ...base,
    ...overrides,
    termsHash: overrides.termsHash ?? termsHash,
    signature: overrides.signature ?? termsHash,
  };
}

/** Stand-in verifier: the test signer signs with the terms hash itself. */
const verifier = ({ termsHash, signature }: { termsHash: string; signature: string }) =>
  signature === termsHash;

describe('OMN-071 verifyOpenQuote', () => {
  test('accepts a quote whose signature covers the recomputed terms hash', async () => {
    const quote = signedQuote();
    const result = await verifyOpenQuote(quote, manifest(), {
      now: 1_700_000_000_000,
      verifySignature: verifier,
    });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.terms?.feeBasis).toBe('total');
  });

  test('rejects a field mutation because the terms hash no longer reproduces', async () => {
    const quote = { ...signedQuote(), remoteAmount: '2500' };
    const verifierCalled = jest.fn(verifier);
    const result = await verifyOpenQuote(quote, manifest(), {
      now: 1_700_000_000_000,
      verifySignature: verifierCalled,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/termsHash does not match/);
    // A quote that fails the hash check is rejected without consulting the
    // signature verifier: the payload is already known to be untrustworthy.
    expect(verifierCalled).not.toHaveBeenCalled();
  });

  test('rejects a signature produced by another key', async () => {
    const quote = { ...signedQuote(), signature: '0xsigned-by-someone-else' };
    const result = await verifyOpenQuote(quote, manifest(), { now: 1_700_000_000_000, verifySignature: verifier });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/signature does not verify/);
  });

  test('fails closed when no verifier is supplied', async () => {
    const result = await verifyOpenQuote(signedQuote(), manifest(), { now: 1_700_000_000_000 });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/no verifier supplied/);
  });

  test('binds the quote to the expected consumer', async () => {
    const result = await verifyOpenQuote(signedQuote(), manifest(), {
      now: 1_700_000_000_000,
      verifySignature: verifier,
      expectedConsumerPartyId: 'party-someone-else',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/consumerPartyId/);
  });

  test('surfaces a throwing verifier as a structured failure', async () => {
    const result = await verifyOpenQuote(signedQuote(), manifest(), {
      now: 1_700_000_000_000,
      verifySignature: () => { throw new Error('hsm offline'); },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/hsm offline/);
  });

  test('refuses a pre-OMN-072 quote that carries no fee basis', async () => {
    const quote = signedQuote();
    const legacy = { ...quote };
    delete (legacy as { feeBasis?: string }).feeBasis;
    const result = await verifyOpenQuote(legacy, manifest(), {
      now: 1_700_000_000_000,
      verifySignature: verifier,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/no feeBasis/);
  });

  test('the signing payload is domain separated and stable', () => {
    const quote = signedQuote();
    const payload = openQuoteSigningPayload(quote);
    expect(payload.payload).toBe(`omnia-lsp:open-quote:v1|${quote.termsHash}`);
  });
});

describe('OMN-073 strict decimal parsing', () => {
  test('parses a canonical decimal', () => {
    expect(parseDecimalUnits('0.5')).toMatchObject({ ok: true, units: 500_000_000_000_000_000n });
    expect(parseDecimalUnits('100')).toMatchObject({ ok: true, units: 100n * 10n ** 18n });
  });

  test('rejects a negative amount instead of mis-signing it', () => {
    const result = parseDecimalUnits('-1.5');
    expect(result.ok).toBe(false);
  });

  test('rejects precision beyond 18 places instead of truncating', () => {
    const result = parseDecimalUnits('1.0000000000000000001');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/decimal places/);
  });

  test('rejects malformed input without reaching BigInt', () => {
    for (const value of ['abc', '', '.5', '1.', '01.5', '1e3', '+1', ' 1']) {
      expect(parseDecimalUnits(value).ok).toBe(false);
    }
  });

  test('rejects zero unless explicitly allowed', () => {
    expect(parseDecimalUnits('0').ok).toBe(false);
    expect(parseDecimalUnits('0', { allowZero: true })).toMatchObject({ ok: true, units: 0n });
  });

  test('round-trips through the formatter', () => {
    for (const value of ['0.000000000000000001', '1', '1234.5', '1000000']) {
      const parsed = parseDecimalUnits(value, { allowZero: true });
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(formatDecimalUnits(parsed.units)).toBe(value.replace(/^0+(?=\d)/, ''));
    }
  });

  test('applies basis points on integer units and floors', () => {
    expect(applyBpsUnits(10n ** 18n, 250)).toBe(25n * 10n ** 15n);
    expect(applyBpsUnits(3n, 5000)).toBe(1n);
  });
});

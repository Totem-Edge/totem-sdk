import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OmniaLspManifest, OmniaLspOpenQuote } from '@totemsdk/omnia-lsp';
import {
  createOmniaLspProvider,
  evaluateOpenRequest,
  type OmniaLspProviderHost,
} from '../index';

/**
 * OMN-064 / 065 / 067 / 068 / 070 / 071 — LSP authorization and capital safety.
 *
 * These are the adversarial cases for the provider facade: a quote is an
 * authorization to commit provider capital, so accepting one must mean the
 * provider signed exactly these terms, for this consumer, once.
 */

const VECTORS = join(__dirname, '../../../../../packages/omnia-lsp/test-vectors');

function manifest(): OmniaLspManifest {
  return JSON.parse(readFileSync(join(VECTORS, 'manifest.valid.json'), 'utf8')) as OmniaLspManifest;
}

const baseRequest = {
  providerId: 'prov-moka-launch-1',
  consumerAddress: 'MxCONSUMER000000000000000000000000000000000000000000000000000001',
  consumerPartyId: 'party-consumer-1',
  consumerPublicKeyDigest: `0x${'55'.repeat(32)}`,
  consumerSettlementAddress: 'MxCONSUMER000000000000000000000000000000000000000000000000000001',
  tokenId: '0x00',
  localAmount: '100',
  remoteAmount: '100',
  direction: 'both' as const,
};

/** Test signature scheme: `sig:<termsHash>`; verifier checks the signed payload. */
const signQuote = (quote: { termsHash: string }) => `sig:${quote.termsHash}`;

const verifyQuote = (payload: string, quote: OmniaLspOpenQuote): boolean => {
  const parsed = JSON.parse(payload) as { termsHash: string };
  return parsed.termsHash === quote.termsHash && quote.signature === `sig:${quote.termsHash}`;
};

function hostSpy() {
  const openChannel = jest.fn(async () => ({ success: true, channelId: '0xchannel' }));
  const host: OmniaLspProviderHost = { openChannel };
  return { host, openChannel };
}

describe('openQuote authenticates the quote (OMN-064)', () => {
  test('accepts a quote the provider signed for these terms', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({ manifest: manifest(), host, signQuote, verifyQuote });
    const quote = await provider.quote(baseRequest);

    const result = await provider.openQuote(quote, '0xcoin');

    expect(result).toMatchObject({ success: true, channelId: '0xchannel' });
    expect(openChannel).toHaveBeenCalledTimes(1);
  });

  test('rejects a quote whose provider signature does not verify', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({
      manifest: manifest(),
      host,
      signQuote,
      verifyQuote: () => false,
    });
    const quote = await provider.quote(baseRequest);

    const result = await provider.openQuote(quote);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_UNVERIFIED');
    expect(openChannel).not.toHaveBeenCalled();
  });

  test('rejects a quote whose terms were edited after signing', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({ manifest: manifest(), host, signQuote, verifyQuote });
    const quote = await provider.quote(baseRequest);

    const forged: OmniaLspOpenQuote = { ...quote, remoteAmount: '400' };
    const result = await provider.openQuote(forged);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_UNVERIFIED');
    expect(result.error).toMatch(/termsHash/);
    expect(openChannel).not.toHaveBeenCalled();
  });

  test('refuses to accept any quote when no verifier is configured', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({ manifest: manifest(), host, signQuote });
    const quote = await provider.quote(baseRequest);

    const result = await provider.openQuote(quote);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_VERIFICATION_UNAVAILABLE');
    expect(openChannel).not.toHaveBeenCalled();
  });

  test('consumes a quote exactly once', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({ manifest: manifest(), host, signQuote, verifyQuote });
    const quote = await provider.quote(baseRequest);

    const first = await provider.openQuote(quote);
    const second = await provider.openQuote(quote);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.errorCode).toBe('QUOTE_ALREADY_USED');
    expect(openChannel).toHaveBeenCalledTimes(1);
  });

  test('binds the quote to the authenticated consumer', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({ manifest: manifest(), host, signQuote, verifyQuote });
    const quote = await provider.quote(baseRequest);

    const result = await provider.openQuote(quote, undefined, {
      consumerAddress: 'MxSOMEONEELSE00000000000000000000000000000000000000000000000001',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_CONSUMER_MISMATCH');
    expect(openChannel).not.toHaveBeenCalled();
  });

  test('re-applies admission when the quote is presented', async () => {
    const { host, openChannel } = hostSpy();
    const mutable = manifest();
    const provider = createOmniaLspProvider({ manifest: mutable, host, signQuote, verifyQuote });
    const quote = await provider.quote(baseRequest);

    // Provider tightens its limit after issuing the quote.
    mutable.assets[0].maxChannel = '50';

    const result = await provider.openQuote(quote);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_REJECTED');
    expect(openChannel).not.toHaveBeenCalled();
  });

  test('rejects an expired quote before asking the host', async () => {
    const { host, openChannel } = hostSpy();
    const provider = createOmniaLspProvider({
      manifest: manifest(),
      host,
      signQuote,
      verifyQuote,
      now: () => 2_000_000_000_000,
    });
    const quote = await provider.quote({ ...baseRequest });

    const result = await provider.openQuote({ ...quote, expiresAt: 1 });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_EXPIRED');
    expect(openChannel).not.toHaveBeenCalled();
  });
});

describe('admission covers both sides of the channel (OMN-065)', () => {
  test('rejects a provider contribution above the channel maximum', () => {
    // localAmount alone fits every published limit; the provider's 600 does not.
    const decision = evaluateOpenRequest(manifest(), { ...baseRequest, localAmount: '10', remoteAmount: '600' });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/maximum/);
  });

  test('rejects a total channel size below the provider minimum', () => {
    const decision = evaluateOpenRequest(manifest(), { ...baseRequest, localAmount: '5', remoteAmount: '0' });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/minimum/);
  });

  test('rejects a provider contribution the operator has not funded', () => {
    const decision = evaluateOpenRequest(
      manifest(),
      { ...baseRequest, remoteAmount: '100' },
      { availableProviderLiquidity: () => '50' },
    );
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/liquidity/);
  });

  test('refuses to quote beyond outstanding reservations (OMN-066)', async () => {
    const { host } = hostSpy();
    const provider = createOmniaLspProvider({
      // 250 total capacity: each request (200) fits, but the provider side of
      // three concurrent quotes (300) does not.
      manifest: { ...manifest(), assets: [{ ...manifest().assets[0], inboundCapacity: '250', outboundCapacity: '250' }] },
      host,
      signQuote,
      verifyQuote,
      policy: { availableProviderLiquidity: () => '1000' },
    });

    await provider.quote(baseRequest);
    await provider.quote(baseRequest);
    await expect(provider.quote(baseRequest)).rejects.toThrow(/capital/);
  });
});

describe('admission arithmetic (OMN-070, OMN-071)', () => {
  test('rejects amounts with more precision than the policy can represent', () => {
    const decision = evaluateOpenRequest(manifest(), {
      ...baseRequest,
      localAmount: '100.0000000000000000001',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/18 decimals/);
  });

  test('rejects signed, empty and exponent amounts instead of coercing them', () => {
    for (const localAmount of ['-5', '1e3', '', ' 100 ', '0x10']) {
      const decision = evaluateOpenRequest(manifest(), { ...baseRequest, localAmount });
      expect(decision.allowed).toBe(false);
    }
  });

  test('counts a flat opening fee against the consumer fee ceiling', () => {
    const flatOnly = { ...manifest(), fees: { ...manifest().fees, openBps: 0, openFlat: '10' } };
    const decision = evaluateOpenRequest(flatOnly, { ...baseRequest, maxOpenFeeBps: 500 });
    // 10 on a 100 consumer contribution is 1000 bps.
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/fee/);
  });

  test('quotes flat and percentage opening fees together', async () => {
    const { host } = hostSpy();
    const bothFees = { ...manifest(), fees: { ...manifest().fees, openFlat: '0.5', openBps: 100 } };
    const provider = createOmniaLspProvider({ manifest: bothFees, host, signQuote, verifyQuote });

    const quote = await provider.quote(baseRequest);

    expect(quote.openFee).toBe('1.5');
  });
});

describe('admission clock (OMN-067)', () => {
  test('ignores a caller-supplied clock', () => {
    const expiredManifest = { ...manifest(), expiresAt: 1_000 };
    const decision = evaluateOpenRequest(expiredManifest, { ...baseRequest, now: 0 });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/expired/);
  });

  test('uses the provider clock even when a stale request clock is supplied', () => {
    const decision = evaluateOpenRequest(
      { ...manifest(), expiresAt: 2_000 },
      { ...baseRequest, now: 9_999_999_999_999 },
      { now: () => 1_000 },
    );
    expect(decision.allowed).toBe(true);
  });
});

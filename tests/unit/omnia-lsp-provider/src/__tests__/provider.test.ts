import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OmniaLspManifest } from '@totemsdk/omnia-lsp';
import {
  createMemoryQuoteLedger,
  createOmniaLspProvider,
  createUnsignedOpenQuote,
  evaluateOpenRequest,
  signOpenQuote,
} from '../index';

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

describe('provider admission policy', () => {
  test('accepts a request that fits the manifest', () => {
    const decision = evaluateOpenRequest(manifest(), baseRequest);
    expect(decision).toMatchObject({ allowed: true, errors: [] });
  });

  test('rejects a request for another provider', () => {
    const decision = evaluateOpenRequest(manifest(), {
      ...baseRequest,
      providerId: 'prov-other',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/providerId/);
  });

  test('rejects insufficient capacity', () => {
    const decision = evaluateOpenRequest(manifest(), {
      ...baseRequest,
      localAmount: '9999',
      remoteAmount: '9999',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/maximum|capacity/);
  });

  test('rejects lease when the provider does not offer it', () => {
    const decision = evaluateOpenRequest(manifest(), { ...baseRequest, lease: true });
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/lease/);
  });

  test('rejects hosted custody under the default policy', () => {
    const hosted = {
      ...manifest(),
      custody: { mode: 'hosted' as const, canMoveFunds: false },
    };
    const decision = evaluateOpenRequest(hosted, baseRequest);
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/hosted/);
  });
});

describe('provider quotes', () => {
  test('builds a terms-bound unsigned quote', () => {
    const now = 1_700_000_000_000;
    const quote = createUnsignedOpenQuote({
      manifest: manifest(),
      request: baseRequest,
      now,
      ttlMs: 30_000,
    });

    expect(quote.providerId).toBe('prov-moka-launch-1');
    expect(quote.consumerAddress).toBe(baseRequest.consumerAddress);
    expect(quote.openFee).toBe('0');
    expect(quote.termsHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(quote.expiresAt).toBe(now + 30_000);
  });

  test('signs a quote with the injected provider signer', async () => {
    const quote = createUnsignedOpenQuote({
      manifest: manifest(),
      request: baseRequest,
    });
    const signed = await signOpenQuote(quote, () => '0xsigned');
    expect(signed.signature).toBe('0xsigned');
    expect(signed.termsHash).toBe(quote.termsHash);
  });
});

describe('provider facade', () => {
  test('issues a quote and delegates open to the host', async () => {
    const host = {
      openChannel: jest.fn(async () => ({ success: true, channelId: '0xchannel', fundingTxId: '0xtx' })),
      closeChannel: jest.fn(async () => ({ success: true })),
    };
    const provider = createOmniaLspProvider({
      manifest: manifest(),
      host,
      signQuote: () => '0xsigned',
    });

    const quote = await provider.quote(baseRequest);
    expect(quote.signature).toBe('0xsigned');

    const result = await provider.open(baseRequest, '0xcoin');
    expect(result).toMatchObject({ success: true, channelId: '0xchannel' });
    expect(host.openChannel).toHaveBeenCalledWith(
      expect.objectContaining({ fundingCoinId: '0xcoin', quote: expect.objectContaining({ signature: '0xsigned' }) }),
    );

    const closed = await provider.close('0xchannel');
    expect(closed.success).toBe(true);
    expect(host.closeChannel).toHaveBeenCalledWith('0xchannel');
  });

  test('lets the host select a coin when no funding id is supplied', async () => {
    const host = {
      openChannel: jest.fn(async () => ({ success: true, channelId: '0xchannel' })),
    };
    const provider = createOmniaLspProvider({
      manifest: manifest(),
      host,
      signQuote: () => '0xsigned',
    });

    const result = await provider.open(baseRequest);
    expect(result.success).toBe(true);
    expect(host.openChannel).toHaveBeenCalledWith(
      expect.not.objectContaining({ fundingCoinId: expect.anything() }),
    );
  });

  test('passes provider-selected funding material through the facade', async () => {
    const host = {
      openChannel: jest.fn(async () => ({ success: true, channelId: '0xchannel' })),
    };
    const provider = createOmniaLspProvider({
      manifest: manifest(),
      host,
      signQuote: () => '0xsigned',
    });

    await provider.open(baseRequest, {
      fundingCoinId: '0xcoin',
      fundingPubkey: '0xpub',
      fundingScript: 'RETURN TRUE',
    });

    expect(host.openChannel).toHaveBeenCalledWith(expect.objectContaining({
      fundingCoinId: '0xcoin',
      fundingPubkey: '0xpub',
      fundingScript: 'RETURN TRUE',
    }));
  });

  test('rejects an expired quote before delegating', async () => {
    const host = { openChannel: jest.fn() };
    const provider = createOmniaLspProvider({
      manifest: manifest(),
      host,
      signQuote: () => '0xsigned',
      now: () => 2_000_000_000_000,
    });

    const quote = createUnsignedOpenQuote({
      manifest: manifest(),
      request: baseRequest,
      now: 1_000,
      ttlMs: 1,
    });
    const result = await provider.openQuote({ ...quote, signature: '0xsigned' }, '0xcoin');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_EXPIRED');
    expect(host.openChannel).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-066/067/068/069/072 — quote authorization, capital and fees
// ─────────────────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;

function manifestWith(overrides: Partial<OmniaLspManifest>): OmniaLspManifest {
  return { ...manifest(), ...overrides };
}

/** Test signer: signs the terms hash, so the verifier can compare it. */
const signWithHash = (_quote: unknown, payload: { termsHash: string }) => payload.termsHash;
const verifyHash = ({ signature, termsHash }: { signature: string; termsHash: string }) =>
  signature === termsHash;

function testProvider(overrides: Record<string, unknown> = {}) {
  const host = {
    openChannel: jest.fn(async () => ({ success: true, channelId: '0xchannel', fundingTxId: '0xtx' })),
    closeChannel: jest.fn(async () => ({ success: true })),
  };
  const provider = createOmniaLspProvider({
    manifest: manifest(),
    host,
    signQuote: signWithHash,
    verifyQuoteSignature: verifyHash,
    now: () => NOW,
    ...overrides,
  });
  return { provider, host };
}

describe('OMN-067 both channel contributions are validated', () => {
  test('rejects a provider-side amount above the channel maximum', () => {
    const decision = evaluateOpenRequest(
      manifest(),
      { ...baseRequest, remoteAmount: '600' },
      {},
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/remoteAmount is above the provider maximum/);
  });

  test('rejects a provider-side amount below the channel minimum', () => {
    const decision = evaluateOpenRequest(
      manifest(),
      { ...baseRequest, remoteAmount: '5' },
      {},
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/remoteAmount is below the provider minimum/);
  });

  test('rejects a provider-side amount above the available provider funds', () => {
    const decision = evaluateOpenRequest(
      manifest(),
      baseRequest,
      { availableProviderFunds: '50' },
      NOW,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/available funds/);
  });

  test('checks directional capacity on the side that supplies it', () => {
    const tight = manifestWith({
      assets: [{
        tokenId: '0x00', scale: 44,
        inboundCapacity: '100', outboundCapacity: '100',
        minChannel: '10', maxChannel: '5000',
      }],
    });
    const send = evaluateOpenRequest(tight, { ...baseRequest, direction: 'send', remoteAmount: '200' }, {}, NOW);
    expect(send.allowed).toBe(false);
    expect(send.errors.join(' ')).toMatch(/provider contribution/);

    const consumer = evaluateOpenRequest(tight, { ...baseRequest, direction: 'send', localAmount: '200' }, {}, NOW);
    expect(consumer.allowed).toBe(false);
    expect(consumer.errors.join(' ')).toMatch(/consumer contribution/);
  });
});

describe('OMN-069 admission uses the provider clock', () => {
  test('a request cannot rescue an expired manifest by supplying a time', () => {
    const expired = manifestWith({ expiresAt: 1_000 });
    const requestWithClock = { ...baseRequest, now: 1 } as typeof baseRequest;
    const decision = evaluateOpenRequest(expired, requestWithClock, {}, 2_000);
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/manifest is expired/);
  });

  test('the facade evaluates with its own clock', () => {
    const { provider } = testProvider({ manifest: manifestWith({ expiresAt: NOW - 1 }) });
    const decision = provider.evaluate(baseRequest);
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/manifest is expired/);
  });
});

describe('OMN-072 fees are bounded and priced on an explicit basis', () => {
  test('a flat opening fee is bounded by the request rate ceiling', () => {
    const flat = manifestWith({ fees: { openBps: 0, openFlat: '50' } });
    const decision = evaluateOpenRequest(flat, { ...baseRequest, maxOpenFeeBps: 1 }, {}, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/maximum rate/);
  });

  test('a total-fee ceiling in atoms is enforced', () => {
    const bps = manifestWith({ fees: { openBps: 100 } });
    const decision = evaluateOpenRequest(bps, { ...baseRequest, maxOpenFee: '1' }, {}, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.errors.join(' ')).toMatch(/total open fee/);
  });

  test('lease fees are priced on the total channel value and the basis is signed', async () => {
    const leaseManifest = manifestWith({
      fees: { openBps: 0, leaseBps: 100 },
      terms: { ...manifest().terms, lease: true },
    });
    const { provider } = testProvider({ manifest: leaseManifest });
    const quote = await provider.quote({ ...baseRequest, lease: true, remoteAmount: '300' });
    // 1% of 400 (consumer + provider), not 1% of 100.
    expect(quote.leaseFee).toBe('4');
    expect(quote.feeBasis).toBe('total');
  });
});

describe('OMN-068 quotes reserve provider capacity', () => {
  test('concurrent quotes cannot collectively exceed the manifest capacity', async () => {
    const { provider, host } = testProvider();
    const request = { ...baseRequest, localAmount: '500', remoteAmount: '500' };

    await provider.quote(request);
    await provider.quote(request);
    await expect(provider.quote(request)).rejects.toThrow(/capacity is exhausted/);
    expect(host.openChannel).not.toHaveBeenCalled();
  });

  test('a ledger records the reservation and frees it when the quote expires', async () => {
    const ledger = createMemoryQuoteLedger();
    let clock = NOW;
    const { provider } = testProvider({ quoteLedger: ledger, now: () => clock });

    await provider.quote(baseRequest);
    expect(await ledger.outstanding('0x00', 'prov-moka-launch-1', clock)).toBe(100n * 10n ** 18n);

    clock = NOW + 120_000; // past the 60s TTL
    expect(await ledger.outstanding('0x00', 'prov-moka-launch-1', clock)).toBe(0n);
  });

  test('redemption consumes the reservation so a quote cannot be reused', async () => {
    const { provider, host } = testProvider();
    const quote = await provider.quote(baseRequest);
    const consumer = { partyId: quote.consumerPartyId };

    const first = await provider.openQuote(quote, '0xcoin', { consumer });
    expect(first.success).toBe(true);
    expect(host.openChannel).toHaveBeenCalledTimes(1);

    const second = await provider.openQuote(quote, '0xcoin', { consumer });
    expect(second.success).toBe(false);
    expect(second.errorCode).toBe('QUOTE_ALREADY_CONSUMED');
    expect(host.openChannel).toHaveBeenCalledTimes(1);
  });
});

describe('OMN-066 openQuote authenticates, binds and re-applies policy', () => {
  test('redeems a genuine quote for the bound consumer', async () => {
    const { provider, host } = testProvider();
    const quote = await provider.quote(baseRequest);
    const result = await provider.openQuote(quote, '0xcoin', {
      consumer: { partyId: baseRequest.consumerPartyId },
    });
    expect(result.success).toBe(true);
    expect(host.openChannel).toHaveBeenCalledWith(expect.objectContaining({
      quote: expect.objectContaining({ quoteId: quote.quoteId }),
    }));
  });

  test('rejects a quote whose terms were modified in flight', async () => {
    const { provider, host } = testProvider();
    const quote = await provider.quote(baseRequest);
    const tampered = { ...quote, remoteAmount: '2500' };

    const result = await provider.openQuote(tampered, '0xcoin', {
      consumer: { partyId: quote.consumerPartyId },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_INVALID');
    expect(result.error).toMatch(/termsHash does not match/);
    expect(host.openChannel).not.toHaveBeenCalled();
  });

  test('rejects an unsigned quote and does not reach the host', async () => {
    const { provider, host } = testProvider({ verifyQuoteSignature: undefined });
    const quote = await provider.quote(baseRequest);
    const result = await provider.openQuote(quote, '0xcoin', {
      consumer: { partyId: quote.consumerPartyId },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_INVALID');
    expect(result.error).toMatch(/no verifier supplied/);
    expect(host.openChannel).not.toHaveBeenCalled();
  });

  test('refuses to redeem without the authenticated consumer', async () => {
    const { provider, host } = testProvider();
    const quote = await provider.quote(baseRequest);
    const result = await provider.openQuote(quote, '0xcoin');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_CONSUMER_UNBOUND');
    expect(host.openChannel).not.toHaveBeenCalled();
  });

  test('refuses a quote issued to a different consumer', async () => {
    const { provider } = testProvider();
    const quote = await provider.quote(baseRequest);
    const result = await provider.openQuote(quote, '0xcoin', {
      consumer: { partyId: 'party-someone-else' },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_INVALID');
    expect(result.error).toMatch(/consumerPartyId/);
  });

  test('refuses a quote this provider never issued', async () => {
    const { provider } = testProvider();
    const unsigned = createUnsignedOpenQuote({
      manifest: manifest(),
      request: baseRequest,
      now: NOW,
      quoteId: 'quote-not-in-ledger',
    });
    const quote = await signOpenQuote(unsigned, signWithHash);
    const result = await provider.openQuote(quote, '0xcoin', {
      consumer: { partyId: quote.consumerPartyId },
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_NOT_ISSUED');
  });

  test('re-applies policy at redemption time', async () => {
    const policy: { availableProviderFunds?: string } = {};
    const { provider, host } = testProvider({ policy });
    const quote = await provider.quote(baseRequest);

    // The provider's spendable funds drop after the quote was issued.
    policy.availableProviderFunds = '10';
    const result = await provider.openQuote(quote, '0xcoin', {
      consumer: { partyId: quote.consumerPartyId },
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('QUOTE_POLICY_REJECTED');
    expect(result.error).toMatch(/available funds/);
    expect(host.openChannel).not.toHaveBeenCalled();
  });
});

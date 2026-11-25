import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OmniaLspManifest } from '@totemsdk/omnia-lsp';
import {
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

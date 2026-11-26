import type { OmniaLspOpenQuote } from '@totemsdk/omnia-lsp';
import { createOmniaHostProviderHost } from '../index';

const quote: OmniaLspOpenQuote = {
  version: 'omnia-lsp/open-quote/v1',
  quoteId: 'quote-1',
  providerId: 'prov-moka-launch-1',
  consumerAddress: 'MxCONSUMER000000000000000000000000000000000000000000000000000001',
  consumerPartyId: 'consumer-party',
  consumerPublicKeyDigest: `0x${'55'.repeat(32)}`,
  consumerSettlementAddress: 'MxCONSUMERSETTLEMENT00000000000000000000000000000000000000000001',
  consumerTransportPubkey: 'transport-consumer',
  tokenId: '0x00',
  localAmount: '100',
  remoteAmount: '25',
  openFee: '0',
  providerPartyId: 'party-provider-1',
  providerPublicKeyDigest: `0x${'22'.repeat(32)}`,
  providerSettlementAddress: 'MxPROVIDERSETTLEMENT000000000000000000000000000000000000000000002',
  termsHash: `0x${'33'.repeat(32)}`,
  expiresAt: Date.now() + 60_000,
  signature: '0xsigned',
};

describe('createOmniaHostProviderHost', () => {
  test('maps the consumer quote into the provider omnia-host open call', async () => {
    const open = jest.fn(async () => ({ success: true, channelId: 'c1', fundingTxId: 'f1' }));
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', open]]),
    });

    const result = await host.openChannel({ quote, fundingCoinId: '0xprovidercoin' });

    expect(result).toEqual({ success: true, channelId: 'c1', fundingTxId: 'f1' });
    expect(open).toHaveBeenCalledWith(expect.objectContaining({
      remotePartyId: 'consumer-party',
      remotePublicKeyDigest: quote.consumerPublicKeyDigest,
      remoteSettlementAddress: quote.consumerSettlementAddress,
      remoteTransportPubkey: 'transport-consumer',
      // The host is the provider: provider side becomes local, consumer side remote.
      localAmount: '25',
      remoteAmount: '100',
      tokenId: '0x00',
      fundingCoinId: '0xprovidercoin',
    }));
  });

  test('omits funding fields when the provider lets the host select a coin', async () => {
    const open = jest.fn(async () => ({ success: true, channelId: 'c1' }));
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', open]]),
    });

    const result = await host.openChannel({ quote });

    expect(result.success).toBe(true);
    expect(open).toHaveBeenCalledWith(expect.not.objectContaining({
      fundingCoinId: expect.anything(),
    }));
    expect(open).toHaveBeenCalledWith(expect.not.objectContaining({
      fundingPubkey: expect.anything(),
    }));
  });

  test('passes provider-selected funding material through', async () => {
    const open = jest.fn(async () => ({ success: true, channelId: 'c1' }));
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', open]]),
    });

    await host.openChannel({
      quote,
      fundingAddress: 'MxFUNDING',
      fundingCoinId: '0xcoin',
      fundingPubkey: '0xpub',
      fundingScript: 'RETURN TRUE',
      fundingCoinProofsHex: ['0xproof'],
      contestDelayBlocks: 2,
    });

    expect(open).toHaveBeenCalledWith(expect.objectContaining({
      fundingAddress: 'MxFUNDING',
      fundingCoinId: '0xcoin',
      fundingPubkey: '0xpub',
      fundingScript: 'RETURN TRUE',
      fundingCoinProofsHex: ['0xproof'],
      contestDelayBlocks: 2,
    }));
  });

  test('returns UNSUPPORTED when the host does not register openChannel', async () => {
    const host = createOmniaHostProviderHost({ methods: new Map() });
    const result = await host.openChannel({ quote, fundingCoinId: '0xprovidercoin' });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED');
  });

  test('delegates closeChannel', async () => {
    const close = jest.fn(async () => ({ success: true }));
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaCloseChannel', close]]),
    });

    const result = await host.closeChannel!('c1');

    expect(result.success).toBe(true);
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'c1' }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-070 — a host response must carry explicit, operation-specific evidence
// ─────────────────────────────────────────────────────────────────────────────

describe('host operation results are not assumed to be successes', () => {
  test('an undefined open response is a failure', async () => {
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', async () => undefined]]),
    });
    const result = await host.openChannel({ quote });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('HOST_PROTOCOL_ERROR');
  });

  test('an empty object is not a successful open', async () => {
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', async () => ({})]]),
    });
    const result = await host.openChannel({ quote });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('HOST_OPEN_FAILED');
  });

  test('success without a channelId is a protocol error', async () => {
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', async () => ({ success: true })]]),
    });
    const result = await host.openChannel({ quote });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('HOST_PROTOCOL_ERROR');
    expect(result.error).toMatch(/without a channelId/);
  });

  test('an error-only response keeps its message and is a failure', async () => {
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaOpenChannel', async () => ({ error: 'funding coin is spent' })]]),
    });
    const result = await host.openChannel({ quote });
    expect(result.success).toBe(false);
    expect(result.error).toBe('funding coin is spent');
    expect(result.errorCode).toBe('HOST_OPEN_FAILED');
  });

  test('a malformed close response is a failure', async () => {
    const host = createOmniaHostProviderHost({
      methods: new Map([['totem_omniaCloseChannel', async () => ({})]]),
    });
    const result = await host.closeChannel!('c1');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('HOST_CLOSE_FAILED');
  });
});

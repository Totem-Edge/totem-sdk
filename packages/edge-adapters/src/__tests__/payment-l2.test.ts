import { createOmniaL2PaymentPort } from '../payment-l2';
import type { ChannelGraph, ChannelOps, PaymentResult } from '@totemsdk/omnia-router';

// ─── minimal fakes ────────────────────────────────────────────────────────────

function makeGraph(hasRoute = true): ChannelGraph {
  return {
    edges: [],
    // findRoute is mocked module-level; we just need a valid object here
  } as unknown as ChannelGraph;
}

function makeOps(): jest.Mocked<ChannelOps> {
  return {
    addHTLC: jest.fn(),
    fulfillHTLC: jest.fn(),
    timeoutHTLC: jest.fn(),
    getState: jest.fn(),
  } as unknown as jest.Mocked<ChannelOps>;
}

// ─── mock omnia-router module ─────────────────────────────────────────────────

jest.mock('@totemsdk/omnia-router', () => ({
  findRoute: jest.fn(),
  buildPaymentRequest: jest.fn().mockReturnValue({
    hashlock: 'aabbcc',
    preimage: 'secret',
    amount: 500n,
    tokenId: '0x00',
    expiryBlock: 1000n,
  }),
  executeMultiHopPayment: jest.fn(),
}));

import { findRoute, executeMultiHopPayment } from '@totemsdk/omnia-router';
const mockFindRoute = findRoute as jest.Mock;
const mockExecute = executeMultiHopPayment as jest.Mock;

afterEach(() => jest.clearAllMocks());

describe('createOmniaL2PaymentPort — pay', () => {
  const fakeRoute = { hops: [{ channelId: 'ch1' }], totalFee: 10n, pathLength: 1 };

  it('returns ok:true with preimage as txpowId on success', async () => {
    mockFindRoute.mockReturnValue(fakeRoute);
    mockExecute.mockResolvedValue({ success: true, preimage: 'deadbeef', settledHops: ['ch1'] } as PaymentResult);

    const port = createOmniaL2PaymentPort({
      graph: makeGraph(),
      channels: new Map(),
      ops: makeOps(),
      leaseProviders: new Map(),
      localPublicKeyDigest: '0xLOCAL',
      getCurrentBlock: async () => 900n,
    });

    const result = await port.pay({ recipient: '0xRECIPIENT', amount: '0.000005' });
    expect(result.ok).toBe(true);
    expect(result.data?.txpowId).toBe('deadbeef');
  });

  it('returns ok:false with NO_ROUTE when findRoute returns null', async () => {
    mockFindRoute.mockReturnValue(null);

    const port = createOmniaL2PaymentPort({
      graph: makeGraph(false),
      channels: new Map(),
      ops: makeOps(),
      leaseProviders: new Map(),
      localPublicKeyDigest: '0xLOCAL',
      getCurrentBlock: async () => 900n,
    });

    const result = await port.pay({ recipient: '0xRECIPIENT', amount: '5' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NO_ROUTE');
  });

  it('returns ok:false with PAYMENT_FAILED when execute fails', async () => {
    mockFindRoute.mockReturnValue(fakeRoute);
    mockExecute.mockResolvedValue({ success: false, error: 'HTLC timeout', settledHops: [] } as PaymentResult);

    const port = createOmniaL2PaymentPort({
      graph: makeGraph(),
      channels: new Map(),
      ops: makeOps(),
      leaseProviders: new Map(),
      localPublicKeyDigest: '0xLOCAL',
      getCurrentBlock: async () => 900n,
    });

    const result = await port.pay({ recipient: '0xRECIPIENT', amount: '5' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('PAYMENT_FAILED');
    expect(result.error).toContain('HTLC timeout');
  });

  it('applies custom htlcTimeoutBlocks to expiry calculation', async () => {
    mockFindRoute.mockReturnValue(fakeRoute);
    mockExecute.mockResolvedValue({ success: true, preimage: 'px', settledHops: [] } as PaymentResult);

    const { buildPaymentRequest } = jest.requireMock('@totemsdk/omnia-router') as { buildPaymentRequest: jest.Mock };

    const port = createOmniaL2PaymentPort({
      graph: makeGraph(),
      channels: new Map(),
      ops: makeOps(),
      leaseProviders: new Map(),
      localPublicKeyDigest: '0xLOCAL',
      getCurrentBlock: async () => 1000n,
      htlcTimeoutBlocks: 288n,
    });

    await port.pay({ recipient: '0xR', amount: '1' });
    expect(buildPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.anything(), 1288n);
  });
});

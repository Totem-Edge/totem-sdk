import {
  assertExpiryFits,
  hopTimeoutBlock,
  resolveHopExpiryDelta,
} from '../expiry';
import { validateRouteForPayment } from '../route-validation';
import {
  buildRouterFeeProof,
  cancelPayment,
  isStateBoundFeeProof,
  verifyRouterFeeProof,
} from '../execute';
import type { CrossTokenRoute, RouterChannel, Route, SwapHop, RoutingHop } from '../types';

/**
 * OMN-078 / OMN-079 — the route must deliver the payment, and the timeouts must
 * leave a real contest window.
 *
 * Hop-by-hop validation cannot see an empty route, a route that stops short of
 * the recipient, or one that changes asset mid-path. These tests pin the
 * payment-bound checks and the expiry separation arithmetic.
 */

const S = 100_000_000n;
const TOKEN_A = '0x' + 'aa'.repeat(32);
const TOKEN_B = '0x' + 'bb'.repeat(32);

function hop(from: string, to: string, channelId: string, amount = 100n * S, tokenId = TOKEN_A): RoutingHop {
  return { channelId, from, to, amount, tokenId };
}

function route(hops: (RoutingHop | SwapHop)[], tokenIn = TOKEN_A, tokenOut = TOKEN_A): Route {
  return { hops, totalFees: 0n, tokenIn, tokenOut, estimatedBlocks: 6 };
}

const expectation = { tokenId: TOKEN_A, amount: 100n * S, sender: 'alice', recipient: 'carol' };

describe('validateRouteForPayment', () => {
  test('accepts a connected route that delivers the requested amount', () => {
    const result = validateRouteForPayment(
      route([hop('alice', 'bob', 'c1'), hop('bob', 'carol', 'c2')]),
      expectation,
    );
    expect(result).toEqual({ ok: true });
  });

  test('rejects an empty route', () => {
    const result = validateRouteForPayment(route([]), expectation);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no hops/) });
  });

  test('rejects a route that does not start at the payer', () => {
    const result = validateRouteForPayment(
      route([hop('mallory', 'bob', 'c1'), hop('bob', 'carol', 'c2')]),
      expectation,
    );
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/not at the payer/);
  });

  test('rejects a route that stops short of the recipient', () => {
    const result = validateRouteForPayment(route([hop('alice', 'carol', 'c1')]), {
      ...expectation,
      recipient: 'dave',
    });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/not at the recipient/);
  });

  test('rejects a discontinuity between hops', () => {
    const result = validateRouteForPayment(
      route([hop('alice', 'bob', 'c1'), hop('carol', 'dave', 'c2')]),
      { ...expectation, recipient: undefined },
    );
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/hop 1 starts at carol/);
  });

  test('rejects an asset change without a swap hop', () => {
    const result = validateRouteForPayment(
      route([hop('alice', 'bob', 'c1'), hop('bob', 'carol', 'c2', 100n * S, TOKEN_B)]),
      { ...expectation, recipient: undefined },
    );
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/carries .*route carries/);
  });

  test('rejects a route that delivers the wrong amount', () => {
    const result = validateRouteForPayment(route([hop('alice', 'carol', 'c1', 99n * S)]), expectation);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/delivers/);
  });

  test('accepts a swap route that changes asset exactly once', () => {
    const swap: SwapHop = {
      ...hop('alice', 'carol', 'c-out'),
      isSwap: true,
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      amountIn: 100n * S,
      amountOut: 95n * S,
      rate: '0.95',
      inboundChannelId: 'c-in',
      outboundChannelId: 'c-out',
    };
    const swapRoute: CrossTokenRoute = {
      ...route([swap], TOKEN_A, TOKEN_B),
      swapHops: [swap],
    };
    const result = validateRouteForPayment(swapRoute, {
      tokenId: TOKEN_A,
      amount: 100n * S,
      sender: 'alice',
      recipient: 'carol',
    });
    expect(result).toEqual({ ok: true });
  });

  test('rejects a route whose declared tokenOut contradicts its hops', () => {
    const result = validateRouteForPayment(
      route([hop('alice', 'carol', 'c1')], TOKEN_A, TOKEN_B),
      expectation,
    );
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(/tokenOut/);
  });
});

describe('expiry separation', () => {
  test('derives the separation from the contest window', () => {
    expect(resolveHopExpiryDelta()).toBe(257n);
    expect(resolveHopExpiryDelta({ contestDelayBlocks: 100n, confirmations: 2n })).toBe(102n);
    expect(resolveHopExpiryDelta({ hopExpiryDelta: 7n })).toBe(7n);
  });

  test('refuses a non-positive separation', () => {
    expect(() => resolveHopExpiryDelta({ hopExpiryDelta: 0n })).toThrow(/positive/);
  });

  test('subtracts a full window per hop', () => {
    expect(hopTimeoutBlock(2000n, 0, 257n)).toBe(2000n);
    expect(hopTimeoutBlock(2000n, 1, 257n)).toBe(1743n);
    expect(hopTimeoutBlock(2000n, 3, 257n)).toBe(1229n);
  });

  test('refuses an expiry without room rather than clamping to one block', () => {
    expect(() => hopTimeoutBlock(500n, 2, 257n)).toThrow(/leaves no room/);
    expect(() => assertExpiryFits(500n, 3, 257n)).toThrow(/leaves no room/);
    expect(() => assertExpiryFits(1000n, 3, 257n)).not.toThrow();
  });
});

describe('router fee proof evidence (OMN-081)', () => {
  const channel: RouterChannel = {
    channelId: 'c1',
    tokenId: TOKEN_A,
    parties: [
      { partyId: 'p1', publicKeyDigest: 'alice', addressIndex: 0 },
      { partyId: 'p2', publicKeyDigest: 'bob', addressIndex: 1 },
    ],
    balances: { p1: 100n, p2: 100n },
    pendingHTLCs: [],
    totalValue: 200n,
    currentSequence: 3,
    status: 'active',
  };
  const htlc = {
    htlcId: 'h1',
    amount: 10n,
    hashlock: '0x' + '11'.repeat(32),
    timeoutBlock: 100n,
    direction: 'offered' as const,
    status: 'fulfilled' as const,
    htlcAddress: 'Mx',
    senderPublicKeyDigest: 'alice',
    recipientPublicKeyDigest: 'bob',
  };

  test('marks a proof descriptive when no authenticated state is available', () => {
    const proof = buildRouterFeeProof(channel, htlc, 1);
    expect(proof.evidence).toBe('descriptive');
    expect(isStateBoundFeeProof(proof)).toBe(false);
    expect(verifyRouterFeeProof(proof)).toMatchObject({ ok: false });
  });

  test('binds a proof to the channel state commitment when present', () => {
    const bound = {
      ...channel,
      stateCommitment: { sequence: 4, hash: '0x' + 'aa'.repeat(32) },
    };
    const proof = buildRouterFeeProof(bound, htlc, 1);

    expect(proof.evidence).toBe('state-bound');
    expect(isStateBoundFeeProof(proof)).toBe(true);
    expect(verifyRouterFeeProof(proof, {
      channelId: 'c1',
      stateCommitment: bound.stateCommitment,
    })).toEqual({ ok: true, errors: [] });
  });

  test('rejects a proof whose commitment does not match the expected state', () => {
    const bound = {
      ...channel,
      stateCommitment: { sequence: 4, hash: '0x' + 'aa'.repeat(32) },
    };
    const proof = buildRouterFeeProof(bound, htlc, 1);
    const result = verifyRouterFeeProof(proof, {
      stateCommitment: { sequence: 5, hash: '0x' + 'bb'.repeat(32) },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/commitment/);
  });

  test('rejects an edited proof', () => {
    const bound = {
      ...channel,
      stateCommitment: { sequence: 4, hash: '0x' + 'aa'.repeat(32) },
    };
    const proof = buildRouterFeeProof(bound, htlc, 1);
    const result = verifyRouterFeeProof({ ...proof, amount: 1000n }, {});
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/hash does not match/);
  });
});

describe('rollback records stranded locks (OMN-080)', () => {
  const ch: RouterChannel = {
    channelId: 'c1',
    tokenId: TOKEN_A,
    parties: [
      { partyId: 'p1', publicKeyDigest: 'alice', addressIndex: 0 },
      { partyId: 'p2', publicKeyDigest: 'bob', addressIndex: 1 },
    ],
    balances: { p1: 100n, p2: 100n },
    pendingHTLCs: [],
    totalValue: 200n,
    currentSequence: 1,
    status: 'active',
  };
  const lockedRoute: Route = {
    ...route([{ channelId: 'c1', from: 'alice', to: 'bob', amount: 10n, tokenId: TOKEN_A, htlcId: 'h1' }]),
  };
  const ops = {
    addHTLC: jest.fn(),
    fulfillHTLC: jest.fn(),
    timeoutHTLC: jest.fn(async () => ({ channel: ch })),
  };

  test('reports a lock it cannot release for lack of a lease provider', async () => {
    const pending = await cancelPayment(ops as never, new Map([['c1', ch]]), lockedRoute, new Map())
      .then(() => null)
      .catch((error: unknown) => error as { pendingRefunds: Array<{ reason: string }> });

    expect(pending).not.toBeNull();
    expect(pending!.pendingRefunds[0].reason).toMatch(/no lease provider/);
  });

  test('reports a lock it cannot release for lack of channel state', async () => {
    const pending = await cancelPayment(ops as never, new Map(), lockedRoute, new Map([['c1', {}]]))
      .then(() => null)
      .catch((error: unknown) => error as { pendingRefunds: Array<{ reason: string }> });

    expect(pending).not.toBeNull();
    expect(pending!.pendingRefunds[0].reason).toMatch(/channel state is not loaded/);
  });

  test('does not report a refund when the timeout succeeds', async () => {
    await expect(
      cancelPayment(ops as never, new Map([['c1', ch]]), lockedRoute, new Map([['c1', {}]])),
    ).resolves.toBeUndefined();
  });
});

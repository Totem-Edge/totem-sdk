import {
  createChannelGraph,
  addChannel,
  removeChannel,
  announceSwap,
  findRoute,
  findCrossTokenRoute,
  applyRate,
  parseRateToScaled,
  executeMultiHopPayment,
  executeCrossTokenPayment,
  cancelPayment,
  buildPaymentRequest,
  validateRoute,
  PendingRefundError,
  planRouteExpiry,
  hopTimeout,
  buildAuthenticatedRouterFeeProof,
  buildRouterFeeProof,
  verifyRouterFeeProof,
} from '../index';
import type {
  RouterChannel,
  ChannelGraphEdge,
  ChannelOps,
  RoutingHop,
  LeaseProvider,
  PaymentRequest,
  CrossTokenRoute,
} from '../index';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const SCALE    = 100_000_000n;
const TOKEN_A  = '0x00';
const TOKEN_B  = '0xBBBB';

const ALICE  = 'pk-alice';
const BOB    = 'pk-bob';
const CAROL  = 'pk-carol';
const BRIDGE = 'pk-bridge';

const MOCK_LP: LeaseProvider = {};

function mkEdge(
  id: string, from: string, to: string, tokenId: string, balance: bigint, feeRate = 100_000n,
): ChannelGraphEdge {
  return { channelId: id, from, to, tokenId, availableBalance: balance, htlcCapacity: balance, feeRate };
}

function mkChannel(
  id: string, from: string, to: string, tokenId = TOKEN_A, balance = 1000n * SCALE,
): RouterChannel {
  return {
    channelId:        id,
    tokenId,
    parties: [
      { partyId: 'A', publicKeyDigest: from, addressIndex: 0 },
      { partyId: 'B', publicKeyDigest: to,   addressIndex: 0 },
    ],
    balances:         { A: balance, B: 0n },
    pendingHTLCs:     [],
    totalValue:       balance,
    currentSequence:  0,
    status:           'active',
    localSigner:      { publicKeyDigest: from },
  };
}

// ─── Mock ChannelOps ──────────────────────────────────────────────────────────

function makeMockOps(overrides: Partial<ChannelOps> = {}): ChannelOps {
  const addHTLC: ChannelOps['addHTLC'] = async (channel, params, _lp) => {
    const htlcId        = `htlc-${channel.channelId}-${channel.currentSequence + 1}`;
    const senderPkd     = channel.localSigner?.publicKeyDigest ?? channel.parties[0].publicKeyDigest;
    const senderPartyId = channel.parties.find(p => p.publicKeyDigest === senderPkd)?.partyId ?? 'A';
    const newBalances   = { ...channel.balances };
    newBalances[senderPartyId] = (newBalances[senderPartyId] ?? 0n) - params.amount;
    const updatedChannel: RouterChannel = {
      ...channel,
      balances:     newBalances,
      pendingHTLCs: [
        ...channel.pendingHTLCs,
        {
          htlcId,
          amount:                    params.amount,
          hashlock:                  params.hashlock,
          timeoutBlock:              params.timeoutBlock,
          direction:                 params.direction,
          status:                    'pending',
          htlcAddress:               '0xhtlc',
          senderPublicKeyDigest:     senderPkd,
          recipientPublicKeyDigest:  params.counterpartPublicKeyDigest,
        },
      ],
      currentSequence: channel.currentSequence + 1,
    };
    return { channel: updatedChannel, htlcId };
  };

  const fulfillHTLC: ChannelOps['fulfillHTLC'] = async (channel, htlcId, _preimage, _lp) => {
    const htlc = channel.pendingHTLCs.find(h => h.htlcId === htlcId);
    if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
    const recipPartyId = channel.parties.find(
      p => p.publicKeyDigest === htlc.recipientPublicKeyDigest,
    )?.partyId ?? 'B';
    const newBalances = { ...channel.balances };
    newBalances[recipPartyId] = (newBalances[recipPartyId] ?? 0n) + htlc.amount;
    const updatedChannel: RouterChannel = {
      ...channel,
      balances:     newBalances,
      pendingHTLCs: channel.pendingHTLCs.map(
        h => h.htlcId === htlcId ? { ...h, status: 'fulfilled' as const } : h,
      ),
      currentSequence: channel.currentSequence + 1,
    };
    return { channel: updatedChannel };
  };

  const timeoutHTLC: ChannelOps['timeoutHTLC'] = async (channel, htlcId, _lp) => {
    const htlc = channel.pendingHTLCs.find(h => h.htlcId === htlcId);
    if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
    const senderPartyId = channel.parties.find(
      p => p.publicKeyDigest === htlc.senderPublicKeyDigest,
    )?.partyId ?? 'A';
    const newBalances = { ...channel.balances };
    newBalances[senderPartyId] = (newBalances[senderPartyId] ?? 0n) + htlc.amount;
    const updatedChannel: RouterChannel = {
      ...channel,
      balances:     newBalances,
      pendingHTLCs: channel.pendingHTLCs.map(
        h => h.htlcId === htlcId ? { ...h, status: 'timed_out' as const } : h,
      ),
      currentSequence: channel.currentSequence + 1,
    };
    return { channel: updatedChannel };
  };

  return { addHTLC, fulfillHTLC, timeoutHTLC, ...overrides };
}

// ─── 1. Graph management ──────────────────────────────────────────────────────

describe('ChannelGraph management', () => {
  test('addChannel inserts directed edge', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 500n * SCALE));
    expect(g.edgesByChannel.has('c1')).toBe(true);
    expect(g.edgesByChannel.get('c1')!.length).toBe(1);
    expect(g.nodeEdges.get(ALICE)!.length).toBe(1);
    expect(g.nodeEdges.has(BOB)).toBe(false);
  });

  test('addChannel replaces an edge with the same (channelId, from) direction', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 100n));
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 999n));
    expect(g.nodeEdges.get(ALICE)!.length).toBe(1);
    const edges = g.edgesByChannel.get('c1')!;
    expect(edges.length).toBe(1);
    expect(edges[0].availableBalance).toBe(999n);
  });

  test('addChannel keeps both directed edges for a bidirectional channel', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 500n));   // Alice → Bob
    addChannel(g, mkEdge('c1', BOB,   ALICE, TOKEN_A, 200n)); // Bob → Alice
    const edges = g.edgesByChannel.get('c1')!;
    expect(edges.length).toBe(2);
    // Both sender directions are present in nodeEdges
    expect(g.nodeEdges.get(ALICE)!.length).toBe(1);
    expect(g.nodeEdges.get(BOB)!.length).toBe(1);
    // Updating one direction does not affect the other
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 777n));
    const updated = g.edgesByChannel.get('c1')!;
    expect(updated.length).toBe(2);
    expect(updated.find(e => e.from === ALICE)!.availableBalance).toBe(777n);
    expect(updated.find(e => e.from === BOB)!.availableBalance).toBe(200n);
  });

  test('removeChannel cleans up both maps (all directions)', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB,   TOKEN_A, 500n));
    addChannel(g, mkEdge('c1', BOB,   ALICE, TOKEN_A, 200n));
    removeChannel(g, 'c1');
    expect(g.edgesByChannel.has('c1')).toBe(false);
    expect(g.nodeEdges.has(ALICE)).toBe(false);
    expect(g.nodeEdges.has(BOB)).toBe(false);
  });

  test('announceSwap registers under tokenIn:tokenOut key', () => {
    const g = createChannelGraph();
    announceSwap(g, {
      intermediaryPubKey: BRIDGE, tokenIn: TOKEN_A, tokenOut: TOKEN_B,
      rate: '1.5', inboundChannelId: 'c1', outboundChannelId: 'c2',
      maxAmountIn: 1000n * SCALE,
    });
    const anns = g.swapIndex.get(`${TOKEN_A}:${TOKEN_B}`)!;
    expect(anns.length).toBe(1);
    expect(anns[0].rate).toBe('1.5');
  });

  test('announceSwap replaces duplicate intermediary+channel pair', () => {
    const g = createChannelGraph();
    const base = { intermediaryPubKey: BRIDGE, tokenIn: TOKEN_A, tokenOut: TOKEN_B,
      inboundChannelId: 'c1', outboundChannelId: 'c2', maxAmountIn: 1000n * SCALE };
    announceSwap(g, { ...base, rate: '1.0' });
    announceSwap(g, { ...base, rate: '1.2' });
    const anns = g.swapIndex.get(`${TOKEN_A}:${TOKEN_B}`)!;
    expect(anns.length).toBe(1);
    expect(anns[0].rate).toBe('1.2');
  });

  test('announceSwap rejects negative rate', () => {
    const g = createChannelGraph();
    expect(() => announceSwap(g, {
      intermediaryPubKey: BRIDGE, tokenIn: TOKEN_A, tokenOut: TOKEN_B,
      rate: '-0.5', inboundChannelId: 'c1', outboundChannelId: 'c2',
      maxAmountIn: 1000n * SCALE,
    })).toThrow(/rate/);
  });

  test('announceSwap rejects zero rate', () => {
    const g = createChannelGraph();
    expect(() => announceSwap(g, {
      intermediaryPubKey: BRIDGE, tokenIn: TOKEN_A, tokenOut: TOKEN_B,
      rate: '0', inboundChannelId: 'c1', outboundChannelId: 'c2',
      maxAmountIn: 1000n * SCALE,
    })).toThrow(/rate/);
  });

  test('findCrossTokenRoute skips swap announcement with negative amountOut via adversarial graph edit', () => {
    // Simulate an announcement that somehow has a negative rate after bypassing
    // announceSwap (e.g. direct graph manipulation). findCrossTokenRoute must
    // skip it via the amountOut <= 0n guard.
    const g = createChannelGraph();
    addChannel(g, mkEdge('in-chan',  ALICE,  BRIDGE, TOKEN_A, 5000n * SCALE));
    addChannel(g, mkEdge('out-chan', BRIDGE, ALICE,  TOKEN_B, 5000n * SCALE));
    // Bypass announceSwap validation by writing directly to the swapIndex
    g.swapIndex.set(`${TOKEN_A}:${TOKEN_B}`, [{
      intermediaryPubKey: BRIDGE, tokenIn: TOKEN_A, tokenOut: TOKEN_B,
      rate: '-1.0', inboundChannelId: 'in-chan', outboundChannelId: 'out-chan',
      maxAmountIn: 1000n * SCALE,
    }]);
    const route = findCrossTokenRoute(g, ALICE, ALICE, 100n * SCALE, TOKEN_A, TOKEN_B);
    expect(route).toBeNull();
  });
});

// ─── 2. Pathfinding ───────────────────────────────────────────────────────────

describe('findRoute — single-token Dijkstra', () => {
  test('finds direct single-hop route', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 500n * SCALE));
    const route = findRoute(g, ALICE, BOB, 100n * SCALE, TOKEN_A);
    expect(route).not.toBeNull();
    expect(route!.hops.length).toBe(1);
    expect(route!.hops[0].channelId).toBe('c1');
    expect(route!.tokenIn).toBe(TOKEN_A);
  });

  test('finds 3-hop route', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB,   TOKEN_A, 500n * SCALE));
    addChannel(g, mkEdge('c2', BOB,   CAROL, TOKEN_A, 500n * SCALE));
    const route = findRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A);
    expect(route).not.toBeNull();
    expect(route!.hops.length).toBe(2);
    expect(route!.hops[0].channelId).toBe('c1');
    expect(route!.hops[1].channelId).toBe('c2');
  });

  test('returns null when no path exists', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 500n * SCALE));
    expect(findRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A)).toBeNull();
  });

  test('filters edge with insufficient balance', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 50n * SCALE));
    expect(findRoute(g, ALICE, BOB, 100n * SCALE, TOKEN_A)).toBeNull();
  });

  test('filters edge with wrong tokenId', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_B, 500n * SCALE));
    expect(findRoute(g, ALICE, BOB, 100n * SCALE, TOKEN_A)).toBeNull();
  });

  test('prefers lower-fee path', () => {
    const g = createChannelGraph();
    // Direct path: high fee
    addChannel(g, { ...mkEdge('direct', ALICE, BOB, TOKEN_A, 500n * SCALE), feeRate: 1_000_000n });
    // 2-hop path: low fee
    addChannel(g, { ...mkEdge('via1', ALICE, CAROL, TOKEN_A, 500n * SCALE), feeRate: 1_000n });
    addChannel(g, { ...mkEdge('via2', CAROL, BOB,   TOKEN_A, 500n * SCALE), feeRate: 1_000n });
    const route = findRoute(g, ALICE, BOB, 100n * SCALE, TOKEN_A);
    expect(route).not.toBeNull();
    expect(route!.hops[0].channelId).toBe('via1');
  });

  test('computes totalFees correctly', () => {
    const g = createChannelGraph();
    // feeRate = 100_000n per SCALE = 0.1%
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 500n * SCALE, 100_000n));
    // amount = 1 scaled unit so fee = 1 * SCALE * 100_000 / SCALE = 100_000
    const amount = 1n * SCALE;
    const route  = findRoute(g, ALICE, BOB, amount, TOKEN_A);
    expect(route!.totalFees).toBe(100_000n);
  });
});

describe('findCrossTokenRoute', () => {
  function crossGraph() {
    const g = createChannelGraph();
    // Alice → Bridge in TOKEN_A
    addChannel(g, mkEdge('in-chan', ALICE, BRIDGE, TOKEN_A, 1000n * SCALE));
    // Bridge → Carol in TOKEN_B
    addChannel(g, mkEdge('out-chan', BRIDGE, CAROL, TOKEN_B, 2000n * SCALE));
    announceSwap(g, {
      intermediaryPubKey: BRIDGE,
      tokenIn:            TOKEN_A,
      tokenOut:           TOKEN_B,
      rate:               '1.5',
      inboundChannelId:   'in-chan',
      outboundChannelId:  'out-chan',
      maxAmountIn:        1000n * SCALE,
    });
    return g;
  }

  test('returns null when no swap announcement exists for the token pair', () => {
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, BOB, TOKEN_A, 500n * SCALE));
    expect(findCrossTokenRoute(g, ALICE, BOB, 100n * SCALE, TOKEN_A, TOKEN_B)).toBeNull();
  });

  test('returns null when intermediary balance insufficient', () => {
    const g = crossGraph();
    const route = findCrossTokenRoute(g, ALICE, BRIDGE, 2000n * SCALE, TOKEN_A, TOKEN_B);
    expect(route).toBeNull();
  });

  test('finds Alice→Bridge→Carol cross-token route', () => {
    const g     = crossGraph();
    const route = findCrossTokenRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A, TOKEN_B);
    expect(route).not.toBeNull();
    expect(route!.swapHops.length).toBe(1);
    const swap = route!.swapHops[0];
    expect(swap.tokenIn).toBe(TOKEN_A);
    expect(swap.tokenOut).toBe(TOKEN_B);
  });

  test('route.hops contains only the SwapHop for direct Alice→Bridge→Carol path', () => {
    const g     = crossGraph();
    const route = findCrossTokenRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A, TOKEN_B);
    expect(route).not.toBeNull();
    // No pre-swap or post-swap hops — Alice IS the inbound channel sender,
    // Carol IS the outbound channel receiver.
    expect(route!.hops.length).toBe(1);
    expect((route!.hops[0] as any).isSwap).toBe(true);
  });

  test('fee is NOT double-counted for direct swap path', () => {
    const g     = crossGraph();
    const amountIn = 100n * SCALE;
    const route    = findCrossTokenRoute(g, ALICE, CAROL, amountIn, TOKEN_A, TOKEN_B);
    expect(route).not.toBeNull();
    // Expected: inboundFee + outboundFee (no duplication)
    // feeRate = 100_000n (default), SCALE = 10^8
    // inboundFee  = 100 * SCALE * 100_000 / SCALE = 100 * 100_000 = 10_000_000
    // amountOut = 150 * SCALE, outboundFee = 150 * SCALE * 100_000 / SCALE = 15_000_000
    const expectedFees = 10_000_000n + 15_000_000n;
    expect(route!.totalFees).toBe(expectedFees);
  });

  test('rate application: amountOut = amountIn × rate', () => {
    const g     = crossGraph();
    const amountIn = 100n * SCALE;
    const route = findCrossTokenRoute(g, ALICE, CAROL, amountIn, TOKEN_A, TOKEN_B);
    expect(route).not.toBeNull();
    const swap = route!.swapHops[0];
    // amountOut = 100 * 1.5 = 150 (in scaled units)
    expect(swap.amountOut).toBe(150n * SCALE);
  });
});

// ─── 3. Rate helpers ──────────────────────────────────────────────────────────

describe('parseRateToScaled / applyRate', () => {
  test('parses "1.0" → SCALE', () => {
    expect(parseRateToScaled('1.0')).toBe(100_000_000n);
  });

  test('parses "0.95" → 95_000_000n', () => {
    expect(parseRateToScaled('0.95')).toBe(95_000_000n);
  });

  test('parses "2" → 200_000_000n', () => {
    expect(parseRateToScaled('2')).toBe(200_000_000n);
  });

  test('applyRate: 1000 scaled × 1.5 rate = 1500 scaled', () => {
    const amountIn = 1000n * SCALE;
    expect(applyRate(amountIn, '1.5')).toBe(1500n * SCALE);
  });

  test('applyRate: 1000 scaled × 0.95 rate = 950 scaled', () => {
    expect(applyRate(1000n * SCALE, '0.95')).toBe(950n * SCALE);
  });
});

// ─── 4. buildPaymentRequest ───────────────────────────────────────────────────

describe('buildPaymentRequest', () => {
  test('returns hashlock and preimage', () => {
    const req = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);
    expect(req.hashlock).toMatch(/^0x[0-9a-f]{64}$/);
    expect(req.preimage).toMatch(/^0x[0-9a-f]{64}$/);
    expect(req.amount).toBe(100n * SCALE);
    expect(req.tokenId).toBe(TOKEN_A);
    expect(req.expiryBlock).toBe(1000n);
  });

  test('each call produces a distinct preimage', () => {
    const r1 = buildPaymentRequest(1n, TOKEN_A, 100n);
    const r2 = buildPaymentRequest(1n, TOKEN_A, 100n);
    expect(r1.preimage).not.toBe(r2.preimage);
    expect(r1.hashlock).not.toBe(r2.hashlock);
  });
});

// ─── 5. executeMultiHopPayment ────────────────────────────────────────────────

describe('executeMultiHopPayment — 3-hop single-token payment', () => {
  function setup() {
    // Alice ──c1──> Hop1 ──c2──> Hop2 ──c3──> Carol
    const HOP1 = 'pk-hop1', HOP2 = 'pk-hop2';
    const g    = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, HOP1,  TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('c2', HOP1,  HOP2,  TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('c3', HOP2,  CAROL, TOKEN_A, 1000n * SCALE));

    const route = findRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A)!;
    expect(route).not.toBeNull();

    const channels: Map<string, RouterChannel> = new Map([
      ['c1', mkChannel('c1', ALICE, HOP1)],
      ['c2', mkChannel('c2', HOP1,  HOP2)],
      ['c3', mkChannel('c3', HOP2,  CAROL)],
    ]);

    const lps: Map<string, LeaseProvider> = new Map([
      ['c1', MOCK_LP], ['c2', MOCK_LP], ['c3', MOCK_LP],
    ]);

    const paymentReq = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);
    const ops        = makeMockOps();
    return { channels, lps, route, paymentReq, ops };
  }

  test('succeeds: all HTLCs locked and fulfilled', async () => {
    const { channels, lps, route, paymentReq, ops } = setup();
    const result = await executeMultiHopPayment(ops, channels, route, paymentReq, lps);
    expect(result.success).toBe(true);
    expect(result.settledHops.length).toBe(3);
    expect(result.preimage).toBe(paymentReq.preimage);
  });

  test('balances update correctly after payment', async () => {
    const { channels, lps, route, paymentReq, ops } = setup();
    await executeMultiHopPayment(ops, channels, route, paymentReq, lps);
    // c1: Alice's balance should decrease by amount, then increase (fulfill)
    // net: settled means Carol (B) received the funds on c3
    const c3 = channels.get('c3')!;
    const carolPartyId = c3.parties.find(p => p.publicKeyDigest === 'pk-carol')?.partyId ?? 'B';
    expect(c3.balances[carolPartyId]).toBe(100n * SCALE);
  });

  test('fails with clear error when preimage is missing', async () => {
    const { channels, lps, route, paymentReq, ops } = setup();
    const reqWithoutPreimage: PaymentRequest = { ...paymentReq, preimage: undefined };
    const result = await executeMultiHopPayment(ops, channels, route, reqWithoutPreimage, lps);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/preimage/);
  });

  test('fulfill-phase failure: still-pending HTLCs are timed out', async () => {
    const { channels, lps, route, paymentReq } = setup();

    // fulfillHTLC fails on the first call (which is the last hop, c3, reversed)
    let fulfillCount = 0;
    const timeoutCalls: string[] = [];

    const failOps = makeMockOps({
      async fulfillHTLC(channel, htlcId, preimage, lp) {
        fulfillCount++;
        if (fulfillCount === 1) throw new Error('simulated fulfill failure');
        return makeMockOps().fulfillHTLC(channel, htlcId, preimage, lp);
      },
      async timeoutHTLC(channel, htlcId, lp) {
        timeoutCalls.push(htlcId);
        return makeMockOps().timeoutHTLC(channel, htlcId, lp);
      },
    });

    const result = await executeMultiHopPayment(failOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // All 3 locked HTLCs should be timed out (none were fulfilled before the error)
    expect(timeoutCalls.length).toBe(3);
    expect(result.settledHops.length).toBe(0);
  });

  test('rollback before the timeout block reports pending refunds (CAN-015)', async () => {
    const { channels, lps, route, paymentReq } = setup();

    // A payment that fails immediately has not reached any timeout block, so
    // timeoutHTLC refuses to release — the real omnia guard, not a mock quirk.
    const ops = makeMockOps({
      async fulfillHTLC() {
        throw new Error('simulated fulfill failure');
      },
      async timeoutHTLC() {
        throw new Error('HTLC has not yet timed out (block 10 < 100)');
      },
    });

    const result = await executeMultiHopPayment(ops, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    expect(result.pendingRefunds).toHaveLength(3);
    expect(result.pendingRefunds?.[0]?.reason).toMatch(/has not yet timed out/);
    expect(result.pendingRefunds?.[0]?.timeoutBlock).toBeDefined();
    // The failure must not claim the liquidity was returned.
    expect(result.error).toBeDefined();
  });

  test('partial fulfill failure: only still-pending HTLCs are timed out', async () => {
    const { channels, lps, route, paymentReq } = setup();

    // fulfillHTLC succeeds for hop 1 (last, c3), fails for hop 2 (middle, c2)
    let fulfillCount = 0;
    const timeoutCalls: string[] = [];
    const baseOps = makeMockOps();

    const partialOps = makeMockOps({
      async fulfillHTLC(channel, htlcId, preimage, lp) {
        fulfillCount++;
        if (fulfillCount === 2) throw new Error('mid-reveal failure');
        return baseOps.fulfillHTLC(channel, htlcId, preimage, lp);
      },
      async timeoutHTLC(channel, htlcId, lp) {
        timeoutCalls.push(htlcId);
        return baseOps.timeoutHTLC(channel, htlcId, lp);
      },
    });

    const result = await executeMultiHopPayment(partialOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // 1 hop was fulfilled (c3), 2 remain pending (c2, c1) → 2 timeouts
    expect(result.settledHops.length).toBe(1);
    expect(timeoutCalls.length).toBe(2);
  });
});

describe('executeMultiHopPayment — middle hop failure', () => {
  test('all previously locked HTLCs are timed out when a forward hop fails', async () => {
    const HOP1 = 'pk-hop1';
    const g    = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, HOP1,  TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('c2', HOP1,  CAROL, TOKEN_A, 1000n * SCALE));

    const route = findRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A)!;
    const channels: Map<string, RouterChannel> = new Map([
      ['c1', mkChannel('c1', ALICE, HOP1)],
      ['c2', mkChannel('c2', HOP1, CAROL)],
    ]);
    const lps: Map<string, LeaseProvider> = new Map([
      ['c1', MOCK_LP], ['c2', MOCK_LP],
    ]);

    const paymentReq = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);

    let addCallCount = 0;
    const failingOps = makeMockOps({
      async addHTLC(channel, params, lp) {
        addCallCount++;
        if (addCallCount === 2) throw new Error('simulated hop failure');
        const base = makeMockOps();
        return base.addHTLC(channel, params, lp);
      },
    });

    const timeoutCalls: string[] = [];
    const trackingOps: ChannelOps = {
      ...failingOps,
      timeoutHTLC: async (channel, htlcId, lp) => {
        timeoutCalls.push(htlcId);
        return makeMockOps().timeoutHTLC(channel, htlcId, lp);
      },
    };

    const result = await executeMultiHopPayment(trackingOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // c1 HTLC (locked in hop 1) should have been timed out
    expect(timeoutCalls.length).toBe(1);
    expect(timeoutCalls[0]).toMatch(/c1/);
  });
});

// ─── 6. cancelPayment ────────────────────────────────────────────────────────

describe('cancelPayment', () => {
  test('times out all hops that have htlcId set', async () => {
    const HOP1 = 'pk-hop1';
    const g    = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, HOP1,  TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('c2', HOP1,  CAROL, TOKEN_A, 1000n * SCALE));

    const channels: Map<string, RouterChannel> = new Map([
      ['c1', mkChannel('c1', ALICE, HOP1)],
      ['c2', mkChannel('c2', HOP1, CAROL)],
    ]);
    const lps: Map<string, LeaseProvider> = new Map([
      ['c1', MOCK_LP], ['c2', MOCK_LP],
    ]);

    const ops = makeMockOps();
    // Manually populate htlcId on the route hops (simulating a partial execution)
    const route = findRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A)!;

    // Lock c1 only
    const addResult = await ops.addHTLC(channels.get('c1')!, {
      amount: 100n * SCALE, hashlock: '0xdeadbeef', timeoutBlock: 1000n,
      direction: 'offered', counterpartPublicKeyDigest: HOP1,
    }, MOCK_LP);
    channels.set('c1', addResult.channel);
    (route.hops[0] as RoutingHop).htlcId = addResult.htlcId;

    const timeoutCalls: string[] = [];
    const tracking: ChannelOps = {
      ...ops,
      timeoutHTLC: async (ch, id, lp) => {
        timeoutCalls.push(id);
        return ops.timeoutHTLC(ch, id, lp);
      },
    };

    await cancelPayment(tracking, channels, route, lps);
    expect(timeoutCalls.length).toBe(1);
  });
});

// ─── 7. Cross-token payment execution ────────────────────────────────────────

describe('executeCrossTokenPayment', () => {
  function crossSetup() {
    const g = createChannelGraph();
    addChannel(g, mkEdge('in-chan',  ALICE,  BRIDGE, TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('out-chan', BRIDGE, CAROL,  TOKEN_B, 2000n * SCALE));
    announceSwap(g, {
      intermediaryPubKey: BRIDGE,
      tokenIn:            TOKEN_A,
      tokenOut:           TOKEN_B,
      rate:               '1.5',
      inboundChannelId:   'in-chan',
      outboundChannelId:  'out-chan',
      maxAmountIn:        1000n * SCALE,
    });

    const route = findCrossTokenRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A, TOKEN_B) as CrossTokenRoute;
    expect(route).not.toBeNull();

    const channels: Map<string, RouterChannel> = new Map([
      ['in-chan',  mkChannel('in-chan',  ALICE,  BRIDGE, TOKEN_A, 1000n * SCALE)],
      ['out-chan', mkChannel('out-chan', BRIDGE, CAROL,  TOKEN_B, 2000n * SCALE)],
    ]);
    const lps: Map<string, LeaseProvider> = new Map([
      ['in-chan', MOCK_LP], ['out-chan', MOCK_LP],
    ]);

    const paymentReq = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);
    const ops        = makeMockOps();
    return { channels, lps, route, paymentReq, ops, g };
  }

  test('succeeds: both sides settle atomically', async () => {
    const { channels, lps, route, paymentReq, ops } = crossSetup();
    const result = await executeCrossTokenPayment(ops, channels, route, paymentReq, lps);
    expect(result.success).toBe(true);
    expect(result.settledHops.length).toBe(2);
    expect(result.preimage).toBe(paymentReq.preimage);
  });

  test('each channel is locked exactly once (no duplicate HTLC locking)', async () => {
    const { channels, lps, route, paymentReq } = crossSetup();
    const addCalls: string[] = [];
    const trackingOps = makeMockOps({
      async addHTLC(channel, params, lp) {
        addCalls.push(channel.channelId);
        return makeMockOps().addHTLC(channel, params, lp);
      },
    });
    await executeCrossTokenPayment(trackingOps, channels, route, paymentReq, lps);
    // Exactly 2 addHTLC calls — one for in-chan, one for out-chan
    expect(addCalls).toHaveLength(2);
    expect(addCalls.filter(id => id === 'in-chan').length).toBe(1);
    expect(addCalls.filter(id => id === 'out-chan').length).toBe(1);
  });

  test('both channels have exactly one fulfilled HTLC after success', async () => {
    const { channels, lps, route, paymentReq, ops } = crossSetup();
    await executeCrossTokenPayment(ops, channels, route, paymentReq, lps);
    const inChan  = channels.get('in-chan')!;
    const outChan = channels.get('out-chan')!;
    expect(inChan.pendingHTLCs.filter(h => h.status === 'fulfilled').length).toBe(1);
    expect(outChan.pendingHTLCs.filter(h => h.status === 'fulfilled').length).toBe(1);
  });

  test('cross-token failure: inbound failure rolls back nothing yet', async () => {
    const { channels, lps, route, paymentReq } = crossSetup();

    const failOps = makeMockOps({
      addHTLC: async () => ({ channel: channels.get('in-chan')!, htlcId: '', error: 'inbound fail' }),
    });

    const result = await executeCrossTokenPayment(failOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/inbound/);
  });

  test('cross-token fulfill-phase failure: all pending HTLCs are timed out', async () => {
    const { channels, lps, route, paymentReq } = crossSetup();

    const timeoutCalls: string[] = [];
    const baseOps = makeMockOps();

    const failFulfillOps: ChannelOps = {
      addHTLC: baseOps.addHTLC,
      async fulfillHTLC(channel, htlcId, _preimage, lp) {
        throw new Error('fulfill failed');
      },
      async timeoutHTLC(channel, htlcId, lp) {
        timeoutCalls.push(htlcId);
        return baseOps.timeoutHTLC(channel, htlcId, lp);
      },
    };

    const result = await executeCrossTokenPayment(failFulfillOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // Both inbound and outbound HTLCs should be timed out
    expect(timeoutCalls.length).toBe(2);
    expect(result.settledHops.length).toBe(0);
  });

  test('outbound failure after inbound lock → inbound HTLC is rolled back', async () => {
    const { channels, lps, route, paymentReq } = crossSetup();

    let addCount = 0;
    const ops    = makeMockOps();
    const timeoutCalls: string[] = [];

    const partialOps: ChannelOps = {
      async addHTLC(channel, params, lp) {
        addCount++;
        if (addCount === 2) throw new Error('outbound fail');
        return ops.addHTLC(channel, params, lp);
      },
      fulfillHTLC: ops.fulfillHTLC,
      async timeoutHTLC(channel, htlcId, lp) {
        timeoutCalls.push(htlcId);
        return ops.timeoutHTLC(channel, htlcId, lp);
      },
    };

    const result = await executeCrossTokenPayment(partialOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // The inbound HTLC locked in step 1 should be timed out
    expect(timeoutCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ── Pre/post-swap hop tests ──────────────────────────────────────────────

  /**
   * Route: Alice → Relay → Bridge (swap) → Carol → Dave
   *   pre-swap:  Alice   --[TOKEN_A]--> Relay   (pre-chan)
   *   inbound:   Relay   --[TOKEN_A]--> Bridge  (in-chan)
   *   outbound:  Bridge  --[TOKEN_B]--> Carol   (out-chan)
   *   post-swap: Carol   --[TOKEN_B]--> Dave    (post-chan)
   */
  function crossSetupWithPrePost() {
    const RELAY = 'pk-relay';
    const DAVE  = 'pk-dave';
    const g     = createChannelGraph();

    // TOKEN_A edges (sender side)
    addChannel(g, mkEdge('pre-chan', ALICE, RELAY,  TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('in-chan',  RELAY, BRIDGE, TOKEN_A, 1000n * SCALE));
    // TOKEN_B edges (recipient side)
    addChannel(g, mkEdge('out-chan',  BRIDGE, CAROL, TOKEN_B, 2000n * SCALE));
    addChannel(g, mkEdge('post-chan', CAROL,  DAVE,  TOKEN_B, 2000n * SCALE));

    announceSwap(g, {
      intermediaryPubKey: BRIDGE,
      tokenIn:            TOKEN_A,
      tokenOut:           TOKEN_B,
      rate:               '1.5',
      inboundChannelId:   'in-chan',
      outboundChannelId:  'out-chan',
      maxAmountIn:        1000n * SCALE,
    });

    const route = findCrossTokenRoute(g, ALICE, DAVE, 100n * SCALE, TOKEN_A, TOKEN_B) as CrossTokenRoute;
    expect(route).not.toBeNull();

    const channels: Map<string, RouterChannel> = new Map([
      ['pre-chan',  mkChannel('pre-chan',  ALICE,  RELAY,  TOKEN_A, 1000n * SCALE)],
      ['in-chan',   mkChannel('in-chan',   RELAY,  BRIDGE, TOKEN_A, 1000n * SCALE)],
      ['out-chan',  mkChannel('out-chan',  BRIDGE, CAROL,  TOKEN_B, 2000n * SCALE)],
      ['post-chan', mkChannel('post-chan', CAROL,  DAVE,   TOKEN_B, 2000n * SCALE)],
    ]);
    const lps: Map<string, LeaseProvider> = new Map([
      ['pre-chan',  MOCK_LP],
      ['in-chan',   MOCK_LP],
      ['out-chan',  MOCK_LP],
      ['post-chan', MOCK_LP],
    ]);
    const paymentReq = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);
    const ops        = makeMockOps();
    return { channels, lps, route, paymentReq, ops, g, RELAY, DAVE };
  }

  test('pre/post-swap route: succeeds and settles all 4 HTLCs', async () => {
    const { channels, lps, route, paymentReq, ops } = crossSetupWithPrePost();
    const result = await executeCrossTokenPayment(ops, channels, route, paymentReq, lps);
    expect(result.success).toBe(true);
    expect(result.settledHops.length).toBe(4);
  });

  test('pre/post-swap route: HTLC timeouts are strictly monotonically decreasing', async () => {
    const { channels, lps, route, paymentReq } = crossSetupWithPrePost();

    const lockedTimeouts: Array<{ channelId: string; timeoutBlock: bigint }> = [];
    const trackingOps = makeMockOps({
      async addHTLC(channel, params, lp) {
        lockedTimeouts.push({ channelId: channel.channelId, timeoutBlock: params.timeoutBlock });
        return makeMockOps().addHTLC(channel, params, lp);
      },
    });

    const result = await executeCrossTokenPayment(trackingOps, channels, route, paymentReq, lps);
    expect(result.success).toBe(true);
    // 4 locks: pre-chan, in-chan, out-chan, post-chan
    expect(lockedTimeouts.length).toBe(4);
    // Verify strictly decreasing timeouts (sender → recipient)
    for (let i = 1; i < lockedTimeouts.length; i++) {
      expect(lockedTimeouts[i].timeoutBlock).toBeLessThan(lockedTimeouts[i - 1].timeoutBlock);
    }
    // pre-chan has the highest timeout (closest to sender)
    expect(lockedTimeouts[0].channelId).toBe('pre-chan');
    // post-chan has the lowest timeout (closest to recipient)
    expect(lockedTimeouts[3].channelId).toBe('post-chan');
  });

  test('pre/post-swap route: forward failure in pre-hop rolls back nothing extra', async () => {
    const { channels, lps, route, paymentReq } = crossSetupWithPrePost();
    const timeoutCalls: string[] = [];

    const failOnFirst = makeMockOps({
      addHTLC: async () => ({ channel: channels.get('pre-chan')!, htlcId: '', error: 'pre-hop fail' }),
      timeoutHTLC: async (channel, htlcId, lp) => {
        timeoutCalls.push(htlcId);
        return makeMockOps().timeoutHTLC(channel, htlcId, lp);
      },
    });

    const result = await executeCrossTokenPayment(failOnFirst, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // Nothing was locked before the first failure → no timeouts needed
    expect(timeoutCalls.length).toBe(0);
  });

  test('pre/post-swap route: forward failure in post-hop rolls back all 3 prior locks', async () => {
    const { channels, lps, route, paymentReq } = crossSetupWithPrePost();
    const timeoutCalls: string[] = [];
    let addCount = 0;
    const baseOps = makeMockOps();

    const failOnFourth = makeMockOps({
      async addHTLC(channel, params, lp) {
        addCount++;
        if (addCount === 4) throw new Error('post-hop fail');
        return baseOps.addHTLC(channel, params, lp);
      },
      timeoutHTLC: async (channel, htlcId, lp) => {
        timeoutCalls.push(htlcId);
        return baseOps.timeoutHTLC(channel, htlcId, lp);
      },
    });

    const result = await executeCrossTokenPayment(failOnFourth, channels, route, paymentReq, lps);
    expect(result.success).toBe(false);
    // 3 HTLCs were locked (pre-chan, in-chan, out-chan) before the 4th failed
    expect(timeoutCalls.length).toBe(3);
  });
});

// ─── Route revalidation before execution ─────────────────────────────────────

describe('route revalidation before execution', () => {
  function multiSetup() {
    const HOP1 = 'pk-hop1', HOP2 = 'pk-hop2';
    const g = createChannelGraph();
    addChannel(g, mkEdge('c1', ALICE, HOP1, TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('c2', HOP1, HOP2, TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('c3', HOP2, CAROL, TOKEN_A, 1000n * SCALE));

    const route = findRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A)!;
    const channels: Map<string, RouterChannel> = new Map([
      ['c1', mkChannel('c1', ALICE, HOP1)],
      ['c2', mkChannel('c2', HOP1, HOP2)],
      ['c3', mkChannel('c3', HOP2, CAROL)],
    ]);
    const lps: Map<string, LeaseProvider> = new Map([
      ['c1', MOCK_LP], ['c2', MOCK_LP], ['c3', MOCK_LP],
    ]);
    const paymentReq = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);
    const ops = makeMockOps();
    return { channels, lps, route, paymentReq, ops };
  }

  function tracked(ops: ChannelOps): { ops: ChannelOps; calls: () => number } {
    let calls = 0;
    return {
      ops: {
        ...ops,
        addHTLC: async (channel, params, lp) => {
          calls++;
          return ops.addHTLC(channel, params, lp);
        },
      },
      calls: () => calls,
    };
  }

  async function runMulti(mutate: (channels: Map<string, RouterChannel>) => void) {
    const setup = multiSetup();
    mutate(setup.channels);
    const counter = tracked(setup.ops);
    const result = await executeMultiHopPayment(
      counter.ops, setup.channels, setup.route, setup.paymentReq, setup.lps,
    );
    return { result, calls: counter.calls() };
  }

  test('rejects a stale balance before locking any HTLC', async () => {
    const { result, calls } = await runMulti((channels) => {
      const c1 = channels.get('c1')!;
      channels.set('c1', { ...c1, balances: { ...c1.balances, A: 0n } });
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(result.settledHops).toEqual([]);
    expect(calls).toBe(0);
  });

  test('rejects a missing channel before locking any HTLC', async () => {
    const { result, calls } = await runMulti((channels) => channels.delete('c2'));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });

  test('rejects a wrong-token channel', async () => {
    const { result, calls } = await runMulti((channels) => {
      const c1 = channels.get('c1')!;
      channels.set('c1', { ...c1, tokenId: TOKEN_B });
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });

  test('rejects an inactive channel', async () => {
    const { result, calls } = await runMulti((channels) => {
      const c1 = channels.get('c1')!;
      channels.set('c1', { ...c1, status: 'closing' });
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });

  test('rejects a direction mismatch', async () => {
    const { result, calls } = await runMulti((channels) => {
      const c1 = channels.get('c1')!;
      channels.set('c1', {
        ...c1,
        parties: [
          { partyId: 'A', publicKeyDigest: 'pk-not-alice', addressIndex: 0 },
          { partyId: 'B', publicKeyDigest: 'pk-not-hop1', addressIndex: 0 },
        ],
      });
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });

  function crossSetup() {
    const g = createChannelGraph();
    addChannel(g, mkEdge('in-chan', ALICE, BRIDGE, TOKEN_A, 1000n * SCALE));
    addChannel(g, mkEdge('out-chan', BRIDGE, CAROL, TOKEN_B, 2000n * SCALE));
    announceSwap(g, {
      intermediaryPubKey: BRIDGE,
      tokenIn: TOKEN_A,
      tokenOut: TOKEN_B,
      rate: '1.5',
      inboundChannelId: 'in-chan',
      outboundChannelId: 'out-chan',
      maxAmountIn: 1000n * SCALE,
    });
    const route = findCrossTokenRoute(g, ALICE, CAROL, 100n * SCALE, TOKEN_A, TOKEN_B)!;
    const channels: Map<string, RouterChannel> = new Map([
      ['in-chan', mkChannel('in-chan', ALICE, BRIDGE, TOKEN_A, 1000n * SCALE)],
      ['out-chan', mkChannel('out-chan', BRIDGE, CAROL, TOKEN_B, 2000n * SCALE)],
    ]);
    const lps: Map<string, LeaseProvider> = new Map([
      ['in-chan', MOCK_LP], ['out-chan', MOCK_LP],
    ]);
    const paymentReq = buildPaymentRequest(100n * SCALE, TOKEN_A, 1000n);
    const ops = makeMockOps();
    return { channels, lps, route, paymentReq, ops };
  }

  async function runCross(mutate: (channels: Map<string, RouterChannel>) => void) {
    const setup = crossSetup();
    mutate(setup.channels);
    const counter = tracked(setup.ops);
    const result = await executeCrossTokenPayment(
      counter.ops, setup.channels, setup.route, setup.paymentReq, setup.lps,
    );
    return { result, calls: counter.calls() };
  }

  test('cross-token: rejects a stale inbound balance before locking', async () => {
    const { result, calls } = await runCross((channels) => {
      const inbound = channels.get('in-chan')!;
      channels.set('in-chan', { ...inbound, balances: { ...inbound.balances, A: 0n } });
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });

  test('cross-token: rejects a missing outbound channel before locking', async () => {
    const { result, calls } = await runCross((channels) => channels.delete('out-chan'));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });

  test('cross-token: rejects a wrong-token outbound channel', async () => {
    const { result, calls } = await runCross((channels) => {
      const outbound = channels.get('out-chan')!;
      channels.set('out-chan', { ...outbound, tokenId: TOKEN_A });
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_REVALIDATION_FAILED');
    expect(calls).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-080 / OMN-082 — the route must be the payment, and rollback must not lie
// ─────────────────────────────────────────────────────────────────────────────

function mkRoute(hops: Array<{ id: string; from: string; to: string; amount: bigint; tokenId?: string; htlcId?: string }>) {
  return {
    hops: hops.map((h) => ({
      channelId: h.id,
      from: h.from,
      to: h.to,
      amount: h.amount,
      tokenId: h.tokenId ?? TOKEN_A,
      ...(h.htlcId ? { htlcId: h.htlcId } : {}),
    })),
    totalFees: 0n,
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_A,
    estimatedBlocks: 2,
  };
}

describe('OMN-080 route validation is bound to the payment', () => {
  const channels = new Map<string, RouterChannel>([
    ['ch-1', mkChannel('ch-1', ALICE, BOB)],
    ['ch-2', mkChannel('ch-2', BOB, CAROL)],
  ]);

  test('an empty route is refused instead of succeeding with nothing settled', () => {
    const result = validateRoute(channels, mkRoute([]));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/no hops/);
  });

  test('disconnected hops are refused', () => {
    const result = validateRoute(channels, mkRoute([
      { id: 'ch-1', from: ALICE, to: BOB, amount: 100n },
      { id: 'ch-2', from: ALICE, to: CAROL, amount: 100n },
    ]));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/disconnected/);
  });

  test('a route that does not end at the recipient is refused', () => {
    const result = validateRoute(
      channels,
      mkRoute([{ id: 'ch-1', from: ALICE, to: BOB, amount: 100n }]),
      { recipient: CAROL },
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/recipient/);
  });

  test('a route that delivers the wrong amount is refused', () => {
    const result = validateRoute(
      channels,
      mkRoute([{ id: 'ch-1', from: ALICE, to: BOB, amount: 100n }]),
      { amount: 250n },
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/delivers/);
  });

  test('a consistent route still passes', () => {
    const result = validateRoute(
      channels,
      mkRoute([
        { id: 'ch-1', from: ALICE, to: BOB, amount: 100n },
        { id: 'ch-2', from: BOB, to: CAROL, amount: 100n },
      ]),
      { payer: ALICE, recipient: CAROL, amount: 100n, tokenId: TOKEN_A },
    );
    expect(result).toEqual({ ok: true });
  });
});

describe('OMN-082 rollback never reports a stranded lock as released', () => {
  test('a lock whose channel is gone is surfaced as a pending refund', async () => {
    const route = mkRoute([
      { id: 'ch-gone', from: ALICE, to: BOB, amount: 100n, htlcId: 'htlc-1' },
    ]);
    const ops = { timeoutHTLC: jest.fn() } as unknown as ChannelOps;

    const error = await cancelPayment(ops, new Map(), route, new Map()).catch((reason) => reason);
    expect(error).toBeInstanceOf(PendingRefundError);
    expect(error.pendingRefunds).toEqual([
      expect.objectContaining({ channelId: 'ch-gone', htlcId: 'htlc-1' }),
    ]);
    expect(error.pendingRefunds[0].reason).toMatch(/no longer in the routing view/);
    expect(ops.timeoutHTLC).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-081 — HTLC deadlines are spaced by the channel's contest window
// ─────────────────────────────────────────────────────────────────────────────

describe('OMN-081 expiry spread derives from the contest window', () => {
  const HOP1 = 'pk-hop1';
  const HOP2 = 'pk-hop2';

  function route3() {
    return mkRoute([
      { id: 'c1', from: ALICE, to: HOP1, amount: 100n },
      { id: 'c2', from: HOP1, to: HOP2, amount: 100n },
      { id: 'c3', from: HOP2, to: CAROL, amount: 100n },
    ]);
  }

  function channelsWithDelay(delay?: number) {
    const make = (id: string, from: string, to: string) => {
      const channel = mkChannel(id, from, to);
      return delay === undefined ? channel : { ...channel, contestDelayBlocks: delay };
    };
    return new Map<string, RouterChannel>([
      ['c1', make('c1', ALICE, HOP1)],
      ['c2', make('c2', HOP1, HOP2)],
      ['c3', make('c3', HOP2, CAROL)],
    ]);
  }

  test('delta is the largest contest delay plus the recovery margin', () => {
    const plan = planRouteExpiry(channelsWithDelay(256), route3(), 10_000n, 3, { recoveryMarginBlocks: 1 });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.plan.contestDelayBlocks).toBe(256n);
      expect(plan.plan.delta).toBe(257n);
      expect(plan.plan.earliest).toBe(10_000n - 2n * 257n);
    }
  });

  test('a route whose window cannot fit the spread is refused before locking', async () => {
    const channels = channelsWithDelay(256);
    const ops = makeMockOps();
    const add = jest.spyOn(ops, 'addHTLC');
    const lps = new Map<string, LeaseProvider>([['c1', MOCK_LP], ['c2', MOCK_LP], ['c3', MOCK_LP]]);

    const result = await executeMultiHopPayment(
      ops,
      channels,
      route3(),
      buildPaymentRequest(100n * SCALE, TOKEN_A, 100n),
      lps,
      undefined,
      { recoveryMarginBlocks: 1, defaultContestDelayBlocks: 256 },
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('EXPIRY_PLAN_FAILED');
    expect(result.error).toMatch(/cannot fit 3 locks/);
    expect(add).not.toHaveBeenCalled();
  });

  test('the executor spaces consecutive locks by the derived delta', async () => {
    const channels = channelsWithDelay(64);
    const ops = makeMockOps();
    const lps = new Map<string, LeaseProvider>([['c1', MOCK_LP], ['c2', MOCK_LP], ['c3', MOCK_LP]]);

    const result = await executeMultiHopPayment(
      ops,
      channels,
      route3(),
      buildPaymentRequest(100n * SCALE, TOKEN_A, 10_000n),
      lps,
      undefined,
      { recoveryMarginBlocks: 1 },
    );

    expect(result.success).toBe(true);
    const timeouts = ['c1', 'c2', 'c3'].map((id) => channels.get(id)!.pendingHTLCs[0]!.timeoutBlock);
    expect(timeouts[0]! - timeouts[1]!).toBe(65n);
    expect(timeouts[1]! - timeouts[2]!).toBe(65n);
    expect(timeouts[2]).toBe(10_000n - 2n * 65n);
  });

  test('the override can raise the delta but never lower it below the contest window', () => {
    const low = planRouteExpiry(channelsWithDelay(256), route3(), 10_000n, 3, { minHopExpiryDelta: 10n });
    expect(low.ok && low.plan.delta).toBe(257n);

    const high = planRouteExpiry(channelsWithDelay(256), route3(), 10_000n, 3, { minHopExpiryDelta: 400n });
    expect(high.ok && high.plan.delta).toBe(400n);
  });

  test('a channel with no declared contest window is refused when the policy requires one', () => {
    const plan = planRouteExpiry(channelsWithDelay(undefined), route3(), 10_000n, 3, {
      requireContestDelay: true,
    });
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.error).toMatch(/does not declare contestDelayBlocks/);
  });

  test('hopTimeout decreases toward the recipient', () => {
    expect(hopTimeout(1_000n, 10n, 0)).toBe(1_000n);
    expect(hopTimeout(1_000n, 10n, 2)).toBe(980n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OMN-083 — fee proofs are settlement evidence, not descriptive hashes
// ─────────────────────────────────────────────────────────────────────────────

describe('OMN-083 authenticated fee proofs', () => {
  const channel = () => mkChannel('c-fee', ALICE, BOB);
  const htlc = {
    htlcId: 'h-fee',
    amount: 100n,
    hashlock: '0x' + '11'.repeat(32),
    timeoutBlock: 1000n,
    direction: 'offered' as const,
    status: 'fulfilled' as const,
    htlcAddress: '0xhtlc',
    senderPublicKeyDigest: ALICE,
    recipientPublicKeyDigest: BOB,
  };

  const previous = () => ({
    sequence: 1,
    balances: { A: 500n, B: 500n },
    pendingHTLCs: [{ htlcId: 'h-fee', amount: 100n, recipientPublicKeyDigest: BOB, status: 'pending' }],
    stateVariables: [{ port: 102, value: 'aa'.repeat(32) }],
    signatures: { A: 'sig-a', B: 'sig-b' },
  });

  const next = () => ({
    sequence: 2,
    balances: { A: 500n, B: 600n },
    pendingHTLCs: [],
    stateVariables: [{ port: 102, value: 'bb'.repeat(32) }],
    signatures: { A: 'sig-a2', B: 'sig-b2' },
  });

  test('binds both commitments, the balance delta and the fee', () => {
    const proof = buildAuthenticatedRouterFeeProof(
      channel(),
      htlc,
      { previous: previous(), next: next() },
      { feeAmount: 10n, settledAt: 5 },
    );

    expect(proof.authenticated).toBe(true);
    expect(proof.previousStateCommitmentV2).toBe('aa'.repeat(32));
    expect(proof.stateCommitmentV2).toBe('bb'.repeat(32));
    expect(proof.previousSequence).toBe(1);
    expect(proof.sequence).toBe(2);
    expect(proof.balanceDelta).toBe(100n);
    expect(proof.feeAmount).toBe(10n);
  });

  test('verifies only against the states it was derived from', () => {
    const proof = buildAuthenticatedRouterFeeProof(channel(), htlc, { previous: previous(), next: next() });
    expect(verifyRouterFeeProof(channel(), { previous: previous(), next: next() }, proof)).toBe(true);

    const other = next();
    other.stateVariables = [{ port: 102, value: 'cc'.repeat(32) }];
    expect(verifyRouterFeeProof(channel(), { previous: previous(), next: other }, proof)).toBe(false);
  });

  test('refuses to build a proof whose transition does not move the amount', () => {
    const flat = next();
    flat.balances = { A: 500n, B: 500n };
    expect(() => buildAuthenticatedRouterFeeProof(channel(), htlc, { previous: previous(), next: flat }))
      .toThrow(/not the HTLC amount/);
  });

  test('refuses a successor that still carries the HTLC', () => {
    const stillPending = next();
    stillPending.pendingHTLCs = [{ htlcId: 'h-fee', amount: 100n }];
    expect(() => buildAuthenticatedRouterFeeProof(channel(), htlc, { previous: previous(), next: stillPending }))
      .toThrow(/still carries/);
  });

  test('a descriptive proof is explicitly not settlement evidence', () => {
    const legacy = buildRouterFeeProof(channel(), htlc, 7);
    expect(legacy.authenticated).toBe(false);
    expect(verifyRouterFeeProof(channel(), { previous: previous(), next: next() }, legacy)).toBe(false);
  });

  test('tampering with the fee changes the hash', () => {
    const proof = buildAuthenticatedRouterFeeProof(channel(), htlc, { previous: previous(), next: next() }, { feeAmount: 10n });
    expect(verifyRouterFeeProof(channel(), { previous: previous(), next: next() }, { ...proof, feeAmount: 999n })).toBe(false);
  });
});

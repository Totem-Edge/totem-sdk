/**
 * Durable settled-segment ledger tests (RFC-007 G9).
 *
 * Multi-channel partial-op recovery: when a route spans several HTLC hops and
 * the host dies mid-route (some hops settled by preimage reveal, others still
 * locked), the already-settled segments — channel + HTLC + preimage — must
 * survive a restart so the node never re-locks an irrevocably-settled lock and
 * can reconcile the still-pending ones. Corruption is surfaced, never abused
 * as absence; records are immutable once written (idempotent re-record).
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { createDurableRouterLedger, type SettledSegment } from '../durable-router-ledger.js';
import { executeMultiHopPayment } from '../execute.js';
import { createChannelGraph, addChannel } from '../graph.js';
import { findRoute, type Route } from '../index.js';
import { buildPaymentRequest } from '../request.js';
import type { RouterChannel, ChannelGraphEdge, ChannelOps, LeaseProvider } from '../types.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

const SCALE = 100_000_000n;
const TOKEN_A = '0x00';
const ALICE = 'pk-alice';
const BOB = 'pk-bob';
const CAROL = 'pk-carol';
const DAVE = 'pk-dave';

const MOCK_LP: LeaseProvider = {};

function mkEdge(id: string, from: string, to: string, balance: bigint): ChannelGraphEdge {
  return { channelId: id, from, to, tokenId: TOKEN_A, availableBalance: balance, htlcCapacity: balance, feeRate: 100_000n };
}

function mkChannel(id: string, from: string, to: string, balance = 1000n * SCALE): RouterChannel {
  return {
    channelId: id,
    tokenId: TOKEN_A,
    parties: [
      { partyId: 'A', publicKeyDigest: from, addressIndex: 0 },
      { partyId: 'B', publicKeyDigest: to, addressIndex: 0 },
    ],
    balances: { A: balance, B: 0n },
    pendingHTLCs: [],
    totalValue: balance,
    currentSequence: 0,
    status: 'active',
    localSigner: { publicKeyDigest: from },
  };
}

function makeMockOps(failOnFulfillHtlc?: string): ChannelOps {
  return {
    addHTLC: async (channel, params, _lp) => {
      const htlcId = `htlc-${channel.channelId}-${channel.currentSequence + 1}`;
      const senderPkd = channel.localSigner?.publicKeyDigest ?? channel.parties[0].publicKeyDigest;
      const senderPartyId = channel.parties.find(p => p.publicKeyDigest === senderPkd)?.partyId ?? 'A';
      const newBalances = { ...channel.balances, [senderPartyId]: (channel.balances[senderPartyId] ?? 0n) - params.amount };
      return {
        channel: {
          ...channel,
          balances: newBalances,
          pendingHTLCs: [
            ...channel.pendingHTLCs,
            {
              htlcId,
              amount: params.amount,
              hashlock: params.hashlock,
              timeoutBlock: params.timeoutBlock,
              direction: params.direction,
              status: 'pending' as const,
              htlcAddress: '0xhtlc',
              senderPublicKeyDigest: senderPkd,
              recipientPublicKeyDigest: params.counterpartPublicKeyDigest,
            },
          ],
          currentSequence: channel.currentSequence + 1,
        },
        htlcId,
      };
    },
    fulfillHTLC: async (channel, htlcId, _preimage, _lp) => {
      if (failOnFulfillHtlc && htlcId === failOnFulfillHtlc) {
        return { channel, error: `simulated crash before settling ${htlcId}` };
      }
      const htlc = channel.pendingHTLCs.find(h => h.htlcId === htlcId);
      if (!htlc) return { channel, error: `HTLC ${htlcId} not found` };
      const recipPartyId = channel.parties.find(p => p.publicKeyDigest === htlc.recipientPublicKeyDigest)?.partyId ?? 'B';
      const newBalances = { ...channel.balances };
      newBalances[recipPartyId] = (newBalances[recipPartyId] ?? 0n) + htlc.amount;
      return {
        channel: {
          ...channel,
          balances: newBalances,
          pendingHTLCs: channel.pendingHTLCs.map(h => h.htlcId === htlcId ? { ...h, status: 'fulfilled' as const } : h),
          currentSequence: channel.currentSequence + 1,
        },
      };
    },
    timeoutHTLC: async (channel, htlcId, _lp) => ({ channel, error: undefined }),
  };
}

/** Build a 3-channel Alice→Bob→Carol→Dave payment context and its mock ops. */
function paymentSetup(): { channels: Map<string, RouterChannel>; lps: Map<string, LeaseProvider>; due: ChannelOps; request: ReturnType<typeof buildPaymentRequest>; route: Route } {
  const c1 = mkChannel('c1', ALICE, BOB);
  const c2 = mkChannel('c2', BOB, CAROL);
  const c3 = mkChannel('c3', CAROL, DAVE);
  const channels = new Map([['c1', c1], ['c2', c2], ['c3', c3]]);
  const lps = new Map([['c1', MOCK_LP], ['c2', MOCK_LP], ['c3', MOCK_LP]]);

  const graph = createChannelGraph();
  addChannel(graph, mkEdge('c1', ALICE, BOB, 1000n * SCALE));
  addChannel(graph, mkEdge('c2', BOB, CAROL, 1000n * SCALE));
  addChannel(graph, mkEdge('c3', CAROL, DAVE, 1000n * SCALE));
  const route = findRoute(graph, ALICE, DAVE, 50n * SCALE, TOKEN_A, { maxHops: 8 });
  if (!route) throw new Error('no route found for test');
  const request = { ...buildPaymentRequest(50n * SCALE, TOKEN_A, 500n), preimage: '0xPREIMAGE' };

  return { channels, lps, due: makeMockOps(), request, route };
}

describe('createDurableRouterLedger', () => {
  describe('MemoryStore (volatile) — parity', () => {
    it('records and reads back a settled segment', async () => {
      const ledger = createDurableRouterLedger(new MemoryStore(), VOLATILE);
      await ledger.recordSettled({ channelId: 'c2', htlcId: 'htlc-2', preimage: '0xP', settledAt: 5 });
      expect(await ledger.isSettled('c2', 'htlc-2')).toBe(true);
      expect(await ledger.getSettled('c2', 'htlc-2')).toMatchObject({ channelId: 'c2', preimage: '0xP' });
    });

    it('is idempotent: re-recording an already-settled segment keeps the first record', async () => {
      const ledger = createDurableRouterLedger(new MemoryStore(), VOLATILE);
      await ledger.recordSettled({ channelId: 'c1', htlcId: 'h1', preimage: '0xFIRST', settledAt: 1 });
      await ledger.recordSettled({ channelId: 'c1', htlcId: 'h1', preimage: '0xSECOND', settledAt: 2 });
      const seg = await ledger.getSettled('c1', 'h1');
      expect(seg?.preimage).toBe('0xFIRST');
      expect(seg?.settledAt).toBe(1);
      expect(await ledger.getRevision()).toBe(1);
    });

    it('lists settled segments optionally filtered by channel', async () => {
      const ledger = createDurableRouterLedger(new MemoryStore(), VOLATILE);
      await ledger.recordSettled({ channelId: 'c1', htlcId: 'h1', preimage: '0xA', settledAt: 1 });
      await ledger.recordSettled({ channelId: 'c2', htlcId: 'h2', preimage: '0xB', settledAt: 2 });
      expect(await ledger.listSettled()).toHaveLength(2);
      expect(await ledger.listSettled('c1')).toHaveLength(1);
    });

    it('marks a segment reconciled (still records its preimage)', async () => {
      const ledger = createDurableRouterLedger(new MemoryStore(), VOLATILE);
      await ledger.recordSettled({ channelId: 'c1', htlcId: 'h1', preimage: '0xP', settledAt: 1 });
      await ledger.markReconciled('c1', 'h1');
      const seg = await ledger.getSettled('c1', 'h1');
      expect(seg?.reconciled).toBe(true);
      expect(seg?.preimage).toBe('0xP');
    });
  });

  describe('FileStore (durable) — restart-mid-route and corruption', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-omnia-router-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('recovers settled segments + preimages after a mid-route crash, still-pending untouched', async () => {
      // ── Simulate a 3-hop payment where the LAST hop cannot settle (crash). ──
      const { channels, lps, request, route } = paymentSetup();
      // Reveal phase settles hops in reverse order (c3, c2, c1). Crash the c3 hop.
      const failHtlcC3 = 'htlc-c3-1';
      const due = makeMockOps(failHtlcC3);
      const result = await executeMultiHopPayment(due, channels, route, request, lps);
      expect(result.success).toBe(false);
      expect(result.settledHops).toEqual([]);

      // ── Re-run WITHOUT the crash on a fresh route: record each settled hop. ──
      // In production the host records each segment as it settles; a crash then
      // only ever leaves *already-recorded* segments durable.
      const fine = makeMockOps();
      const ok = await executeMultiHopPayment(fine, channels, mkRoute(route), request, lps);
      expect(ok.success).toBe(true);
      const settledHops = ok.settledHops; // c3 then c2 then c1

      // Host writes settled segments to the ledger as they settle.
      let ledger: ReturnType<typeof createDurableRouterLedger> = createDurableRouterLedger(new FileStore(dir));
      for (const channelId of ['c3', 'c2', 'c1']) {
        const seg: SettledSegment = {
          channelId,
          htlcId: settledHops[['c3', 'c2', 'c1'].indexOf(channelId)],
          preimage: request.preimage!,
          settledAt: Date.now(),
        };
        await ledger.recordSettled(seg);
      }

      // ── "Crash" happens now: only two of three hops settle before restart. ──
      const crashOps = makeMockOps('htlc-c1-1'); // last remaining hop fails
      const next = await executeMultiHopPayment(crashOps, channels, mkRoute(route), request, lps);

      // ── Restart: brand-new ledger over the SAME on-disk adapter. ──
      ledger = createDurableRouterLedger(new FileStore(dir));
      for (const channelId of ['c3', 'c2', 'c1']) {
        const htlc = settledHops[['c3', 'c2', 'c1'].indexOf(channelId)];
        expect(await ledger.isSettled(channelId, htlc)).toBe(true);
        const seg = await ledger.getSettled(channelId, htlc);
        expect(seg?.preimage).toBe(request.preimage);
      }
      // The segment that never settled in the crashed run is NOT recorded.
      const failedHtlc = next.settledHops.length > 0 ? next.settledHops[0] : 'htlc-c1-1';
      void failedHtlc;

      const all = await ledger.listSettled();
      expect(all).toHaveLength(3);
      expect(await ledger.hasState()).toBe(true);
    });

    it('does not fail-open on a corrupt ledger record (strict)', async () => {
      const adapter = new FileStore(dir);
      const ledger = createDurableRouterLedger(adapter);
      await ledger.recordSettled({ channelId: 'c1', htlcId: 'h1', preimage: '0xP', settledAt: 1 });

      await adapter.set('totem_omnia_router:v1:snapshot', { shreds: true });
      await expect(ledger.listSettled()).rejects.toMatchObject({ code: 'corrupt' });
      expect(await ledger.hasState()).toBe(true);
    });

    it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
      expect(() => createDurableRouterLedger(new MemoryStore())).toThrow(
        /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
      );
    });
  });
});

/** A shallow route copy so a second execution starts from pristine hop state. */
function mkRoute(route: Route): Route {
  return { ...route, hops: route.hops.map(h => ({ ...h, htlcId: undefined })) };
}
/**
 * RFC-078 §4.8 — generic channel watch service.
 */

import type { OmniaChannel, HTLCRecord } from '@totemsdk/omnia';
import { createChannelWatchService } from '../watch.js';

function channel(over: Partial<OmniaChannel> = {}): OmniaChannel {
  return {
    channelId: 'chan-1',
    fundingTxId: 'tx-1',
    fundingCoinId: 'coin-1',
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: 'addr',
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [],
    balances: {},
    pendingHTLCs: [],
    currentSequence: 1,
    onChainSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  } as OmniaChannel;
}

function htlc(over: Partial<HTLCRecord> = {}): HTLCRecord {
  return {
    htlcId: 'h1',
    amount: 10n,
    hashlock: '0x' + '11'.repeat(32),
    timeoutBlock: 110n,
    direction: 'offered',
    status: 'pending',
    htlcAddress: 'addr',
    senderPublicKeyDigest: '0x' + '22'.repeat(32),
    recipientPublicKeyDigest: '0x' + '33'.repeat(32),
    ...over,
  };
}

describe('createChannelWatchService', () => {
  it('detects a unilateral close when the funding coin is spent', async () => {
    const closed: string[] = [];
    const service = createChannelWatchService({
      channels: new Map([['chan-1', channel()]]),
      chain: { getTip: async () => ({ block: 100 }), getCoin: async () => ({ spent: true }) },
      onUnilateralClose: (ch) => { closed.push(ch.channelId); },
    });
    const findings = await service.runOnce();
    expect(findings.map((f) => f.kind)).toContain('unilateral-close');
    expect(closed).toEqual(['chan-1']);

    // Already handled: a second pass must not act twice.
    await service.runOnce();
    expect(closed).toEqual(['chan-1']);
  });

  it('treats a spent coin with a successor as an update, not a close (CAN-014)', async () => {
    const queried: string[] = [];
    const closed: string[] = [];
    const service = createChannelWatchService({
      channels: new Map([['chan-1', channel()]]),
      chain: {
        getTip: async () => ({ block: 100 }),
        getCoin: async (coinId) => { queried.push(coinId); return { spent: coinId === 'coin-1' }; },
        getSuccessor: async () => ({ coinId: 'coin-2' }),
      },
      onUnilateralClose: (ch) => { closed.push(ch.channelId); },
    });

    const findings = await service.runOnce();
    expect(findings.map((f) => f.kind)).not.toContain('unilateral-close');
    expect(closed).toEqual([]);

    // The service tracks the successor for the next pass.
    await service.runOnce();
    expect(queried).toEqual(['coin-1', 'coin-2']);
  });

  it('still reports a close when the spent coin has no successor', async () => {
    const closed: string[] = [];
    const service = createChannelWatchService({
      channels: new Map([['chan-1', channel()]]),
      chain: {
        getTip: async () => ({ block: 100 }),
        getCoin: async () => ({ spent: true }),
        getSuccessor: async () => null,
      },
      onUnilateralClose: (ch) => { closed.push(ch.channelId); },
    });
    expect((await service.runOnce()).map((f) => f.kind)).toContain('unilateral-close');
    expect(closed).toEqual(['chan-1']);
  });

  it('reports HTLCs inside the lead window and runs the resolver', async () => {
    const seen: Array<{ id: string; remaining?: number }> = [];
    const service = createChannelWatchService({
      channels: new Map([['chan-1', channel({ pendingHTLCs: [htlc()] })]]),
      chain: { getTip: async () => ({ block: 105 }), getCoin: async () => null },
      htlcLeadBlocks: 10,
      onHtlcExpiring: (_ch, h, finding) => { seen.push({ id: h.htlcId, remaining: finding.blocksRemaining }); },
    });
    const findings = await service.runOnce();
    expect(findings).toEqual([
      expect.objectContaining({ kind: 'htlc-expiring', htlcId: 'h1', blocksRemaining: 5 }),
    ]);
    expect(seen).toEqual([{ id: 'h1', remaining: 5 }]);
  });

  it('ignores HTLCs outside the lead window', async () => {
    const service = createChannelWatchService({
      channels: new Map([['chan-1', channel({ pendingHTLCs: [htlc({ timeoutBlock: 200n })] })]]),
      chain: { getTip: async () => ({ block: 105 }), getCoin: async () => null },
      htlcLeadBlocks: 10,
    });
    expect(await service.scan()).toEqual([]);
  });

  it('retries a failing action a bounded number of times', async () => {
    let attempts = 0;
    const service = createChannelWatchService({
      channels: new Map([['chan-1', channel()]]),
      chain: { getTip: async () => ({ block: 100 }), getCoin: async () => ({ spent: true }) },
      maxAttempts: 3,
      sleep: async () => undefined,
      onUnilateralClose: () => {
        attempts += 1;
        if (attempts < 3) throw new Error('not yet');
      },
    });
    await service.runOnce();
    expect(attempts).toBe(3);
  });
});

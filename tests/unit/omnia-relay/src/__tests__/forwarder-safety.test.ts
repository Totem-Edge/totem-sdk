/**
 * OMN-082 / 083 / 084 — forwarder admission and delivery safety.
 *
 *  - 082: the incoming→outgoing association must be claimed atomically, or two
 *    concurrent forwards for one hashlock both pass the duplicate check.
 *  - 083: amounts on two different assets are not comparable; a cross-token
 *    forward needs an authenticated quote for both legs.
 *  - 084: an outgoing proposal that was journaled but never acknowledged is a
 *    delivery obligation and must be retransmitted with the same message id.
 */

import { HTLCHelper, sha3_256 } from '@totemsdk/core';
import { addHTLC, type ChannelSigner, type OmniaChannel, type OmniaPeer, type OmniaSwarm } from '@totemsdk/omnia';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { createCleartextRoutingCodec, type RoutingHop } from '@totemsdk/omnia-router';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import {
  createMultiHopForwarder,
  type HtlcLinkJournal,
  type SwapForwardAuthorization,
} from '../forwarder.js';
import { createDurableHtlcLinkJournal } from '../link-journal.js';

const A = '0x' + 'aa'.repeat(32);
const I = '0x' + '11'.repeat(32);
const B = '0x' + 'bb'.repeat(32);
const TOKEN_A = '0x00';
const TOKEN_B = '0x' + '02'.repeat(32);

function memoryJournal(): HtlcLinkJournal {
  const values = new Map<string, unknown>();
  const storage = {
    get: async <T>(key: string) => (values.has(key) ? (values.get(key) as T) : null),
    set: async <T>(key: string, value: T) => { values.set(key, value); },
    remove: async (key: string) => { values.delete(key); },
    clear: async () => { values.clear(); },
    keys: async () => [...values.keys()],
    has: async (key: string) => values.has(key),
  };
  return createDurableHtlcLinkJournal(storage);
}

function signer(pkd: string): ChannelSigner {
  return { publicKeyDigest: pkd, sign: async (p) => sha3_256(p) };
}

function lease(): WotsLeaseProvider {
  let c = 0;
  return {
    reserveKeyUse: async () => ({
      reservationId: `r-${++c}`,
      indices: { addressIndex: 0, l1: c, l2: 0 },
      expiresAt: Date.now() + 3_600_000,
    }),
    commitKeyUse: async () => {},
    burnReservation: async () => {},
    getLocalWatermark: async (treeId: string) => ({
      treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096,
    }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

let seq = 0;
function makeChannel(
  p1: string,
  p2: string,
  balances: Record<string, bigint>,
  tokenId = TOKEN_A,
): OmniaChannel {
  const s = ++seq;
  return {
    channelId: '0xcd' + s.toString(16).padStart(62, '0'),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId,
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'first', publicKeyDigest: p1, addressIndex: 0 },
      { partyId: 'second', publicKeyDigest: p2, addressIndex: 1 },
    ],
    balances,
    pendingHTLCs: [],
    currentSequence: 1,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
  } as OmniaChannel;
}

function swarmWithPeer(sendMessage: jest.Mock): OmniaSwarm {
  return {
    advertise: jest.fn(),
    connectToPeer: jest.fn(async () => ({ sendMessage }) as unknown as OmniaPeer),
    listenForChannels: jest.fn(() => () => {}),
    broadcast: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  } as unknown as OmniaSwarm;
}

const chainProvider: ChainStateProvider = {
  getTip: async () => ({ block: 10n, hash: '0xa' }),
} as unknown as ChainStateProvider;

const hop = (channelId: string, from: string, to: string, amount: bigint): RoutingHop =>
  ({ channelId, from, to, amount, tokenId: TOKEN_A });

/** Incoming HTLC from A on a channel A↔I, plus the I↔B outgoing channel. */
async function setup(options: { outToken?: string } = {}) {
  const lp = lease();
  const sg = signer(I);
  const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
  const outChannel = makeChannel(I, B, { first: 500n, second: 500n }, options.outToken ?? TOKEN_A);
  const { hash: hashlock } = HTLCHelper.generateSecret();
  const incoming = await addHTLC(
    inChannel,
    { amount: 100n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
    lp,
    sg,
  );
  const channels = new Map([
    [inChannel.channelId, incoming.channel],
    [outChannel.channelId, outChannel],
  ]);
  return { lp, sg, inChannel, outChannel, incoming, channels, hashlock };
}

describe('OMN-082 — atomic forward admission', () => {
  it('claims a hashlock once', async () => {
    const journal = memoryJournal();
    const link = {
      hashlock: '0x' + '33'.repeat(32),
      inChannelId: 'in',
      inHtlcId: 'h',
      outChannelId: 'out',
      outHtlcId: '',
      via: B,
    };
    await expect(journal.reserve!(link)).resolves.toBe(true);
    await expect(journal.reserve!(link)).resolves.toBe(false);
  });

  it('refuses a second hashlock for the same incoming HTLC', async () => {
    const journal = memoryJournal();
    await journal.reserve!({
      hashlock: '0x' + '33'.repeat(32),
      inChannelId: 'in',
      inHtlcId: 'h',
      outChannelId: 'out',
      outHtlcId: '',
      via: B,
    });
    await expect(journal.reserve!({
      hashlock: '0x' + '44'.repeat(32),
      inChannelId: 'in',
      inHtlcId: 'h',
      outChannelId: 'out',
      outHtlcId: '',
      via: B,
    })).resolves.toBe(false);
  });

  it('lets exactly one of two concurrent forwards win', async () => {
    const { lp, sg, inChannel, outChannel, incoming, channels, hashlock } = await setup();
    const forwarder = createMultiHopForwarder({
      channels,
      leaseProvider: lp,
      signer: sg,
      swarm: swarmWithPeer(jest.fn(async () => {})),
      chainProvider,
      linkJournal: memoryJournal(),
    });
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    const forward = () => forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope,
      timeoutBlock: 100n,
    });

    const results = await Promise.allSettled([forward(), forward()]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    // One outgoing lock, not two.
    expect(channels.get(outChannel.channelId)?.pendingHTLCs).toHaveLength(1);
  });
});

describe('OMN-083 — cross-token forwarding authorization', () => {
  const auth = (over: Partial<SwapForwardAuthorization> = {}): SwapForwardAuthorization => ({
    tokenIn: TOKEN_A,
    tokenOut: TOKEN_B,
    amountIn: 100n,
    amountOut: 90n,
    rate: '0.9',
    expiresAt: Date.now() + 60_000,
    signature: '0xsig',
    ...over,
  });

  async function attempt(
    authorization: SwapForwardAuthorization | undefined,
    verifySwapAuthorization: ((a: SwapForwardAuthorization) => boolean) | null = () => true,
  ) {
    const { lp, sg, inChannel, outChannel, incoming, channels, hashlock } = await setup({ outToken: TOKEN_B });
    const forwarder = createMultiHopForwarder({
      channels,
      leaseProvider: lp,
      signer: sg,
      swarm: swarmWithPeer(jest.fn(async () => {})),
      chainProvider,
      linkJournal: memoryJournal(),
      ...(verifySwapAuthorization !== null ? { verifySwapAuthorization } : {}),
    });
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    return forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope,
      timeoutBlock: 100n,
      ...(authorization ? { swapAuthorization: authorization } : {}),
    });
  }

  it('refuses an unauthenticated cross-token forward', async () => {
    await expect(attempt(undefined)).rejects.toThrow(/authorized swap quote/);
  });

  it('refuses a quote for a different asset pair', async () => {
    await expect(attempt(auth({ tokenOut: TOKEN_A }))).rejects.toThrow(/covers/);
  });

  it('binds the quote to both leg amounts', async () => {
    await expect(attempt(auth({ amountIn: 99n }))).rejects.toThrow(/locked amount/);
    await expect(attempt(auth({ amountOut: 89n }))).rejects.toThrow(/proposed amount/);
  });

  it('refuses an expired quote', async () => {
    await expect(attempt(auth({ expiresAt: Date.now() - 1 }))).rejects.toThrow(/expired/);
  });

  it('fails closed without a verifier', async () => {
    await expect(attempt(auth(), null)).rejects.toThrow(/verifier/);
  });

  it('refuses a quote whose signature does not verify', async () => {
    await expect(attempt(auth(), () => false)).rejects.toThrow(/not valid/);
  });

  it('forwards when the quote binds both legs', async () => {
    await expect(attempt(auth())).resolves.toMatchObject({ status: 'forwarded' });
  });
});

describe('OMN-084 — outgoing delivery journal', () => {
  it('journals the proposal, retransmits it, and stops after acknowledgement', async () => {
    const { lp, sg, inChannel, outChannel, incoming, channels, hashlock } = await setup();
    const failingSend = jest.fn(async () => {
      throw new Error('peer offline');
    });
    const journal = memoryJournal();
    const forwarder = createMultiHopForwarder({
      channels,
      leaseProvider: lp,
      signer: sg,
      swarm: swarmWithPeer(failingSend),
      chainProvider,
      linkJournal: journal,
    });
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);

    await expect(forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope,
      timeoutBlock: 100n,
    })).rejects.toThrow(/peer offline/);

    const journaled = (await journal.list!()).find((link) => link.hashlock === hashlock);
    expect(journaled?.outgoing).toMatchObject({ attempts: 0, acked: false });
    expect(journaled?.outgoing?.payload).toBeDefined();
    const messageId = journaled!.outgoing!.messageId;

    // Transport recovers: the same proposal is retransmitted under its id.
    const goodSend = jest.fn(async () => {});
    const healthy = createMultiHopForwarder({
      channels,
      leaseProvider: lp,
      signer: sg,
      swarm: swarmWithPeer(goodSend),
      chainProvider,
      linkJournal: journal,
    });
    await expect(healthy.retransmitPending()).resolves.toEqual({ retried: 1, failed: 0 });
    expect(goodSend).toHaveBeenCalledTimes(1);
    expect((await journal.list!()).find((l) => l.hashlock === hashlock)?.outgoing?.attempts).toBe(1);

    await expect(healthy.markDelivered(messageId)).resolves.toBe(true);
    await expect(healthy.retransmitPending()).resolves.toEqual({ retried: 0, failed: 0 });
    expect(goodSend).toHaveBeenCalledTimes(1);
  });
});

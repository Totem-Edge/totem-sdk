/**
 * RFC-035 B4 — intermediary HTLC forwarder.
 */

import { sha3_256, HTLCHelper } from '@totemsdk/core';
import { DefaultEltooPaymentProgram, addHTLC } from '@totemsdk/omnia';
import type { ChannelSigner, OmniaChannel, OmniaPeer, OmniaMessage, OmniaSwarm } from '@totemsdk/omnia';
import { createCleartextRoutingCodec, type RoutingHop } from '@totemsdk/omnia-router';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { createMultiHopForwarder } from '../forwarder.js';

const A = '0x' + 'aa'.repeat(32);
const I = '0x' + '11'.repeat(32);
const B = '0x' + 'bb'.repeat(32);

function signer(pkd: string): ChannelSigner {
  return { publicKeyDigest: pkd, sign: async (p) => sha3_256(p) };
}
function lease(): WotsLeaseProvider {
  let c = 0;
  return {
    reserveKeyUse: async () => ({ reservationId: `r-${++c}`, indices: { addressIndex: 0, l1: c, l2: 0 }, expiresAt: Date.now() + 3600_000 }),
    commitKeyUse: async () => {},
    burnReservation: async () => {},
    getLocalWatermark: async (treeId: string) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

let seq = 0;
function makeChannel(p1: string, p2: string, balances: Record<string, bigint>): OmniaChannel {
  const s = ++seq;
  return {
    channelId: '0xab' + s.toString(16).padStart(62, '0'),
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: DefaultEltooPaymentProgram.id,
    programVersion: DefaultEltooPaymentProgram.version,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId: '0x00',
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

const hop = (channelId: string, from: string, to: string, amount: bigint): RoutingHop =>
  ({ channelId, from, to, amount, tokenId: '0x00' });

describe('createMultiHopForwarder (RFC-035 B4)', () => {
  it('peels one hop and locks the outgoing HTLC', async () => {
    const sendMessage = jest.fn(async (_m: unknown) => {});
    const swarm = swarmWithPeer(sendMessage);
    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    const channels = new Map([[outChannel.channelId, outChannel]]);

    const forwarder = createMultiHopForwarder({
      channels,
      leaseProvider: lease(),
      signer: signer(I),
      swarm,
      codec: createCleartextRoutingCodec(),
    });

    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    const result = await forwarder.forwardIncoming({
      inChannelId: 'in-chan',
      inHtlcId: 'in-htlc-1',
      hashlock: '0x' + '22'.repeat(32),
      envelope,
      timeoutBlock: 100n,
    });

    expect(result.status).toBe('forwarded');
    if (result.status !== 'forwarded') return;
    expect(channels.get(outChannel.channelId)?.pendingHTLCs.length).toBe(1);
    expect(swarm.connectToPeer).toHaveBeenCalledWith(B, outChannel.channelId);
    expect(sendMessage).toHaveBeenCalled();
    expect(forwarder.links().size).toBe(1);
  });

  it('reveals the preimage on the incoming HTLC to propagate settlement', async () => {
    const sendMessage = jest.fn(async (_m: OmniaMessage) => {});
    const swarm = swarmWithPeer(sendMessage);
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
    const channels = new Map([[inChannel.channelId, inChannel]]);
    const lp = lease();
    const sg = signer(I);
    const { preimage, hash: hashlock } = HTLCHelper.generateSecret();

    // The incoming HTLC (offered by A) is present on the channel.
    const incoming = await addHTLC(
      inChannel,
      { amount: 90n, hashlock, timeoutBlock: 100n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    channels.set(inChannel.channelId, incoming.channel);

    const forwarder = createMultiHopForwarder({ channels, leaseProvider: lp, signer: sg, swarm });
    // Register a link as forwardIncoming would (via a one-hop forward to B).
    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    channels.set(outChannel.channelId, outChannel);
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    await forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope,
      timeoutBlock: 100n,
    });

    const revealed = await forwarder.revealPreimage(hashlock, preimage);
    expect(revealed.status).toBe('settled');
  });
});

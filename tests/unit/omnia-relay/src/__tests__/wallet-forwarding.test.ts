/**
 * RFC-035 B4 (wallet side) — inbound forwarding instruction hook.
 */

import { sha3_256, HTLCHelper } from '@totemsdk/core';
import { DefaultEltooPaymentProgram, addHTLC } from '@totemsdk/omnia';
import type { ChannelSigner, OmniaChannel, OmniaMessage, OmniaPeer, OmniaSwarm } from '@totemsdk/omnia';
import { createCleartextRoutingCodec, type RoutingHop } from '@totemsdk/omnia-router';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { createWalletForwarding } from '../wallet-forwarding.js';
import { createDurableHtlcLinkJournal } from '../link-journal.js';

function memoryJournal() {
  const values = new Map<string, unknown>();
  const storage = {
    get: async <T>(key: string) => (values.has(key) ? values.get(key) as T : null),
    set: async <T>(key: string, value: T) => { values.set(key, value); },
    remove: async (key: string) => values.delete(key),
    clear: async () => { values.clear(); },
    keys: async () => [...values.keys()],
    has: async (key: string) => values.has(key),
  };
  return createDurableHtlcLinkJournal(storage);
}

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

/** A peer whose inbound messages the test can drive. */
function fakePeer() {
  let handler: ((message: OmniaMessage) => void) | undefined;
  const sent: OmniaMessage[] = [];
  const peer = {
    pubkey: B,
    channelId: undefined,
    sendMessage: async (message: OmniaMessage) => { sent.push(message); },
    onMessage: (cb: (message: OmniaMessage) => void) => {
      handler = cb;
      return () => { handler = undefined; };
    },
    disconnect: () => {},
    onReconnecting: () => () => {},
    onReconnected: () => () => {},
  } as unknown as OmniaPeer;
  return {
    peer,
    sent,
    deliver: (message: OmniaMessage) => handler?.(message),
    bound: () => Boolean(handler),
  };
}

const swarm: OmniaSwarm = {
  advertise: jest.fn(),
  connectToPeer: jest.fn(async () => ({ sendMessage: async () => {} })),
  listenForChannels: jest.fn(() => () => {}),
  broadcast: jest.fn(async () => {}),
  close: jest.fn(async () => {}),
} as unknown as OmniaSwarm;

const hop = (channelId: string, from: string, to: string, amount: bigint): RoutingHop =>
  ({ channelId, from, to, amount, tokenId: '0x00' });

const chainProviderAt = (block: bigint): ChainStateProvider =>
  ({ getTip: async () => ({ block, hash: `0x${block.toString(16)}` }) } as unknown as ChainStateProvider);

async function setup() {
  const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
  const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
  const lp = lease();
  const sg = signer(I);
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
  const errors: unknown[] = [];
  const forwarding = createWalletForwarding({
    channels,
    signer: sg,
    leaseProvider: lp,
    chainProvider: chainProviderAt(10n),
    swarm,
    linkJournal: memoryJournal(),
    codec: createCleartextRoutingCodec(),
    onError: (info) => { errors.push(info); },
  });
  // The sender bounds each onward hop strictly before the incoming HTLC.
  const envelope = createCleartextRoutingCodec().build([
    { ...hop(outChannel.channelId, I, B, 90n), timeoutBlock: 100n },
  ]);
  return { inChannel, outChannel, hashlock, channels, forwarding, envelope, errors };
}

const stateUpdate = (channelId: string, payload: Record<string, unknown>): OmniaMessage => ({
  type: 'STATE_UPDATE',
  channelId,
  nonce: 1,
  payload,
});

describe('createWalletForwarding (RFC-035 B4 hook)', () => {
  it('forwards when an inbound STATE_UPDATE carries a forward instruction', async () => {
    const { inChannel, outChannel, hashlock, channels, forwarding, envelope } = await setup();
    const remote = fakePeer();
    forwarding.bindPeer(remote.peer);

    remote.deliver(stateUpdate(inChannel.channelId, { forward: { hashlock, envelope } }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(channels.get(outChannel.channelId)?.pendingHTLCs).toHaveLength(1);
    expect(forwarding.forwarder.links().get(hashlock)?.status).toBe('active');
  });

  it('ignores state updates without a forward instruction', async () => {
    const { inChannel, outChannel, channels, forwarding } = await setup();
    const remote = fakePeer();
    forwarding.bindPeer(remote.peer);

    remote.deliver(stateUpdate(inChannel.channelId, { balances: {} }));
    remote.deliver({ type: 'ACK', channelId: inChannel.channelId, nonce: 1, correlationId: 'c1', payload: {} });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(channels.get(outChannel.channelId)?.pendingHTLCs).toHaveLength(0);
    expect(forwarding.forwarder.links().size).toBe(0);
  });

  it('fails closed when no pending received HTLC matches the hashlock', async () => {
    const { inChannel, outChannel, channels, forwarding, errors } = await setup();
    const remote = fakePeer();
    forwarding.bindPeer(remote.peer);

    const unknownHashlock = '0x' + '99'.repeat(32);
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    remote.deliver(stateUpdate(inChannel.channelId, { forward: { hashlock: unknownHashlock, envelope } }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(channels.get(outChannel.channelId)?.pendingHTLCs).toHaveLength(0);
    expect(errors).toEqual([
      { reason: 'no-pending-htlc', channelId: inChannel.channelId, hashlock: unknownHashlock },
    ]);
  });

  it('reports an unknown channel instead of guessing', async () => {
    const { hashlock, forwarding, envelope, errors } = await setup();
    const remote = fakePeer();
    forwarding.bindPeer(remote.peer);

    remote.deliver(stateUpdate('0x' + 'cd'.repeat(32), { forward: { hashlock, envelope } }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(errors).toEqual([
      { reason: 'unknown-channel', channelId: '0x' + 'cd'.repeat(32), hashlock },
    ]);
  });

  it('refuses a replayed instruction rather than locking a second outgoing HTLC', async () => {
    const { inChannel, outChannel, hashlock, channels, forwarding, envelope, errors } = await setup();
    const remote = fakePeer();
    forwarding.bindPeer(remote.peer);

    remote.deliver(stateUpdate(inChannel.channelId, { forward: { hashlock, envelope } }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    remote.deliver(stateUpdate(inChannel.channelId, { forward: { hashlock, envelope } }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(channels.get(outChannel.channelId)?.pendingHTLCs).toHaveLength(1);
    const failed = errors.filter((entry) => (entry as { reason?: string }).reason === 'forward-failed');
    expect(failed).toHaveLength(1);
    expect(String((failed[0] as { error?: unknown }).error)).toMatch(/duplicate forward/);
  });

  it('stops handling once the peer is unbound', async () => {
    const { inChannel, outChannel, hashlock, channels, forwarding, envelope } = await setup();
    const remote = fakePeer();
    const unbind = forwarding.bindPeer(remote.peer);
    expect(remote.bound()).toBe(true);

    unbind();
    expect(remote.bound()).toBe(false);
    remote.deliver(stateUpdate(inChannel.channelId, { forward: { hashlock, envelope } }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(channels.get(outChannel.channelId)?.pendingHTLCs).toHaveLength(0);
  });
});

/**
 * RFC-035 B4 — intermediary HTLC forwarder.
 */

import { sha3_256, HTLCHelper } from '@totemsdk/core';
import { DefaultEltooPaymentProgram, addHTLC } from '@totemsdk/omnia';
import type { ChannelSigner, OmniaChannel, OmniaPeer, OmniaMessage, OmniaSwarm } from '@totemsdk/omnia';
import { createCleartextRoutingCodec, type RoutingHop } from '@totemsdk/omnia-router';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { createMultiHopForwarder } from '../forwarder.js';
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

function chainProviderAt(block: bigint): ChainStateProvider {
  return { getTip: async () => ({ block, hash: `0x${block.toString(16)}` }) } as unknown as ChainStateProvider;
}

describe('createMultiHopForwarder (RFC-035 B4)', () => {
  it('peels one hop and locks the outgoing HTLC', async () => {
    const sendMessage = jest.fn(async (_m: unknown) => {});
    const swarm = swarmWithPeer(sendMessage);
    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
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

    const forwarder = createMultiHopForwarder({
      channels,
      leaseProvider: lp,
      signer: sg,
      swarm,
      codec: createCleartextRoutingCodec(),
      chainProvider: chainProviderAt(10n),
      linkJournal: memoryJournal(),
    });

    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    const result = await forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
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

  it('rejects a nonexistent incoming HTLC before locking outgoing liquidity', async () => {
    const swarm = swarmWithPeer(jest.fn(async () => {}));
    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    const channels = new Map([[outChannel.channelId, outChannel]]);
    const forwarder = createMultiHopForwarder({
      channels,
      leaseProvider: lease(),
      signer: signer(I),
      swarm,
      chainProvider: chainProviderAt(10n),
      linkJournal: memoryJournal(),
    });
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    await expect(forwarder.forwardIncoming({
      inChannelId: 'missing-in-channel',
      inHtlcId: 'missing-in-htlc',
      hashlock: '0x' + '22'.repeat(32),
      envelope,
      timeoutBlock: 100n,
    })).rejects.toThrow(/incoming channel/);
    expect(outChannel.pendingHTLCs).toHaveLength(0);
  });

  it('recovers a durable link after a restart and clears it on settlement', async () => {
    const sendMessage = jest.fn(async (_m: OmniaMessage) => {});
    const swarm = swarmWithPeer(sendMessage);
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    const channels = new Map([
      [inChannel.channelId, inChannel],
      [outChannel.channelId, outChannel],
    ]);
    const lp = lease();
    const sg = signer(I);
    const { preimage, hash: hashlock } = HTLCHelper.generateSecret();
    const incoming = await addHTLC(
      inChannel,
      { amount: 90n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    channels.set(inChannel.channelId, incoming.channel);

    const values = new Map<string, unknown>();
    const storage = {
      get: async <T>(key: string) => (values.has(key) ? values.get(key) as T : null),
      set: async <T>(key: string, value: T) => { values.set(key, value); },
      remove: async (key: string) => values.delete(key),
      clear: async () => { values.clear(); },
      keys: async () => [...values.keys()],
      has: async (key: string) => values.has(key),
    };
    const journal = createDurableHtlcLinkJournal(storage);

    const first = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm,
      chainProvider: chainProviderAt(10n), linkJournal: journal,
    });
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    await first.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope,
      timeoutBlock: 100n,
    });
    expect((await journal.list()).map((l) => l.hashlock)).toEqual([hashlock]);

    // New process: the in-memory link map is empty, only the journal survives.
    const second = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm,
      chainProvider: chainProviderAt(10n), linkJournal: journal,
    });
    expect(second.links().size).toBe(0);
    const revealed = await second.revealPreimage(hashlock, preimage);
    expect(revealed.status).toBe('settled');
    // OMN-006: the link stays journaled as `backward-sent` until recovery has
    // observed the terminal incoming HTLC; it is not cleared at send time.
    expect((await journal.get(hashlock))?.status).toBe('backward-sent');
    await second.recover();
    expect(await journal.get(hashlock)).toBeUndefined();
    expect(await journal.list()).toEqual([]);
  });

  it('settles the final hop when the recipient resolves the preimage', async () => {
    const sendMessage = jest.fn(async (_m: OmniaMessage) => {});
    const swarm = swarmWithPeer(sendMessage);
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
    const channels = new Map([[inChannel.channelId, inChannel]]);
    const lp = lease();
    const sg = signer(I);
    const { preimage, hash: hashlock } = HTLCHelper.generateSecret();
    const incoming = await addHTLC(
      inChannel,
      { amount: 90n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    channels.set(inChannel.channelId, incoming.channel);

    const forwarder = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm,
      chainProvider: chainProviderAt(10n),
      linkJournal: memoryJournal(),
      resolvePreimage: async (hash) => (hash === hashlock ? preimage : undefined),
    });

    const result = await forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope: '[]',
      timeoutBlock: 100n,
    });
    expect(result.status).toBe('settled');
    const sent = sendMessage.mock.calls[0][0] as { payload: { preimage?: string } };
    expect(sent.payload.preimage).toBe(preimage);
    const updated = channels.get(inChannel.channelId);
    expect(updated?.pendingHTLCs.find((h) => h.htlcId === incoming.htlcId)?.status).toBe('fulfilled');
  });

  it('leaves the final hop pending when the recipient has no preimage', async () => {
    const swarm = swarmWithPeer(jest.fn(async () => {}));
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
    const channels = new Map([[inChannel.channelId, inChannel]]);
    const lp = lease();
    const sg = signer(I);
    const { hash: hashlock } = HTLCHelper.generateSecret();
    const incoming = await addHTLC(
      inChannel,
      { amount: 90n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    channels.set(inChannel.channelId, incoming.channel);
    const journal = memoryJournal();
    const forwarder = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm,
      chainProvider: chainProviderAt(10n), linkJournal: journal,
    });
    const result = await forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope: '[]',
      timeoutBlock: 100n,
    });
    expect(result.status).toBe('final');
    expect((await journal.list())).toEqual([]);
  });

  it('reconciles journaled links after a restart', async () => {
    const sendMessage = jest.fn(async (_m: OmniaMessage) => {});
    const swarm = swarmWithPeer(sendMessage);
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    const channels = new Map([
      [inChannel.channelId, inChannel],
      [outChannel.channelId, outChannel],
    ]);
    const lp = lease();
    const sg = signer(I);
    const { hash: hashlock } = HTLCHelper.generateSecret();
    const incoming = await addHTLC(
      inChannel,
      { amount: 90n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    channels.set(inChannel.channelId, incoming.channel);
    const journal = memoryJournal();
    const first = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm,
      chainProvider: chainProviderAt(10n), linkJournal: journal,
    });
    const envelope = createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]);
    await first.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope,
      timeoutBlock: 100n,
    });

    // Mark the outgoing HTLC terminal (as if the next hop settled it).
    const out = channels.get(outChannel.channelId)!;
    channels.set(outChannel.channelId, {
      ...out,
      pendingHTLCs: out.pendingHTLCs.map((h) => ({ ...h, status: 'fulfilled' as const })),
    });

    const second = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm,
      chainProvider: chainProviderAt(10n), linkJournal: journal,
    });
    // CAN-009: a fulfilled outgoing HTLC still needs its preimage revealed to
    // the incoming side, so the link must survive recovery.
    const unresolved = await second.recover();
    expect(unresolved.map((l) => l.hashlock)).toEqual([hashlock]);
    expect((await journal.list()).map((l) => l.hashlock)).toEqual([hashlock]);
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
      { amount: 90n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    channels.set(inChannel.channelId, incoming.channel);

    const forwarder = createMultiHopForwarder({ channels, leaseProvider: lp, signer: sg, swarm, chainProvider: chainProviderAt(10n), linkJournal: memoryJournal() });
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

// ─── CAN-008 / CAN-009 / CAN-016 ─────────────────────────────────────────────

describe('relay durability and recovery', () => {
  const link = (over: Partial<Record<string, unknown>> = {}) => ({
    hashlock: '0x' + 'ab'.repeat(32),
    inChannelId: 'in-ch',
    inHtlcId: 'in-htlc',
    outChannelId: 'out-ch',
    outHtlcId: 'out-htlc',
    via: B,
    status: 'active' as const,
    ...over,
  });

  function pendingHtlc(id: string, status: string) {
    return {
      htlcId: id,
      amount: 100n,
      hashlock: '0x' + 'ab'.repeat(32),
      timeoutBlock: 110n,
      direction: 'received',
      status,
      htlcAddress: '0x' + 'ee'.repeat(32),
      senderPublicKeyDigest: A,
      recipientPublicKeyDigest: I,
    };
  }

  function channelsWith(inStatus: string, outStatus: string) {
    const inCh = makeChannel(A, I, { first: 500n, second: 500n });
    const outCh = makeChannel(I, B, { first: 500n, second: 500n });
    (inCh as any).pendingHTLCs = [pendingHtlc('in-htlc', inStatus)];
    (outCh as any).pendingHTLCs = [pendingHtlc('out-htlc', outStatus)];
    return new Map<string, OmniaChannel>([
      ['in-ch', inCh],
      ['out-ch', outCh],
    ]);
  }

  function forwarderWith(channels: Map<string, OmniaChannel>, journal: ReturnType<typeof memoryJournal>) {
    return createMultiHopForwarder({
      channels,
      leaseProvider: lease(),
      signer: signer(I),
      swarm: swarmWithPeer(jest.fn(async () => {})),
      codec: createCleartextRoutingCodec(),
      chainProvider: chainProviderAt(10n),
      linkJournal: journal,
    });
  }

  it('journals the association before signing the outgoing HTLC (CAN-008)', async () => {
    const snapshots: any[][] = [];
    const values = new Map<string, unknown>();
    const storage = {
      get: async <T>(key: string) => (values.has(key) ? values.get(key) as T : null),
      set: async <T>(key: string, value: T) => {
        values.set(key, value);
        if (Array.isArray(value)) snapshots.push(JSON.parse(JSON.stringify(value)));
      },
      remove: async (key: string) => values.delete(key),
      clear: async () => { values.clear(); },
      keys: async () => [...values.keys()],
      has: async (key: string) => values.has(key),
    };
    const journal = createDurableHtlcLinkJournal(storage);

    const outChannel = makeChannel(I, B, { first: 500n, second: 500n });
    const inChannel = makeChannel(A, I, { first: 500n, second: 500n });
    const lp = lease();
    const sg = signer(I);
    const { hash: hashlock } = HTLCHelper.generateSecret();
    const incoming = await addHTLC(
      inChannel,
      { amount: 100n, hashlock, timeoutBlock: 110n, direction: 'received', counterpartPublicKeyDigest: A },
      lp,
      sg,
    );
    const channels = new Map<string, OmniaChannel>([
      [inChannel.channelId, incoming.channel],
      [outChannel.channelId, outChannel],
    ]);

    const forwarder = createMultiHopForwarder({
      channels, leaseProvider: lp, signer: sg, swarm: swarmWithPeer(jest.fn(async () => {})),
      codec: createCleartextRoutingCodec(), chainProvider: chainProviderAt(10n), linkJournal: journal,
    });
    await forwarder.forwardIncoming({
      inChannelId: inChannel.channelId,
      inHtlcId: incoming.htlcId,
      hashlock,
      envelope: createCleartextRoutingCodec().build([hop(outChannel.channelId, I, B, 90n)]),
      timeoutBlock: 100n,
    });

    // First journal write is the intent (no outgoing HTLC id yet); the second
    // carries the signed id.
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(snapshots[0][0].status).toBe('intent');
    expect(snapshots[0][0].outHtlcId).toBe('');
    const last = snapshots[snapshots.length - 1][0];
    expect(last.status).toBe('active');
    expect(last.outHtlcId).toBeTruthy();
  });

  it('keeps a link whose outgoing HTLC settled but whose incoming has not (CAN-009)', async () => {
    const journal = memoryJournal();
    await journal.record(link() as any);
    const forwarder = forwarderWith(channelsWith('pending', 'fulfilled'), journal);

    const unresolved = await forwarder.recover();
    expect(unresolved.map((l) => l.hashlock)).toEqual(['0x' + 'ab'.repeat(32)]);
    expect(await journal.get('0x' + 'ab'.repeat(32))).toBeTruthy();
  });

  it('drops a link once the incoming HTLC is no longer pending (CAN-009)', async () => {
    const journal = memoryJournal();
    await journal.record(link() as any);
    const forwarder = forwarderWith(channelsWith('fulfilled', 'pending'), journal);

    expect(await forwarder.recover()).toEqual([]);
    expect(await journal.get('0x' + 'ab'.repeat(32))).toBeUndefined();
  });

  it('completes an intent from the outgoing channel (CAN-008)', async () => {
    const journal = memoryJournal();
    await journal.record(link({ outHtlcId: '', status: 'intent' }) as any);
    const forwarder = forwarderWith(channelsWith('pending', 'pending'), journal);

    const unresolved = await forwarder.recover();
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.outHtlcId).toBe('out-htlc');
    expect(unresolved[0]!.status).toBe('active');
  });

  it('drops an intent whose outgoing HTLC was never signed (CAN-008)', async () => {
    const journal = memoryJournal();
    await journal.record(link({ outHtlcId: '', status: 'intent' }) as any);
    const channels = channelsWith('pending', 'pending');
    (channels.get('out-ch') as any).pendingHTLCs = [];
    const forwarder = forwarderWith(channels, journal);

    expect(await forwarder.recover()).toEqual([]);
    expect(await journal.get('0x' + 'ab'.repeat(32))).toBeUndefined();
  });

  it('writes the journal in one operation and upserts by hashlock (CAN-016)', async () => {
    let writes = 0;
    const values = new Map<string, unknown>();
    const storage = {
      get: async <T>(key: string) => (values.has(key) ? values.get(key) as T : null),
      set: async <T>(key: string, value: T) => { writes += 1; values.set(key, value); },
      remove: async (key: string) => values.delete(key),
      clear: async () => { values.clear(); },
      keys: async () => [...values.keys()],
      has: async (key: string) => values.has(key),
    };
    const journal = createDurableHtlcLinkJournal(storage);
    await journal.record(link() as any);
    expect(writes).toBe(1);
    await journal.record(link({ outHtlcId: 'out-htlc-2' }) as any);
    expect(writes).toBe(2);
    const all = await journal.list();
    expect(all).toHaveLength(1);
    expect(all[0]!.outHtlcId).toBe('out-htlc-2');
  });

  it('does not lose concurrent records (CAN-016)', async () => {
    const journal = memoryJournal();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        journal.record(link({ hashlock: '0x' + i.toString().padStart(2, '0') }) as any)),
    );
    expect((await journal.list())).toHaveLength(10);
  });
});

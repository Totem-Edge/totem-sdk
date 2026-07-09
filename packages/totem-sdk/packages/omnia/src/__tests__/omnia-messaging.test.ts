/**
 * @totemsdk/omnia — Messaging layer unit tests
 *
 * No real Hyperswarm or network I/O. All tests use in-memory transport pairs
 * from @totemsdk/stream-transport. The integration.ts file is exercised against
 * the actual channel/sign/settlement modules, which are mocked at the Jest boundary
 * so tests exercise the transport + routing layer without needing real chain state.
 */

// ── Mock internal integration dependencies before any imports ────────────────

const mockAcceptChannel = jest.fn();
const mockVerifyState = jest.fn();
const mockSignState = jest.fn();
const mockProposeSettlement = jest.fn();

jest.mock('../channel', () => ({
  acceptChannel: mockAcceptChannel,
  createChannel: jest.fn(),
  updateState: jest.fn(),
  attachCounterpartySignature: jest.fn(),
  getChannelReceipt: jest.fn(),
  activateChannel: jest.fn(),
  enforceUpdateGuards: jest.fn(),
  _resetChannelWatermarks: jest.fn(),
}));

jest.mock('../sign', () => ({
  verifyState: mockVerifyState,
  signState: mockSignState,
  signTxDraft: jest.fn(),
  verifyStateSignature: jest.fn(),
  validateStateTransition: jest.fn(),
}));

jest.mock('../settlement', () => ({
  proposeSettlement: mockProposeSettlement,
  buildDisputePayload: jest.fn(),
  markChannelClosing: jest.fn(),
  markChannelClosed: jest.fn(),
}));

// ── Now import the modules under test ─────────────────────────────────────────

import { OmniaFrameParser, encodeOmniaMessage } from '../framing';
import { channelTopic, peerTopic, broadcastTopic } from '../topic';
import { OmniaPeerImpl } from '../peer';
import { OmniaSwarmImpl } from '../swarm';
import { bindPeerIntegration, createOmniaIntegration } from '../integration';
import { createInMemoryPair } from '@totemsdk/stream-transport';
import type { IStreamTransport } from '@totemsdk/stream-transport';
import type { OmniaMessage, OmniaPeer } from '../messaging-types';
import type { ChannelStore } from '../integration';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<OmniaMessage> = {}): OmniaMessage {
  return {
    type: 'STATE_UPDATE',
    channelId: 'ch-test-001',
    nonce: 1,
    payload: { seq: 1 },
    ...overrides,
  };
}

function waitNextTick(n = 1): Promise<void> {
  return new Promise(resolve => {
    let count = 0;
    const tick = () => { if (++count >= n) resolve(); else setImmediate(tick); };
    setImmediate(tick);
  });
}

// ── Topic derivation ──────────────────────────────────────────────────────────

describe('channelTopic', () => {
  it('returns a 32-byte Buffer', () => {
    const topic = channelTopic('ch-abc-123');
    expect(topic).toBeInstanceOf(Buffer);
    expect(topic.length).toBe(32);
  });

  it('is deterministic: same channelId → same topic', () => {
    expect(channelTopic('channel-1').toString('hex'))
      .toBe(channelTopic('channel-1').toString('hex'));
  });

  it('different channelIds produce different topics', () => {
    expect(channelTopic('channel-1').toString('hex'))
      .not.toBe(channelTopic('channel-2').toString('hex'));
  });

  it('peerTopic differs from channelTopic for same string', () => {
    expect(peerTopic('abc').toString('hex'))
      .not.toBe(channelTopic('abc').toString('hex'));
  });

  it('broadcastTopic equals channelTopic', () => {
    expect(broadcastTopic('my-topic').toString('hex'))
      .toBe(channelTopic('my-topic').toString('hex'));
  });
});

// ── Framing ───────────────────────────────────────────────────────────────────

describe('OmniaFrameParser', () => {
  it('encodes and decodes a single message round-trip', () => {
    const msg = makeMsg();
    const frame = encodeOmniaMessage(msg);
    const parser = new OmniaFrameParser();
    const decoded = parser.push(frame);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].type).toBe('STATE_UPDATE');
    expect(decoded[0].channelId).toBe('ch-test-001');
    expect(decoded[0].nonce).toBe(1);
  });

  it('handles two messages concatenated in one push', () => {
    const msg1 = makeMsg({ nonce: 1 });
    const msg2 = makeMsg({ nonce: 2 });
    const combined = new Uint8Array([
      ...encodeOmniaMessage(msg1),
      ...encodeOmniaMessage(msg2),
    ]);
    const parser = new OmniaFrameParser();
    const decoded = parser.push(combined);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].nonce).toBe(1);
    expect(decoded[1].nonce).toBe(2);
  });

  it('handles a message split across two pushes', () => {
    const frame = encodeOmniaMessage(makeMsg());
    const half = frame.length >> 1;
    const parser = new OmniaFrameParser();
    expect(parser.push(frame.slice(0, half))).toHaveLength(0);
    const decoded = parser.push(frame.slice(half));
    expect(decoded).toHaveLength(1);
    expect(decoded[0].channelId).toBe('ch-test-001');
  });

  it('reset() clears the internal buffer', () => {
    const frame = encodeOmniaMessage(makeMsg());
    const parser = new OmniaFrameParser();
    parser.push(frame.slice(0, 4)); // partial frame
    parser.reset();
    const decoded = parser.push(frame);
    expect(decoded).toHaveLength(1);
  });

  it('preserves all message fields through encode→decode', () => {
    const msg: OmniaMessage = {
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-xyz',
      nonce: 42,
      payload: { localAmount: '600', remoteAmount: '400' },
      version: 1,
    };
    const [decoded] = new OmniaFrameParser().push(encodeOmniaMessage(msg));
    expect(decoded).toEqual(msg);
  });

  it('Uint8Array payload fields survive encode→decode round-trip', () => {
    const sig = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
    const msg: OmniaMessage = {
      type: 'STATE_UPDATE',
      channelId: 'ch-u8',
      nonce: 3,
      payload: {
        sequence: 1n,
        signatures: { alice: sig, bob: new Uint8Array([0xff, 0xee]) },
      },
    };
    const [decoded] = new OmniaFrameParser().push(encodeOmniaMessage(msg));
    const { signatures } = decoded.payload as { signatures: { alice: Uint8Array; bob: Uint8Array } };
    expect(signatures.alice).toBeInstanceOf(Uint8Array);
    expect(Array.from(signatures.alice)).toEqual([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
    expect(signatures.bob).toBeInstanceOf(Uint8Array);
    expect(Array.from(signatures.bob)).toEqual([0xff, 0xee]);
    expect((decoded.payload as any).sequence).toBe(1n);
  });

  it('Uint8Array transport boundary: STATE_UPDATE with real signature bytes survives peer send→receive', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSND' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xRCV' });

    const received: OmniaMessage[] = [];
    peerB.onMessage(msg => received.push(msg));

    const aliceSig = new Uint8Array(32).fill(0xab);
    const bobSig = new Uint8Array(32).fill(0xcd);

    await peerA.sendMessage({
      type: 'STATE_UPDATE',
      channelId: 'ch-sig',
      nonce: 5,
      payload: {
        sequence: 99n,
        balances: { alice: 600n, bob: 400n },
        signatures: { alice: aliceSig, bob: bobSig },
      },
    });
    await waitNextTick(8);

    expect(received).toHaveLength(1);
    const { signatures, sequence, balances } = received[0].payload as {
      signatures: { alice: Uint8Array; bob: Uint8Array };
      sequence: bigint;
      balances: { alice: bigint; bob: bigint };
    };
    expect(sequence).toBe(99n);
    expect(balances.alice).toBe(600n);
    expect(signatures.alice).toBeInstanceOf(Uint8Array);
    expect(signatures.alice).toHaveLength(32);
    expect(signatures.alice[0]).toBe(0xab);
    expect(signatures.bob).toBeInstanceOf(Uint8Array);
    expect(signatures.bob[0]).toBe(0xcd);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('malformed frame bytes: stream.destroy() is called, no uncaught throw', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peer = new OmniaPeerImpl(sideA, { pubkey: '0xMAL' });

    const received: OmniaMessage[] = [];
    peer.onMessage(msg => received.push(msg));

    // Send completely invalid bytes (not a valid length-prefixed frame)
    const garbage = Buffer.from([0x00, 0x00, 0x00, 0x04, 0xff, 0xfe, 0xfd]);
    sideB.send(garbage);
    await waitNextTick(8);

    // No valid message should arrive — stream should be destroyed, not throw uncaught
    expect(received).toHaveLength(0);
    peer.disconnect();
  });
});

// ── OmniaPeerImpl — message send/receive ──────────────────────────────────────

describe('OmniaPeerImpl message send/receive', () => {
  it('sends a message and the other side receives it', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xAABB' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCCDD' });

    const received: OmniaMessage[] = [];
    peerB.onMessage(msg => received.push(msg));

    await peerA.sendMessage(makeMsg({ type: 'STATE_UPDATE', nonce: 7 }));
    await waitNextTick(2);

    expect(received).toHaveLength(1);
    expect(received[0].nonce).toBe(7);
    expect(received[0].type).toBe('STATE_UPDATE');

    peerA.disconnect();
    peerB.disconnect();
  });

  it('round-trip: A → B and B → A', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xAA' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xBB' });

    const fromA: OmniaMessage[] = [];
    const fromB: OmniaMessage[] = [];
    peerA.onMessage(msg => fromA.push(msg));
    peerB.onMessage(msg => fromB.push(msg));

    await peerA.sendMessage(makeMsg({ nonce: 1 }));
    await peerB.sendMessage(makeMsg({ nonce: 2 }));
    await waitNextTick(4);

    expect(fromB[0].nonce).toBe(1);
    expect(fromA[0].nonce).toBe(2);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('onMessage unsubscribe stops delivery', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xAA' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xBB' });

    const received: OmniaMessage[] = [];
    const unsub = peerB.onMessage(msg => received.push(msg));

    await peerA.sendMessage(makeMsg({ nonce: 1 }));
    await waitNextTick(2);
    expect(received).toHaveLength(1);

    unsub();
    await peerA.sendMessage(makeMsg({ nonce: 2 }));
    await waitNextTick(2);
    expect(received).toHaveLength(1);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('rebindStream: existing subscribers receive messages from new stream', async () => {
    const [sideA1, sideB1] = createInMemoryPair();
    const peer = new OmniaPeerImpl(sideA1, { pubkey: '0xABCD' });

    const received: OmniaMessage[] = [];
    peer.onMessage(msg => received.push(msg));

    // First stream — send one message
    sideB1.send(encodeOmniaMessage(makeMsg({ nonce: 1 })));
    await waitNextTick(4);
    expect(received).toHaveLength(1);

    // Rebind to a new stream
    const [sideA2, sideB2] = createInMemoryPair();
    peer.rebindStream(sideA2);

    // New stream message should arrive via same subscriber
    sideB2.send(encodeOmniaMessage(makeMsg({ nonce: 2 })));
    await waitNextTick(4);

    expect(received).toHaveLength(2);
    expect(received[1].nonce).toBe(2);

    peer.disconnect();
  });

  it('rebindStream: suppresses stale reconnect timer', async () => {
    const reconnectFactory = jest.fn().mockResolvedValue(createInMemoryPair()[0]);
    const [sideA, sideB] = createInMemoryPair();
    const peer = new OmniaPeerImpl(sideA, {
      pubkey: '0xEFGH',
      maxReconnectAttempts: 3,
      reconnectBaseDelayMs: 50,
      reconnectFactory,
    });

    // Trigger close on sideA to schedule a reconnect
    sideB.close();
    await waitNextTick(2);

    // Before the reconnect timer fires, rebind manually
    const [newSideA] = createInMemoryPair();
    peer.rebindStream(newSideA);

    // Wait long enough for the timer to have fired
    await new Promise(r => setTimeout(r, 200));

    // Factory must NOT have been called because rebind suppressed the timer
    expect(reconnectFactory).not.toHaveBeenCalled();

    peer.disconnect();
  });

  it('sendMessage rejects when peer is disconnected', async () => {
    const [sideA] = createInMemoryPair();
    const peer = new OmniaPeerImpl(sideA, { pubkey: '0xAA' });
    peer.disconnect();
    await expect(peer.sendMessage(makeMsg())).rejects.toThrow('disconnected');
  });

  it('multiple messages arrive in order', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xAA' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xBB' });

    const received: number[] = [];
    peerB.onMessage(msg => received.push(msg.nonce));

    for (let i = 1; i <= 5; i++) {
      await peerA.sendMessage(makeMsg({ nonce: i }));
    }
    await waitNextTick(12);

    expect(received).toEqual([1, 2, 3, 4, 5]);

    peerA.disconnect();
    peerB.disconnect();
  });
});

// ── OmniaPeerImpl — reconnect with exponential backoff ────────────────────────

describe('OmniaPeerImpl reconnect backoff', () => {
  it('emits peer:reconnecting when stream closes and reconnect factory is set', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const reconnectAttempts: number[] = [];

    const reconnectFactory = () =>
      new Promise<IStreamTransport>(() => { /* never resolves — keeps peer in reconnecting state */ });

    const peer = new OmniaPeerImpl(sideA, {
      pubkey: '0xAA',
      reconnectBaseDelayMs: 10,
      maxReconnectAttempts: 3,
      reconnectFactory,
    });

    peer.onReconnecting(attempt => reconnectAttempts.push(attempt));

    // Simulate stream close from the remote side
    (sideB as any).simulateRemoteClose();

    // Wait enough real time for the 10ms backoff to fire (attempt 1)
    await new Promise(r => setTimeout(r, 50));

    expect(reconnectAttempts).toHaveLength(1);
    expect(reconnectAttempts[0]).toBe(1);

    peer.disconnect();
  });

  it('emits peer:reconnected after successful reconnect', async () => {
    jest.useFakeTimers();
    const [sideA] = createInMemoryPair();
    let reconnectedCalled = false;
    let resolveFactory!: (s: IStreamTransport) => void;

    const peer = new OmniaPeerImpl(sideA, {
      pubkey: '0xBB',
      reconnectBaseDelayMs: 100,
      maxReconnectAttempts: 3,
      reconnectFactory: () => new Promise(r => { resolveFactory = r; }),
    });

    peer.onReconnected(() => { reconnectedCalled = true; });

    // Trigger stream close
    (sideA as any)._deliverClose();

    jest.runAllTimers();
    await Promise.resolve();

    const [newA] = createInMemoryPair();
    resolveFactory(newA);
    await Promise.resolve();
    await Promise.resolve();

    expect(reconnectedCalled).toBe(true);

    jest.useRealTimers();
    peer.disconnect();
  });

  it('does not reconnect when no reconnectFactory is set', async () => {
    const [sideA] = createInMemoryPair();
    const reconnectAttempts: number[] = [];

    const peer = new OmniaPeerImpl(sideA, { pubkey: '0xCC' });
    peer.onReconnecting(n => reconnectAttempts.push(n));

    (sideA as any)._deliverClose();
    await waitNextTick(4);

    expect(reconnectAttempts).toHaveLength(0);
    peer.disconnect();
  });

  it('stops attempting after maxReconnectAttempts', async () => {
    jest.useFakeTimers();
    const [sideA] = createInMemoryPair();
    const reconnectAttempts: number[] = [];

    const peer = new OmniaPeerImpl(sideA, {
      pubkey: '0xDD',
      reconnectBaseDelayMs: 10,
      maxReconnectAttempts: 2,
      reconnectFactory: () => Promise.reject(new Error('refused')),
    });
    peer.onReconnecting(n => reconnectAttempts.push(n));

    (sideA as any)._deliverClose();
    jest.runAllTimers();
    await Promise.resolve();
    jest.runAllTimers();
    await Promise.resolve();
    jest.runAllTimers();
    await Promise.resolve();

    expect(reconnectAttempts.length).toBeLessThanOrEqual(2);

    jest.useRealTimers();
    peer.disconnect();
  });

  it('multi-cycle reconnect: close→reconnect→close→reconnect fires onReconnected each cycle', async () => {
    jest.useFakeTimers();

    const [sideA1, sideB1] = createInMemoryPair();
    const [sideA2, sideB2] = createInMemoryPair();
    const [sideA3] = createInMemoryPair();

    let factoryCall = 0;
    const reconnectFactory = jest.fn().mockImplementation(() => {
      factoryCall++;
      return Promise.resolve(
        factoryCall === 1 ? sideA2 : sideA3,
      );
    });

    const peer = new OmniaPeerImpl(sideA1, {
      pubkey: '0xMULTI',
      maxReconnectAttempts: 5,
      reconnectBaseDelayMs: 50,
      reconnectFactory,
    });

    const reconnectedFires: number[] = [];
    peer.onReconnected(() => reconnectedFires.push(Date.now()));

    // Cycle 1: close sideA1 → schedule reconnect → advance timer → sideA2 attached
    sideB1.close();
    await Promise.resolve();
    jest.advanceTimersByTime(100);
    await Promise.resolve(); await Promise.resolve();

    expect(reconnectFactory).toHaveBeenCalledTimes(1);
    expect(reconnectedFires).toHaveLength(1);

    // Cycle 2: close sideA2 → schedule reconnect → advance timer → sideA3 attached
    sideB2.close();
    await Promise.resolve();
    jest.advanceTimersByTime(200);
    await Promise.resolve(); await Promise.resolve();

    expect(reconnectFactory).toHaveBeenCalledTimes(2);
    expect(reconnectedFires).toHaveLength(2);

    peer.disconnect();
    jest.useRealTimers();
  });

  it('backoff delay doubles on each attempt', async () => {
    const delays: number[] = [];
    const origSetTimeout = global.setTimeout;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(
      (fn: TimerHandler, delay?: number) => {
        if (typeof delay === 'number' && delay >= 10) delays.push(delay);
        return origSetTimeout(fn as () => void, 0) as unknown as ReturnType<typeof setTimeout>;
      },
    );

    const [sideA] = createInMemoryPair();
    let callCount = 0;
    const peer = new OmniaPeerImpl(sideA, {
      pubkey: '0xEE',
      reconnectBaseDelayMs: 500,
      maxReconnectAttempts: 3,
      reconnectFactory: () => {
        callCount++;
        return Promise.reject(new Error('fail'));
      },
    });

    (sideA as any)._deliverClose();
    await waitNextTick(8);

    setTimeoutSpy.mockRestore();
    peer.disconnect();

    // First attempt: 500ms, second: 1000ms
    if (delays.length >= 1) expect(delays[0]).toBe(500);
    if (delays.length >= 2) expect(delays[1]).toBe(1000);
  });
});

// ── Integration: bindPeerIntegration ─────────────────────────────────────────

describe('bindPeerIntegration', () => {
  beforeEach(() => {
    mockAcceptChannel.mockReset();
    mockVerifyState.mockReset();
    mockSignState.mockReset();
    mockProposeSettlement.mockReset();
  });

  it('CHANNEL_PROPOSAL: calls acceptChannel, stores channel, sends ACK', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSERVER' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLIENT' });

    const fakeChannel = {
      channelId: 'ch-001',
      fundingTxId: 'tx-1',
      fundingCoinId: 'coin-1',
      fundingScript: 'script',
      fundingAddress: 'addr',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 1000n,
      parties: [],
      balances: { alice: 600n, bob: 400n },
      currentSequence: 0,
      pendingHTLCs: [],
      status: 'open' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      latestState: null,
    };
    mockAcceptChannel.mockReturnValue(fakeChannel);

    const store: ChannelStore = new Map();
    const acceptedChannels: string[] = [];
    bindPeerIntegration(peerA, store, {
      onChannelAccepted: ch => acceptedChannels.push(ch.channelId),
    });

    const acks: OmniaMessage[] = [];
    peerB.onMessage(msg => { if (msg.type === 'ACK') acks.push(msg); });

    await peerB.sendMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-001',
      nonce: 1,
      payload: { channelId: 'ch-001' },
    });
    await waitNextTick(6);

    expect(mockAcceptChannel).toHaveBeenCalledTimes(1);
    expect(store.has('ch-001')).toBe(true);
    expect(acceptedChannels).toContain('ch-001');
    expect(acks).toHaveLength(1);
    expect(acks[0].nonce).toBe(1);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('CHANNEL_PROPOSAL: sends ERROR when acceptChannel throws', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    mockAcceptChannel.mockImplementation(() => {
      throw new Error('Script mismatch');
    });

    const store: ChannelStore = new Map();
    bindPeerIntegration(peerA, store, {});

    const errors: OmniaMessage[] = [];
    peerB.onMessage(msg => { if (msg.type === 'ERROR') errors.push(msg); });

    await peerB.sendMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-bad',
      nonce: 5,
      payload: {},
    });
    await waitNextTick(6);

    expect(errors).toHaveLength(1);
    expect(errors[0].nonce).toBe(5);
    const errPayload = errors[0].payload as { error: string };
    expect(errPayload.error).toMatch('Script mismatch');
    expect(store.has('ch-bad')).toBe(false);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('STATE_UPDATE: unknown channel sends ERROR', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    const store: ChannelStore = new Map();
    bindPeerIntegration(peerA, store, {});

    const errors: OmniaMessage[] = [];
    peerB.onMessage(msg => { if (msg.type === 'ERROR') errors.push(msg); });

    await peerB.sendMessage(makeMsg({ type: 'STATE_UPDATE', channelId: 'non-existent' }));
    await waitNextTick(6);

    expect(errors).toHaveLength(1);
    const errPayload = errors[0].payload as { error: string };
    expect(errPayload.error).toMatch('Unknown channel');

    peerA.disconnect();
    peerB.disconnect();
  });

  it('STATE_UPDATE: verified state updates the store and sends ACK', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    mockVerifyState.mockResolvedValue({ valid: true, errors: [] });

    const existingChannel = {
      channelId: 'ch-002',
      fundingTxId: 'tx-2',
      fundingCoinId: 'coin-2',
      fundingScript: 'script',
      fundingAddress: 'addr',
      tokenId: '0x00',
      tokenScale: 0,
      totalValue: 1000n,
      parties: [],
      balances: { alice: 600n, bob: 400n },
      currentSequence: 1,
      pendingHTLCs: [],
      status: 'open' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      latestState: null,
    };
    const store: ChannelStore = new Map([['ch-002', existingChannel as any]]);

    const updatedChannels: string[] = [];
    const acks: OmniaMessage[] = [];
    bindPeerIntegration(peerA, store, {
      onStateUpdated: ch => updatedChannels.push(ch.channelId),
    });
    peerB.onMessage(msg => { if (msg.type === 'ACK') acks.push(msg); });

    const signedState = {
      sequence: 2,
      balances: { alice: 500n, bob: 500n },
      pendingHTLCs: [],
    };
    await peerB.sendMessage({
      type: 'STATE_UPDATE',
      channelId: 'ch-002',
      nonce: 2,
      payload: signedState,
    });
    await waitNextTick(8);

    expect(mockVerifyState).toHaveBeenCalledTimes(1);
    expect(updatedChannels).toContain('ch-002');
    expect(acks).toHaveLength(1);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('STATE_UPDATE: invalid state sends ERROR', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    mockVerifyState.mockResolvedValue({ valid: false, errors: ['bad signature'] });

    const store: ChannelStore = new Map([['ch-003', { channelId: 'ch-003' } as any]]);
    bindPeerIntegration(peerA, store, {});

    const errors: OmniaMessage[] = [];
    peerB.onMessage(msg => { if (msg.type === 'ERROR') errors.push(msg); });

    await peerB.sendMessage({
      type: 'STATE_UPDATE',
      channelId: 'ch-003',
      nonce: 3,
      payload: { sequence: 2 },
    });
    await waitNextTick(8);

    expect(errors).toHaveLength(1);
    const errPayload = errors[0].payload as { error: string };
    expect(errPayload.error).toMatch('bad signature');

    peerA.disconnect();
    peerB.disconnect();
  });

  it('SETTLEMENT_PROPOSAL: fires callback and sends ACK (no leaseProvider)', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    const settlements: unknown[] = [];
    const acks: OmniaMessage[] = [];
    bindPeerIntegration(peerA, new Map(), {
      onSettlementProposed: payload => settlements.push(payload),
    });
    peerB.onMessage(msg => { if (msg.type === 'ACK') acks.push(msg); });

    await peerB.sendMessage({
      type: 'SETTLEMENT_PROPOSAL',
      channelId: 'ch-settle',
      nonce: 10,
      payload: { finalTx: 'abc123' },
    });
    await waitNextTick(6);

    expect(settlements).toHaveLength(1);
    expect(acks).toHaveLength(1);
    expect(acks[0].nonce).toBe(10);
    expect(mockProposeSettlement).not.toHaveBeenCalled();

    peerA.disconnect();
    peerB.disconnect();
  });

  it('STATE_UPDATE: calls signState when leaseProvider is provided', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    mockVerifyState.mockResolvedValue({ valid: true, errors: [] });
    const fakePartialState = { sequence: 2, signatures: { alice: 'sig-a' } };
    mockSignState.mockResolvedValue(fakePartialState);

    const fakeLeaseProvider = { reserveKeyUse: jest.fn(), commitKeyUse: jest.fn() };
    const store: ChannelStore = new Map([['ch-sign', { channelId: 'ch-sign', currentSequence: 1, totalValue: 1000n, balances: { alice: 600n }, pendingHTLCs: [] } as any]]);

    const acks: OmniaMessage[] = [];
    bindPeerIntegration(peerA, store, { leaseProvider: fakeLeaseProvider });
    peerB.onMessage(msg => { if (msg.type === 'ACK') acks.push(msg); });

    await peerB.sendMessage({
      type: 'STATE_UPDATE',
      channelId: 'ch-sign',
      nonce: 5,
      payload: { sequence: 2, balances: { alice: 500n, bob: 500n }, pendingHTLCs: [] },
    });
    await waitNextTick(8);

    expect(mockSignState).toHaveBeenCalledTimes(1);
    expect(acks).toHaveLength(1);
    expect((acks[0].payload as any).partialState).toEqual(fakePartialState);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('SETTLEMENT_PROPOSAL: calls proposeSettlement when leaseProvider is provided', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    const fakeSettlementResult = {
      settlementPayload: { channelId: 'ch-settle2', finalSequence: 5 },
      partialState: { sequence: 5, signatures: {} },
    };
    mockProposeSettlement.mockResolvedValue(fakeSettlementResult);

    const fakeLeaseProvider = { reserveKeyUse: jest.fn() };
    const store: ChannelStore = new Map([['ch-settle2', { channelId: 'ch-settle2', status: 'active', parties: [], localSigner: null } as any]]);

    const settled: unknown[] = [];
    const acks: OmniaMessage[] = [];
    bindPeerIntegration(peerA, store, {
      leaseProvider: fakeLeaseProvider,
      onSettlementProposed: payload => settled.push(payload),
    });
    peerB.onMessage(msg => { if (msg.type === 'ACK') acks.push(msg); });

    await peerB.sendMessage({
      type: 'SETTLEMENT_PROPOSAL',
      channelId: 'ch-settle2',
      nonce: 11,
      payload: { partyAddresses: { alice: 'MxAAA', bob: 'MxBBB' } },
    });
    await waitNextTick(8);

    expect(mockProposeSettlement).toHaveBeenCalledTimes(1);
    expect(settled).toHaveLength(1);
    expect(settled[0]).toEqual(fakeSettlementResult.settlementPayload);
    expect(acks).toHaveLength(1);
    expect((acks[0].payload as any).settlementPayload).toEqual(fakeSettlementResult.settlementPayload);

    peerA.disconnect();
    peerB.disconnect();
  });

  it('SETTLEMENT_PROPOSAL: sends ERROR for unknown channel when leaseProvider is set', async () => {
    const [sideA, sideB] = createInMemoryPair();
    const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSRV' });
    const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLI' });

    const fakeLeaseProvider = { reserveKeyUse: jest.fn() };
    const store: ChannelStore = new Map();

    const errors: OmniaMessage[] = [];
    const acks: OmniaMessage[] = [];
    bindPeerIntegration(peerA, store, { leaseProvider: fakeLeaseProvider });
    peerB.onMessage(msg => {
      if (msg.type === 'ERROR') errors.push(msg);
      if (msg.type === 'ACK') acks.push(msg);
    });

    await peerB.sendMessage({
      type: 'SETTLEMENT_PROPOSAL',
      channelId: 'ch-unknown-settle',
      nonce: 99,
      payload: {},
    });
    await waitNextTick(8);

    expect(errors).toHaveLength(1);
    expect((errors[0].payload as any).error).toMatch('Unknown channel');
    expect(acks).toHaveLength(0);
    expect(mockProposeSettlement).not.toHaveBeenCalled();

    peerA.disconnect();
    peerB.disconnect();
  });

});

// ── OmniaSwarmImpl (mock swarm) ───────────────────────────────────────────────

describe('OmniaSwarmImpl with mock swarm', () => {
  function makeMockHyperswarm() {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        (listeners[event] ??= []).push(cb);
      },
      once: (event: string, cb: (...args: unknown[]) => void) => {
        const wrapper = (...args: unknown[]) => {
          cb(...args);
          listeners[event] = (listeners[event] ?? []).filter(l => l !== wrapper);
        };
        (listeners[event] ??= []).push(wrapper);
      },
      join: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      removeListener: (event: string, cb: (...args: unknown[]) => void) => {
        listeners[event] = (listeners[event] ?? []).filter(l => l !== cb);
      },
      _emit: (event: string, ...args: unknown[]) => {
        for (const cb of listeners[event] ?? []) cb(...args);
      },
    };
  }

  it('listenForChannels: joins the channels topic on the swarm', () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    swarmImpl.listenForChannels(() => {});

    expect(mockSwarm.join).toHaveBeenCalledTimes(1);
    const topicArg = (mockSwarm.join as jest.Mock).mock.calls[0][0] as Buffer;
    expect(Buffer.isBuffer(topicArg)).toBe(true);
    expect(topicArg.length).toBe(32);
  });

  it('listenForChannels: inbound CHANNEL_PROPOSAL triggers onProposal callback', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const proposals: OmniaMessage[] = [];
    swarmImpl.listenForChannels((_peer, msg) => proposals.push(msg));

    // Simulate inbound Hyperswarm connection carrying a CHANNEL_PROPOSAL.
    // InMemoryTransport has send(), so _adaptConn returns it as-is.
    const [connA, connB] = createInMemoryPair();
    mockSwarm._emit('connection', connB, { publicKey: Buffer.alloc(32, 0xab), topics: [] });

    connA.send(encodeOmniaMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-swarm-001',
      nonce: 1,
      payload: { test: true },
    }));

    await waitNextTick(6);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].channelId).toBe('ch-swarm-001');
  });

  it('listenForChannels unsubscribe stops the callback', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const proposals: OmniaMessage[] = [];
    const unsub = swarmImpl.listenForChannels((_peer, msg) => proposals.push(msg));
    unsub();

    const [connA, connB] = createInMemoryPair();
    mockSwarm._emit('connection', connB, { publicKey: Buffer.alloc(32, 0x01), topics: [] });
    connA.send(encodeOmniaMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-ignore',
      nonce: 9,
      payload: {},
    }));
    await waitNextTick(6);

    expect(proposals).toHaveLength(0);
  });

  it('close() destroys the swarm and disconnects all peers', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    await swarmImpl.close();
    expect(mockSwarm.destroy).toHaveBeenCalled();
  });

  it('assigns pubkey from info.publicKey on inbound connection', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const expectedPubkey = Buffer.alloc(32, 0xcc).toString('hex');
    const receivedPubkeys: string[] = [];

    swarmImpl.listenForChannels((peer) => {
      receivedPubkeys.push(peer.pubkey);
    });

    const [connA, connB] = createInMemoryPair();
    mockSwarm._emit('connection', connB, { publicKey: Buffer.alloc(32, 0xcc), topics: [] });
    connA.send(encodeOmniaMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-pk',
      nonce: 1,
      payload: {},
    }));
    await waitNextTick(6);

    expect(receivedPubkeys[0]).toBe(expectedPubkey);
  });

  it('peers registered via info.topics are tracked for broadcast', async () => {
    const { channelTopic: ct } = require('../topic');
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const broadcastTopicHex = ct('my-channel').toString('hex');

    const [connA, connB] = createInMemoryPair();
    mockSwarm._emit('connection', connB, {
      publicKey: Buffer.alloc(32, 0xdd),
      topics: [Buffer.from(broadcastTopicHex, 'hex')],
    });

    const received: OmniaMessage[] = [];
    const connAParser = new OmniaFrameParser();
    connA.on('data', (chunk: Uint8Array) => {
      connAParser.push(chunk).forEach(m => received.push(m));
    });

    await swarmImpl.broadcast('my-channel', makeMsg({ type: 'STATE_UPDATE', nonce: 99 }));
    await waitNextTick(4);

    expect(received).toHaveLength(1);
    expect(received[0].nonce).toBe(99);

    await swarmImpl.close();
  });

  it('advertise: joins peerTopic(localPubkey) as server', () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);
    const localPubkey = Buffer.alloc(32, 0x11).toString('hex');

    swarmImpl.advertise(localPubkey);

    expect(mockSwarm.join).toHaveBeenCalledTimes(1);
    const [topicArg, opts] = (mockSwarm.join as jest.Mock).mock.calls[0];
    expect(topicArg).toBeInstanceOf(Buffer);
    expect(topicArg.length).toBe(32);
    expect(opts.server).toBe(true);
    expect(opts.client).toBe(false);
  });

  it('advertise: repeated calls for same pubkey are no-ops', () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);
    const localPubkey = Buffer.alloc(32, 0x22).toString('hex');

    swarmImpl.advertise(localPubkey);
    swarmImpl.advertise(localPubkey);

    expect(mockSwarm.join).toHaveBeenCalledTimes(1);
  });

  it('config.localPubkey auto-advertises on construction', () => {
    const mockSwarm = makeMockHyperswarm();
    const localPubkey = Buffer.alloc(32, 0x33).toString('hex');
    const swarmImpl = new OmniaSwarmImpl(mockSwarm, { localPubkey });
    void swarmImpl;

    expect(mockSwarm.join).toHaveBeenCalledTimes(1);
    const opts = (mockSwarm.join as jest.Mock).mock.calls[0][1];
    expect(opts.server).toBe(true);
  });

  it('same-pubkey reconnect N times: one message triggers callback exactly once', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const proposals: OmniaMessage[] = [];
    swarmImpl.listenForChannels((_peer, msg) => proposals.push(msg));

    const pubkeyBuf = Buffer.alloc(32, 0x55);

    // Connect and reconnect 3 times from the same pubkey
    for (let cycle = 0; cycle < 3; cycle++) {
      const [connA] = createInMemoryPair();
      mockSwarm._emit('connection', connA, { publicKey: pubkeyBuf, topics: [] });
    }

    // The last connection is what's active — send one CHANNEL_PROPOSAL
    const [lastConnA, lastConnB] = createInMemoryPair();
    mockSwarm._emit('connection', lastConnA, { publicKey: pubkeyBuf, topics: [] });

    lastConnB.send(encodeOmniaMessage({
      type: 'CHANNEL_PROPOSAL',
      channelId: 'ch-nodup',
      nonce: 7,
      payload: {},
    }));
    await waitNextTick(8);

    // Despite 4 connections from same pubkey, callback fires exactly once
    expect(proposals).toHaveLength(1);
    expect(proposals[0].channelId).toBe('ch-nodup');

    await swarmImpl.close();
  });

  it('same-pubkey inbound connection rebinds stream, preserves subscribers', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const received: OmniaMessage[] = [];

    // First connection from pubkey 0xAA
    const [connA1, connB1] = createInMemoryPair();
    mockSwarm._emit('connection', connB1, { publicKey: Buffer.alloc(32, 0xaa), topics: [] });

    let capturedPeer: OmniaPeer | null = null;
    swarmImpl.listenForChannels((peer) => { capturedPeer = peer; });
    connA1.send(encodeOmniaMessage(makeMsg({ type: 'CHANNEL_PROPOSAL', nonce: 1 })));
    await waitNextTick(6);

    // Wire up a message listener on the captured peer
    capturedPeer!.onMessage((msg: OmniaMessage) => received.push(msg));

    // Second inbound connection from the SAME pubkey (reconnect/churn)
    const [connA2, connB2] = createInMemoryPair();
    mockSwarm._emit('connection', connB2, { publicKey: Buffer.alloc(32, 0xaa), topics: [] });

    // Old stream is gone; send via new stream — subscriber must still receive it
    connA2.send(encodeOmniaMessage(makeMsg({ nonce: 99 })));
    await waitNextTick(6);

    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received.at(-1)!.nonce).toBe(99);

    await swarmImpl.close();
  });

  it('connectToPeer: resolves only when the matching pubkey connects', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const targetPubkey = Buffer.alloc(32, 0xee).toString('hex');

    const peerPromise = swarmImpl.connectToPeer(targetPubkey);

    // First, fire a connection from a DIFFERENT peer — should be ignored
    const [_a1, connB1] = createInMemoryPair();
    mockSwarm._emit('connection', connB1, {
      publicKey: Buffer.alloc(32, 0xff),
      topics: [],
    });

    // Now fire from the correct peer
    const [, connB2] = createInMemoryPair();
    mockSwarm._emit('connection', connB2, {
      publicKey: Buffer.alloc(32, 0xee),
      topics: [],
    });

    const peer = await peerPromise;
    expect(peer.pubkey).toBe(targetPubkey);

    await swarmImpl.close();
  });

  it('connectToPeer: returned peer can send and receive messages (no stream double-destroy)', async () => {
    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);

    const remotePubkey = Buffer.alloc(32, 0xbb).toString('hex');

    const peerPromise = swarmImpl.connectToPeer(remotePubkey);

    // Simulate the remote node connecting (connA is "our" side, connB is "their" side)
    const [connA, connB] = createInMemoryPair();
    mockSwarm._emit('connection', connA, {
      publicKey: Buffer.alloc(32, 0xbb),
      topics: [],
    });

    const peer = await peerPromise;
    expect(peer.pubkey).toBe(remotePubkey);

    const received: OmniaMessage[] = [];
    peer.onMessage(msg => received.push(msg));

    // Remote side writes a message
    connB.send(encodeOmniaMessage(makeMsg({ nonce: 42 })));
    await waitNextTick(6);

    expect(received).toHaveLength(1);
    expect(received[0].nonce).toBe(42);

    // We must also be able to send back
    const acks: OmniaMessage[] = [];
    const connBParser = new OmniaFrameParser();
    connB.on('data', (chunk: Uint8Array) => {
      connBParser.push(chunk).forEach(m => acks.push(m));
    });

    await peer.sendMessage(makeMsg({ nonce: 43 }));
    await waitNextTick(4);

    expect(acks).toHaveLength(1);
    expect(acks[0].nonce).toBe(43);

    await swarmImpl.close();
  });

  it('duplicate CHANNEL_PROPOSAL: bindPeerIntegration called exactly once per peer', async () => {
    mockAcceptChannel.mockReset();
    mockVerifyState.mockReset();

    mockAcceptChannel.mockImplementation((proposal: { channelId?: string }) => ({
      channelId: proposal?.channelId ?? 'ch-fallback',
      currentSequence: 0,
      totalValue: 0n,
      balances: {},
      pendingHTLCs: [],
    }));
    mockVerifyState.mockResolvedValue({ valid: false, errors: ['test-only'] });

    const mockSwarm = makeMockHyperswarm();
    const swarmImpl = new OmniaSwarmImpl(mockSwarm);
    const store: ChannelStore = new Map();

    const channelIds: string[] = [];
    createOmniaIntegration(swarmImpl, store, {
      onChannelAccepted: ch => channelIds.push(ch.channelId),
    });

    // Simulate an inbound connection
    const [connA, connB] = createInMemoryPair();
    const pubkeyBuf = Buffer.alloc(32, 0x11);
    mockSwarm._emit('connection', connA, { publicKey: pubkeyBuf, topics: [] });
    await waitNextTick(2);

    // Send three CHANNEL_PROPOSAL messages from the same peer (retransmits)
    for (let i = 0; i < 3; i++) {
      connB.send(encodeOmniaMessage({
        type: 'CHANNEL_PROPOSAL',
        channelId: `ch-dup-${i}`,
        nonce: i + 1,
        payload: {},
      }));
    }
    await waitNextTick(16);

    // Each proposal should create its own channel entry
    expect(channelIds).toHaveLength(3);

    // Now send ONE STATE_UPDATE — idempotent binding must produce exactly 1 response
    const stateResponses: OmniaMessage[] = [];
    const peerObj = (swarmImpl as any)._peers.get(pubkeyBuf.toString('hex'));
    peerObj?.onMessage((msg: OmniaMessage) => stateResponses.push(msg));

    connB.send(encodeOmniaMessage({
      type: 'STATE_UPDATE',
      channelId: 'ch-dup-0',
      nonce: 10,
      payload: { sequence: 2, balances: {}, pendingHTLCs: [] },
    }));
    await waitNextTick(16);

    expect(stateResponses.length).toBe(1);

    await swarmImpl.close();
  });
});

// ── createOmniaIntegration ────────────────────────────────────────────────────

describe('createOmniaIntegration', () => {
  it('wires listenForChannels on the swarm', () => {
    const mockSwarm = {
      advertise: jest.fn(),
      listenForChannels: jest.fn().mockReturnValue(() => {}),
      connectToPeer: jest.fn(),
      broadcast: jest.fn(),
      close: jest.fn(),
    };

    const store: ChannelStore = new Map();
    const unsub = createOmniaIntegration(mockSwarm, store);
    expect(mockSwarm.listenForChannels).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('unsubscribe calls the inner unsub returned by listenForChannels', () => {
    const innerUnsub = jest.fn();
    const mockSwarm = {
      advertise: jest.fn(),
      listenForChannels: jest.fn().mockReturnValue(innerUnsub),
      connectToPeer: jest.fn(),
      broadcast: jest.fn(),
      close: jest.fn(),
    };

    const unsub = createOmniaIntegration(mockSwarm, new Map());
    unsub();
    expect(innerUnsub).toHaveBeenCalledTimes(1);
  });
});

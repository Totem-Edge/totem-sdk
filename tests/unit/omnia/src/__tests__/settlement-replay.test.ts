/**
 * OMN-028 — settlement co-signatures are replay-guarded per channel/sequence.
 *
 * A durable store can serve an identical retry from cache, while a different
 * settlement for the same channel+sequence must be refused.
 */

import { createInMemoryPair } from '@totemsdk/stream-transport';
import { OmniaPeerImpl } from '../peer.js';
import { bindPeerIntegration, type ChannelStore } from '../integration.js';
import type { OmniaChannel } from '../types.js';

const CHANNEL_ID = '0x' + 'ab'.repeat(32);
const DIGEST_A = '0x' + 'aa'.repeat(32);
const DIGEST_B = '0x' + 'bb'.repeat(32);

function channel(): OmniaChannel {
  return {
    channelId: CHANNEL_ID,
    fundingTxId: '0x' + 'ef'.repeat(32),
    fundingCoinId: '0x' + 'cc'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + 'dd'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: '0x' + '11'.repeat(32), addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: '0x' + '22'.repeat(32), addressIndex: 1 },
    ],
    balances: { alice: 600n, bob: 400n },
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

function durableStore(entries: Record<string, unknown>) {
  const data = new Map(Object.entries(entries));
  return {
    get: <T,>(key: string): T | null => (data.get(key) as T | undefined) ?? null,
    set: <T,>(key: string, value: T): void => { data.set(key, value); },
    data,
  };
}

const CACHED = {
  ok: true,
  signRequest: true,
  partyId: 'bob',
  signature: '0x' + '99'.repeat(32),
  indices: { addressIndex: 0, l1: 7, l2: 0 },
};

async function harness(store: ReturnType<typeof durableStore>) {
  const [sideA, sideB] = createInMemoryPair();
  const peerA = new OmniaPeerImpl(sideA, { pubkey: '0xSERVER' });
  const peerB = new OmniaPeerImpl(sideB, { pubkey: '0xCLIENT' });
  const channels: ChannelStore = new Map([[CHANNEL_ID, channel()]]);
  bindPeerIntegration(peerA, channels, {
    leaseProvider: { reserveKeyUse: jest.fn() } as never,
    settlementReplayStore: store,
  });
  const replies: Array<{ type: string; nonce: number; payload: any }> = [];
  peerB.onMessage((msg) => replies.push(msg as never));
  const send = async (nonce: number, digestHex: string) => {
    await peerB.sendMessage({
      type: 'SETTLEMENT_PROPOSAL',
      channelId: CHANNEL_ID,
      nonce,
      payload: {
        signRequest: true,
        channelId: CHANNEL_ID,
        sequence: 1,
        settlementTxHex: '0x00',
        digestHex,
        partyAddresses: { alice: channel().fundingAddress, bob: channel().fundingAddress },
      },
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 20));
    return replies.at(-1)!;
  };
  return { send, replies, peerA, peerB, channels };
}

describe('OMN-028 settlement replay defense', () => {
  it('serves an identical retry from the durable cache', async () => {
    const store = durableStore({
      [`settlement-sign:${CHANNEL_ID}:1:${DIGEST_A}`]: CACHED,
      [`settlement-seq:${CHANNEL_ID}:1`]: DIGEST_A,
    });
    const { send, peerA, peerB } = await harness(store);
    const reply = await send(1, DIGEST_A);
    expect(reply.type).toBe('ACK');
    expect(reply.payload).toEqual(CACHED);
    peerA.disconnect();
    peerB.disconnect();
  });

  it('refuses a different settlement for the same channel and sequence', async () => {
    const store = durableStore({
      [`settlement-seq:${CHANNEL_ID}:1`]: DIGEST_A,
    });
    const { send, peerA, peerB } = await harness(store);
    const reply = await send(2, DIGEST_B);
    expect(reply.type).toBe('ERROR');
    expect(reply.payload.error).toMatch(/conflicting settlement request/);
    // Nothing was signed or cached for the conflicting request.
    expect(store.data.has(`settlement-sign:${CHANNEL_ID}:1:${DIGEST_B}`)).toBe(false);
    peerA.disconnect();
    peerB.disconnect();
  });
});

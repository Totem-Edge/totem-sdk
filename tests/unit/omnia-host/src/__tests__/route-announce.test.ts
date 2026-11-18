/**
 * OMN-044 — route announcements are authenticated against real local channels
 * before they can influence route discovery.
 */

import { createOmniaHost } from '../lifecycle.js';
import type { ChannelGraphEdge } from '@totemsdk/omnia-router';

const ALICE = '0x' + 'aa'.repeat(32);
const BOB = '0x' + 'bb'.repeat(32);
const CAROL = '0x' + 'cc'.repeat(32);

const config = {
  port: 50053,
  host: '127.0.0.1',
  dbPath: '/tmp/omnia-route.sqlite',
  chainRpcUrl: 'http://127.0.0.1:9005',
  wsPath: '/rpc',
  readOnly: false,
  serviceType: 'omnia-router',
};

function channel() {
  return {
    channelId: 'route-ch-1',
    fundingTxId: '0x' + '11'.repeat(32),
    fundingCoinId: '0x' + '22'.repeat(32),
    fundingScript: 'RETURN TRUE',
    programId: 'eltoo-payment',
    programVersion: 1,
    fundingAddress: '0x' + '33'.repeat(32),
    tokenId: '0x00',
    tokenScale: 0,
    totalValue: 1_000_000n,
    parties: [
      { partyId: 'alice', publicKeyDigest: ALICE, addressIndex: 0 },
      { partyId: 'bob', publicKeyDigest: BOB, addressIndex: 1 },
    ],
    balances: { alice: 600_000n, bob: 400_000n },
    pendingHTLCs: [],
    currentSequence: 0,
    latestState: null,
    stateLog: [],
    status: 'active',
    channelType: 'direct',
    createdAt: 1,
    updatedAt: 1,
  } as any;
}

async function harness(peerPubkey: string = BOB) {
  const rebuild = jest.fn();
  let deliver: ((msg: any) => void) | undefined;
  const peer = {
    pubkey: peerPubkey,
    channelId: '',
    sendMessage: jest.fn(async () => undefined),
    onMessage: (cb: (msg: any) => void) => {
      deliver = cb;
      return () => { deliver = undefined; };
    },
    onReconnected: jest.fn(() => () => {}),
    disconnect: jest.fn(),
    isConnected: jest.fn(() => true),
  };
  const swarm = {
    advertise: jest.fn(),
    connectToPeer: jest.fn(async () => peer),
    listenForChannels: jest.fn((cb: (p: any, m: any) => void) => {
      (swarm as any).emit = (msg: any) => cb(peer, msg);
      return () => undefined;
    }),
    broadcast: jest.fn(),
    close: jest.fn(async () => undefined),
  };
  const channels = new Map([['route-ch-1', channel()]]);
  const host = createOmniaHost(config, {
    channelStore: channels,
    operationStore: { close: jest.fn() },
    swarm: swarm as any,
    routingProvider: { rebuild } as any,
    controlServer: { listen: jest.fn(async () => undefined), close: jest.fn(async () => undefined) },
  });
  await host.start();
  return { host, swarm: swarm as any, rebuild, peer };
}

function lastEdges(rebuild: jest.Mock): ChannelGraphEdge[] {
  const call = rebuild.mock.calls.at(-1);
  return call ? [...call[0]] : [];
}

describe('OMN-044 route announcements', () => {
  it('ignores edges for channels the host does not hold', async () => {
    const { host, swarm, rebuild } = await harness();
    try {
      swarm.emit({
        type: 'ROUTE_GRAPH_ANNOUNCE',
        channelId: 'route-graph',
        nonce: 1,
        payload: {
          hop: 0,
          edges: [{
            channelId: 'fake-channel',
            from: ALICE,
            to: BOB,
            tokenId: '0x00',
            availableBalance: '1000000',
            htlcCapacity: '1000000',
            feeRate: '0',
          }],
        },
      });
      const ids = lastEdges(rebuild).map((edge) => edge.channelId);
      expect(ids).not.toContain('fake-channel');
    } finally {
      await host.close();
    }
  });

  it('ignores announcements from a peer that is not a channel participant', async () => {
    const { host, swarm, rebuild } = await harness(CAROL);
    try {
      swarm.emit({
        type: 'ROUTE_GRAPH_ANNOUNCE',
        channelId: 'route-graph',
        nonce: 2,
        payload: {
          hop: 0,
          edges: [{
            channelId: 'route-ch-1',
            from: ALICE,
            to: BOB,
            tokenId: '0x00',
            availableBalance: '600000',
            htlcCapacity: '600000',
            feeRate: '0',
          }],
        },
      });
      // Only locally derived edges exist (rebuild may not even run); nothing was imported.
      expect(rebuild).not.toHaveBeenCalled();
    } finally {
      await host.close();
    }
  });

  it('clamps an authenticated announcement to the real channel capacity', async () => {
    const { host, swarm, rebuild } = await harness();
    try {
      swarm.emit({
        type: 'ROUTE_GRAPH_ANNOUNCE',
        channelId: 'route-graph',
        nonce: 3,
        payload: {
          hop: 0,
          edges: [{
            channelId: 'route-ch-1',
            from: ALICE,
            to: BOB,
            tokenId: '0x00',
            // Inflated claim: the channel only carries 600000 atoms for alice.
            availableBalance: '999999999',
            htlcCapacity: '999999999',
            feeRate: '0',
          }],
        },
      });
      const edge = lastEdges(rebuild).find(
        (candidate) => candidate.channelId === 'route-ch-1' && candidate.from === ALICE,
      );
      expect(edge).toBeDefined();
      expect(edge!.availableBalance).toBeLessThanOrEqual(600_000n);
      expect(edge!.htlcCapacity).toBeLessThanOrEqual(1_000_000n);
    } finally {
      await host.close();
    }
  });

  it('drops oversized announcements instead of importing them', async () => {
    const { host, swarm, rebuild } = await harness();
    try {
      swarm.emit({
        type: 'ROUTE_GRAPH_ANNOUNCE',
        channelId: 'route-graph',
        nonce: 4,
        payload: {
          hop: 0,
          edges: Array.from({ length: 300 }, (_, index) => ({
            channelId: `route-ch-${index}`,
            from: ALICE,
            to: BOB,
            tokenId: '0x00',
            availableBalance: '1',
            htlcCapacity: '1',
            feeRate: '0',
          })),
        },
      });
      const ids = lastEdges(rebuild).map((edge) => edge.channelId);
      expect(ids.every((id) => id === 'route-ch-1')).toBe(true);
    } finally {
      await host.close();
    }
  });
});

/**
 * @totemsdk/omnia-relay — composed wallet client (RFC-034 Phase A).
 */

import { createOmniaRelayClient } from '../client.js';
import { createChannelRoutingPort } from '../routing.js';
import type { RoutingPort } from '../routing.js';
import type { OmniaSwarm, OmniaPeer, OmniaChannel } from '@totemsdk/omnia';
import type { ChannelGraphEdge, SwapAnnouncement } from '@totemsdk/omnia-router';

function fakeSwarm(): OmniaSwarm {
  return {
    advertise: jest.fn(),
    connectToPeer: jest.fn(async () => ({}) as OmniaPeer),
    listenForChannels: jest.fn(() => () => {}),
    broadcast: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  } as unknown as OmniaSwarm;
}

const edge = (
  channelId: string,
  from: string,
  to: string,
  availableBalance: bigint,
): ChannelGraphEdge => ({
  channelId,
  from,
  to,
  tokenId: '0x00',
  availableBalance,
  htlcCapacity: availableBalance,
  feeRate: 0n,
});

function topology(): RoutingPort {
  return {
    snapshot: () => [
      edge('ch-ab', 'alice', 'bob', 1_000_000n),
      edge('ch-bc', 'bob', 'carol', 1_000_000n),
    ],
  };
}

describe('createOmniaRelayClient — base inheritance', () => {
  it('serves the base channel registry', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm() });
    const result = (await client.getChannels()) as { success: boolean; channels: unknown[] };
    expect(result.success).toBe(true);
    expect(result.channels).toEqual([]);
    await client.close();
  });
});

describe('createOmniaRelayClient — getRoute / getSwapRate (RFC-034 A0)', () => {
  it('finds a multi-hop route from the injected topology', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm(), routing: topology() });
    const result = (await client.getRoute({
      fromPartyId: 'alice',
      toPartyId: 'carol',
      amount: 100n,
      tokenId: '0x00',
    })) as { success: boolean; route: { hops: unknown[]; totalFees: string } };
    expect(result.success).toBe(true);
    expect(result.route.hops).toHaveLength(2);
    // bigints are serialized to decimal strings on the wire.
    expect(typeof result.route.totalFees).toBe('string');
    await client.close();
  });

  it('returns ROUTE_NOT_FOUND when no path exists', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm(), routing: topology() });
    const result = (await client.getRoute({
      fromPartyId: 'alice',
      toPartyId: 'dave',
      amount: 100n,
      tokenId: '0x00',
    })) as { success: boolean; errorCode: string };
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROUTE_NOT_FOUND');
    await client.close();
  });

  it('returns announced cross-token swaps from the injected topology', async () => {
    const swap: SwapAnnouncement = {
      intermediaryPubKey: 'bob',
      tokenIn: '0x00',
      tokenOut: '0xFEED',
      rate: '0.95',
      inboundChannelId: 'ch-ab',
      outboundChannelId: 'ch-bc',
      maxAmountIn: 1_000n,
    };
    const routing: RoutingPort = { snapshot: topology().snapshot, swaps: () => [swap] };
    const client = createOmniaRelayClient({ swarm: fakeSwarm(), routing });
    const result = (await client.getSwapRate({ tokenIn: '0x00', tokenOut: '0xFEED' })) as {
      success: boolean;
      announcements: Array<{ rate: string; maxAmountIn: string }>;
    };
    expect(result.success).toBe(true);
    expect(result.announcements).toHaveLength(1);
    expect(result.announcements[0].rate).toBe('0.95');
    expect(result.announcements[0].maxAmountIn).toBe('1000');
    await client.close();
  });
});

describe('createOmniaRelayClient — routing source ladder (RFC-034 §6.1)', () => {
  const channel = (): OmniaChannel =>
    ({
      channelId: 'ch-own',
      status: 'open',
      tokenId: '0x00',
      totalValue: 1_000_000n,
      currentSequence: 1,
      parties: [
        { partyId: 'alice', publicKeyDigest: 'alice', addressIndex: 0 },
        { partyId: 'bob', publicKeyDigest: 'bob', addressIndex: 1 },
      ],
      pendingHTLCs: [],
      balances: { alice: 1_000_000n, bob: 0n },
    }) as unknown as OmniaChannel;

  it('returns explicit UNSUPPORTED when no graph source and no own channels', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm() });
    const route = (await client.getRoute({
      fromPartyId: 'alice',
      toPartyId: 'bob',
      amount: 1n,
      tokenId: '0x00',
    })) as { success: boolean; errorCode: string; error: string };
    expect(route.success).toBe(false);
    expect(route.errorCode).toBe('UNSUPPORTED');
    expect(route.error).toMatch(/no routing graph configured/);

    const swap = (await client.getSwapRate({ tokenIn: '0x00', tokenOut: '0xFEED' })) as {
      errorCode: string;
    };
    expect(swap.errorCode).toBe('UNSUPPORTED');

    // supports() mirrors the refusal (RFC-014 Amendment A truthfulness).
    const verdict = client.supports('getRoute');
    expect(typeof verdict === 'boolean' ? verdict : verdict.supported).toBe(false);
    await client.close();
  });

  it('falls back to the wallet\'s own channels (source #2)', async () => {
    const client = createOmniaRelayClient({
      swarm: fakeSwarm(),
      channels: new Map([['ch-own', channel()]]),
    });
    const result = (await client.getRoute({
      fromPartyId: 'alice',
      toPartyId: 'bob',
      amount: 100n,
      tokenId: '0x00',
    })) as { success: boolean; route: { hops: unknown[] } };
    expect(result.success).toBe(true);
    expect(result.route.hops).toHaveLength(1);
    expect(client.supports('getRoute')).toBe(true);
    await client.close();
  });

  it('createChannelRoutingPort adapts a live channel source', async () => {
    const port = createChannelRoutingPort(() => [channel()]);
    const edges = [...port.snapshot()];
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ channelId: 'ch-own', from: 'alice', to: 'bob' });
  });
});

describe('createOmniaRelayClient — single-party refusals without signing material', () => {
  it('returns reasoned UNSUPPORTED for createFactory without material', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm() });
    const result = (await client.createFactory({})) as { errorCode: string; error: string };
    expect(result.errorCode).toBe('UNSUPPORTED');
    expect(result.error).toMatch(/signing material/);
    await client.close();
  });

  it('returns reasoned UNSUPPORTED for spliceIn without material', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm() });
    const result = (await client.spliceIn({ channelId: 'c1' })) as { errorCode: string };
    expect(result.errorCode).toBe('UNSUPPORTED');
    await client.close();
  });
});

describe('createOmniaRelayClient — supports() truth table (RFC-014 Amendment A)', () => {
  const verdict = (v: boolean | { supported: boolean }) => (typeof v === 'boolean' ? v : v.supported);

  it('reports routing supported and Phase B unsupported', async () => {
    const client = createOmniaRelayClient({ swarm: fakeSwarm(), routing: topology() });
    expect(client.supports('getRoute')).toBe(true);
    expect(client.supports('totem_omniaGetSwapRate')).toBe(true);
    // Phase B methods stay unsupported.
    expect(verdict(client.supports('openVirtualChannel'))).toBe(false);
    expect(verdict(client.supports('closeFactory'))).toBe(false);
    expect(verdict(client.supports('payMultiHop'))).toBe(false);
    await client.close();
  });

  it('reports single-party mutators unsupported without material, supported with it', async () => {
    const bare = createOmniaRelayClient({ swarm: fakeSwarm() });
    expect(verdict(bare.supports('createFactory'))).toBe(false);
    expect(verdict(bare.supports('spliceIn'))).toBe(false);
    await bare.close();

    const wired = createOmniaRelayClient({
      swarm: fakeSwarm(),
      signer: { publicKeyDigest: 'aa', sign: async () => new Uint8Array() } as never,
      leaseProvider: { reserveKeyUse: async () => ({}), commitKeyUse: async () => {}, burnReservation: async () => {} } as never,
      chainProvider: {} as never,
    });
    expect(verdict(wired.supports('createFactory'))).toBe(true);
    expect(verdict(wired.supports('totem_omniaSpliceOut'))).toBe(true);
    await wired.close();
  });
});

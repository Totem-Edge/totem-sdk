/**
 * Browser-safe Omnia relay client (RFC-014 §6.3).
 */

import {
  AXIA_RELAY_URL,
  relaySwarmUrl,
  createRelayOmniaClient,
} from '../relay-client.js';
import type { OmniaSwarm, OmniaPeer } from '../messaging-types.js';

function fakeSwarm(): OmniaSwarm {
  return {
    advertise: jest.fn(),
    connectToPeer: jest.fn(async () => ({}) as OmniaPeer),
    listenForChannels: jest.fn(() => () => {}),
    broadcast: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
}

describe('relay swarm URL', () => {
  it('defaults to the Axia relay', () => {
    expect(relaySwarmUrl()).toBe(AXIA_RELAY_URL);
  });

  it('supports a self-hosted sidecar', () => {
    expect(relaySwarmUrl({ relayUrl: 'wss://relay.internal/ws' })).toBe('wss://relay.internal/ws');
  });

  it('appends an Axia api key to the default endpoint', () => {
    const url = new URL(relaySwarmUrl({ apiKey: 'axia_test' }));
    expect(url.origin + url.pathname).toBe(AXIA_RELAY_URL);
    expect(url.searchParams.get('apiKey')).toBe('axia_test');
  });
});

describe('createRelayOmniaClient', () => {
  it('reports an empty channel registry', async () => {
    const client = createRelayOmniaClient({ swarm: fakeSwarm() });
    const result = (await client.getChannels()) as { success: boolean; channels: unknown[] };
    expect(result.success).toBe(true);
    expect(result.channels).toEqual([]);
    await client.close();
  });

  it('delegates local operations to the injected signing material', async () => {
    const seen: string[] = [];
    const client = createRelayOmniaClient({
      swarm: fakeSwarm(),
      operations: {
        openChannel: async () => { seen.push('open'); return { success: true, channelId: 'c1' }; },
        pay: async () => { seen.push('pay'); return { success: true }; },
      },
    });
    await client.openChannel({ remotePartyId: 'p2' });
    await client.pay({ channelId: 'c1', amount: '5' });
    expect(seen).toEqual(['open', 'pay']);
    await client.close();
  });

  it('returns an explicit UNSUPPORTED when signing material is not configured', async () => {
    const client = createRelayOmniaClient({ swarm: fakeSwarm() });
    const result = (await client.openChannel({})) as { success: boolean; errorCode: string };
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED');
    await client.close();
  });

  it('marks advanced topology ops unsupported with a reason', async () => {
    const client = createRelayOmniaClient({ swarm: fakeSwarm() });
    for (const name of ['getRoute', 'getSwapRate', 'createFactory', 'spliceIn'] as const) {
      const result = (await client[name]({})) as { success: boolean; errorCode: string; error: string };
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('UNSUPPORTED');
      expect(result.error).toContain(name);
    }
    await client.close();
  });

  it('reports support truthfully via supports() (RFC-014 Amendment A)', async () => {
    const client = createRelayOmniaClient({ swarm: fakeSwarm() });
    // Advanced ops: unsupported regardless of signing material.
    for (const name of ['createFactory', 'spliceIn', 'getRoute', 'getSwapRate']) {
      const v = client.supports(name);
      expect(typeof v === 'boolean' ? v : v.supported).toBe(false);
    }
    // payMultiHop is not implemented by the base client at all — it must still
    // be reported unsupported (never silently absent/true).
    expect((client.supports('payMultiHop') as { supported: boolean }).supported).toBe(false);
    // Mutations without signing material: unsupported.
    expect((client.supports('openChannel') as { supported: boolean }).supported).toBe(false);
    // Read-only channels query is always supported.
    expect(client.supports('getChannels')).toBe(true);
    // Accepts the connect name namespace too.
    expect((client.supports('totem_omniaSpliceOut') as { supported: boolean }).supported).toBe(false);
    expect(client.supports('totem_omniaGetChannels')).toBe(true);
    await client.close();
  });

  it('affirms mutations once signing material is configured', async () => {
    const client = createRelayOmniaClient({
      swarm: fakeSwarm(),
      localParticipant: { partyId: 'p1', publicKeyDigest: 'aa', addressIndex: 0 },
      signer: { publicKeyDigest: 'aa', sign: async () => ({}) } as never,
      leaseProvider: { reserveKeyUse: async () => ({}), releaseReservation: async () => ({}) } as never,
      chainProvider: {} as never,
    });
    expect(client.supports('openChannel')).toBe(true);
    // Advanced ops stay unsupported even with signing material.
    expect((client.supports('createFactory') as { supported: boolean }).supported).toBe(false);
    await client.close();
  });

  it('wires inbound integration and tears down the swarm on close', async () => {
    const swarm = fakeSwarm();
    const client = createRelayOmniaClient({ swarm });
    expect(swarm.listenForChannels).toHaveBeenCalled();
    await client.close();
    expect(swarm.close).toHaveBeenCalled();
  });

  it('auto-builds local operations when wallet signing material is provided', async () => {
    const client = createRelayOmniaClient({
      swarm: fakeSwarm(),
      localParticipant: { partyId: 'p1', publicKeyDigest: 'aa', addressIndex: 0 },
      signer: { publicKeyDigest: 'aa', sign: async () => ({}) } as never,
      leaseProvider: { reserveKeyUse: async () => ({}), releaseReservation: async () => ({}) } as never,
      chainProvider: {} as never,
    });
    // Not UNSUPPORTED: the operation is wired and validates its parameters.
    await expect(client.openChannel({})).rejects.toThrow(/remotePartyId/);
    await client.close();
  });
});

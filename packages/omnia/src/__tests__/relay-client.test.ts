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

  it('wires inbound integration and tears down the swarm on close', async () => {
    const swarm = fakeSwarm();
    const client = createRelayOmniaClient({ swarm });
    expect(swarm.listenForChannels).toHaveBeenCalled();
    await client.close();
    expect(swarm.close).toHaveBeenCalled();
  });
});

import { createOmniaHost } from '../lifecycle.js';
import { createHostMethods } from '../api/methods.js';
import { InProcessRoutingProvider } from '../router/routing-provider.js';

const config = {
  port: 50052,
  host: '127.0.0.1',
  dbPath: '/tmp/omnia.sqlite',
  chainRpcUrl: 'http://127.0.0.1:9005',
  wsPath: '/rpc',
  readOnly: false,
  serviceType: 'omnia-router',
};

function mockSwarm() {
  return {
    advertise: jest.fn(),
    connectToPeer: jest.fn(),
    listenForChannels: jest.fn(() => jest.fn()),
    broadcast: jest.fn(),
    close: jest.fn(async () => undefined),
  };
}

describe('createOmniaHost', () => {
  it('supports idempotent start and close', async () => {
    const host = createOmniaHost(config, {
      channelStore: new Map(),
      operationStore: { close: jest.fn() },
      swarm: mockSwarm(),
      controlServer: { listen: jest.fn(async () => undefined), close: jest.fn(async () => undefined) },
    });

    expect(host.isStarted()).toBe(false);
    await host.start();
    await host.start();
    expect(host.isStarted()).toBe(true);

    await host.close();
    await host.close();
    expect(host.isStarted()).toBe(false);
  });

  it('binds and unbinds the injected swarm integration', async () => {
    const close = jest.fn(async () => undefined);
    const serverClose = jest.fn(async () => undefined);
    const serverListen = jest.fn(async () => undefined);
    const listenForChannels = jest.fn(() => jest.fn());
    const host = createOmniaHost(config, {
      swarm: {
        advertise: jest.fn(),
        connectToPeer: jest.fn(),
        listenForChannels,
        broadcast: jest.fn(),
        close,
      },
      channelStore: new Map(),
      operationStore: { close: jest.fn() },
      createSwarm: jest.fn(),
      controlServer: { listen: serverListen, close: serverClose },
    });

    await host.start();
    expect(listenForChannels).toHaveBeenCalledTimes(1);
    expect(serverListen).toHaveBeenCalledTimes(1);
    await host.close();
    expect(close).toHaveBeenCalledTimes(1);
    expect(serverClose).toHaveBeenCalledTimes(1);
  });
});

describe('omnia-host boot matrix', () => {
  it('registers only read-only methods when no signer is present', () => {
    const methods = createHostMethods({
      channels: new Map(),
      routing: new InProcessRoutingProvider(),
      readOnly: true,
    });
    expect(methods.has('totem_omniaGetChannels')).toBe(true);
    expect(methods.has('totem_omniaGetRoute')).toBe(true);
    expect(methods.has('totem_omniaGetSwapRate')).toBe(true);
    expect(methods.has('totem_omniaOpenChannel')).toBe(false);
    expect(methods.has('totem_omniaPay')).toBe(false);
    expect(methods.has('totem_omniaSettle')).toBe(false);
    expect(methods.has('totem_omniaPayMultiHop')).toBe(false);
  });

  it('registers the full method set when a signer and lease provider are present', () => {
    const methods = createHostMethods({
      channels: new Map(),
      routing: new InProcessRoutingProvider(),
      signer: { publicKeyDigest: '0x' + 'aa'.repeat(32), sign: jest.fn() } as any,
      leaseProvider: { reserveKeyUse: jest.fn(), commitKeyUse: jest.fn(), burnReservation: jest.fn() } as any,
    });
    expect(methods.has('totem_omniaGetChannels')).toBe(true);
    expect(methods.has('totem_omniaOpenChannel')).toBe(true);
    expect(methods.has('totem_omniaPay')).toBe(true);
    expect(methods.has('totem_omniaSettle')).toBe(true);
    expect(methods.has('totem_omniaPayMultiHop')).toBe(true);
  });

  it('treats a missing lease provider as read-only even with a signer', () => {
    const methods = createHostMethods({
      channels: new Map(),
      routing: new InProcessRoutingProvider(),
      signer: { publicKeyDigest: '0x' + 'aa'.repeat(32), sign: jest.fn() } as any,
    });
    expect(methods.has('totem_omniaGetChannels')).toBe(true);
    expect(methods.has('totem_omniaPay')).toBe(false);
  });
});

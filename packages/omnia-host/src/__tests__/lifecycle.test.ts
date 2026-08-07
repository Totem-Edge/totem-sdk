import { createOmniaHost } from '../lifecycle.js';

const config = {
  port: 50052,
  host: '127.0.0.1',
  dbPath: '/tmp/omnia.sqlite',
  chainRpcUrl: 'http://127.0.0.1:9005',
  wsPath: '/rpc',
};

describe('createOmniaHost', () => {
  it('supports idempotent start and close', async () => {
    const host = createOmniaHost(config, {
      channelStore: new Map(),
      operationStore: { close: jest.fn() },
      swarm: {
        advertise: jest.fn(),
        connectToPeer: jest.fn(),
        listenForChannels: jest.fn(() => jest.fn()),
        broadcast: jest.fn(),
        close: jest.fn(async () => undefined),
      },
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

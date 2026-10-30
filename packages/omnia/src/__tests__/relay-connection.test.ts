import { HostedRelaySwarmImpl } from '../relay.js';

class SocketFixture {
  static instances: SocketFixture[] = [];
  readyState = 0;
  onopen?: () => void;
  onerror?: (event: { message: string }) => void;
  onclose?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  constructor(readonly url: string) { SocketFixture.instances.push(this); }
  send() {}
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
}

describe('relay connection promise lifecycle', () => {
  const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
  let swarm: HostedRelaySwarmImpl;
  beforeEach(() => {
    SocketFixture.instances = [];
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: SocketFixture });
    swarm = new HostedRelaySwarmImpl('wss://fixture.invalid/ws');
  });
  afterEach(async () => {
    await swarm.close();
    if (originalWebSocket) Object.defineProperty(globalThis, 'WebSocket', originalWebSocket);
    else Reflect.deleteProperty(globalThis, 'WebSocket');
  });

  it('propagates synchronous socket-constructor failures instead of hanging', async () => {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: class {
      constructor() { throw new Error('socket construction failed'); }
    } });
    await expect(swarm.connectToPeer('ab'.repeat(32))).rejects.toThrow('socket construction failed');
  });

  it('shares one opening socket across concurrent callers', async () => {
    const first = swarm.connectToPeer('ab'.repeat(32));
    const second = swarm.connectToPeer('cd'.repeat(32));
    await Promise.resolve();
    await Promise.resolve();
    expect(SocketFixture.instances).toHaveLength(1);
    SocketFixture.instances[0].open();
    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
  });

  it('rejects all opening callers on a socket error', async () => {
    const first = swarm.connectToPeer('ab'.repeat(32));
    const second = swarm.connectToPeer('cd'.repeat(32));
    const outcomes = Promise.allSettled([first, second]);
    await Promise.resolve();
    await Promise.resolve();
    SocketFixture.instances[0].onerror?.({ message: 'connection refused' });
    const results = await outcomes;
    expect(results.every((result) => result.status === 'rejected' && String(result.reason).includes('connection refused'))).toBe(true);
  });
});

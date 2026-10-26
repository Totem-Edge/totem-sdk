import { EventEmitter } from 'node:events';
import { BareHyperswarm } from '../network/hyperswarm';
import type { SwarmLike, SwarmPeerInfo } from '@totemsdk/stream-transport';

const TOPIC = 'aa'.repeat(32);

class FakeSwarm extends EventEmitter implements SwarmLike {
  join = jest.fn(() => ({
    flushed: jest.fn(async () => {}),
    destroy: jest.fn(async () => {}),
  }));
  destroy = jest.fn(async () => {});
}

function makeConn(): EventEmitter & { write: () => boolean; destroy: jest.Mock } {
  const conn = new EventEmitter() as EventEmitter & {
    write: () => boolean;
    destroy: jest.Mock;
  };
  conn.write = () => true;
  conn.destroy = jest.fn(() => conn.emit('close'));
  return conn;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('BareHyperswarm', () => {
  it('cleans up the swarm when connect times out', async () => {
    const swarm = new FakeSwarm();
    const hyperswarm = new BareHyperswarm({ createSwarm: () => swarm });

    await expect(hyperswarm.connect(TOPIC, { timeoutMs: 20 })).rejects.toThrow(/no peers/);
    await tick();

    expect(swarm.listenerCount('connection')).toBe(0);
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
  });

  it('resolves on a connection and destroys the swarm on close', async () => {
    const swarm = new FakeSwarm();
    const hyperswarm = new BareHyperswarm({ createSwarm: () => swarm });
    const pending = hyperswarm.connect(TOPIC, { timeoutMs: 500 });
    await tick();

    const info: SwarmPeerInfo = {
      publicKey: Buffer.alloc(32, 7),
      topics: [Buffer.from(TOPIC, 'hex')],
    };
    swarm.emit('connection', makeConn(), info);

    const transport = await pending;
    expect(transport.state).toBe('open');

    await hyperswarm.close();
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
  });
});

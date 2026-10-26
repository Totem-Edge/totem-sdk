import { EventEmitter } from 'node:events';
import { createHyperswarmTransport } from '../transport';
import type { SwarmLike } from '@totemsdk/stream-transport';

const TOPIC = 'bb'.repeat(32);

class FakeSwarm extends EventEmitter implements SwarmLike {
  join = jest.fn(() => ({
    flushed: jest.fn(async () => {}),
    destroy: jest.fn(async () => {}),
  }));
  destroy = jest.fn(async () => {});
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('lookup-client Hyperswarm transport', () => {
  it('releases the swarm/listeners when the connection times out', async () => {
    const swarm = new FakeSwarm();
    await expect(createHyperswarmTransport({
      hyperswarmTopic: TOPIC,
      timeoutMs: 20,
      _swarmFactory: () => swarm,
    })).rejects.toThrow(/Hyperswarm transport failed/);

    await tick();
    expect(swarm.listenerCount('connection')).toBe(0);
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
  });
});

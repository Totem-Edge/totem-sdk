import { EventEmitter } from 'node:events';
import {
  HyperswarmStreamTransport,
  SwarmConnectionManager,
  createHyperswarmTransport,
  type SwarmLike,
  type SwarmPeerInfo,
} from '../index.js';

const TOPIC = Buffer.alloc(32, 1);
const OTHER_TOPIC = Buffer.alloc(32, 2);
const PEER = Buffer.alloc(32, 3);

class FakeSwarm extends EventEmitter implements SwarmLike {
  join = jest.fn((topic: Uint8Array) => {
    const discovery = { flushed: jest.fn(async () => {}), destroy: jest.fn(async () => {}) };
    this.discoveries.push(discovery);
    this.topics.push(Buffer.from(topic));
    return discovery;
  });
  destroy = jest.fn(async () => {});
  topics: Buffer[] = [];
  discoveries: { flushed: jest.Mock; destroy: jest.Mock }[] = [];
}

function makeConn(): EventEmitter & { write: () => boolean; destroy: jest.Mock } {
  const conn = new EventEmitter() as EventEmitter & {
    write: () => boolean;
    destroy: jest.Mock;
  };
  conn.write = () => true;
  conn.destroy = jest.fn(() => {
    conn.emit('close');
  });
  return conn;
}

const info = (topics: Buffer[], publicKey = PEER): SwarmPeerInfo => ({ publicKey, topics });
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('SwarmConnectionManager', () => {
  it('joins once and resolves only on a matching connection', async () => {
    const swarm = new FakeSwarm();
    const manager = new SwarmConnectionManager({ createSwarm: () => swarm });
    const pending = manager.connect(TOPIC, { timeoutMs: 500 });
    await tick();

    expect(swarm.join).toHaveBeenCalledTimes(1);
    expect(swarm.join).toHaveBeenCalledWith(TOPIC, { client: true, server: false });

    let settled = false;
    void pending.then(() => { settled = true; });
    await tick();
    expect(settled).toBe(false);

    swarm.emit('connection', makeConn(), info([TOPIC]));
    const transport = await pending;
    expect(transport).toBeInstanceOf(HyperswarmStreamTransport);

    await manager.close();
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys a connection that matches no waiter', async () => {
    const swarm = new FakeSwarm();
    const manager = new SwarmConnectionManager({ createSwarm: () => swarm });
    const pending = manager.connect(TOPIC, { timeoutMs: 500 });
    await tick();

    const stray = makeConn();
    swarm.emit('connection', stray, info([OTHER_TOPIC]));
    expect(stray.destroy).toHaveBeenCalledTimes(1);

    swarm.emit('connection', makeConn(), info([TOPIC]));
    await pending;
    await manager.close();
  });

  it('removes the listener and destroys swarm/discovery on timeout', async () => {
    const swarm = new FakeSwarm();
    const manager = new SwarmConnectionManager({ createSwarm: () => swarm });

    await expect(manager.connect(TOPIC, { timeoutMs: 20 })).rejects.toThrow(/no peers/);
    await tick();

    expect(swarm.listenerCount('connection')).toBe(0);
    expect(swarm.discoveries[0].destroy).toHaveBeenCalledTimes(1);
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps a topic joined while another waiter still needs it', async () => {
    const swarm = new FakeSwarm();
    const manager = new SwarmConnectionManager({ createSwarm: () => swarm });

    const first = manager.connect(TOPIC, { timeoutMs: 10 });
    const second = manager.connect(TOPIC, { timeoutMs: 500 });

    await expect(first).rejects.toThrow(/no peers/);
    expect(swarm.discoveries[0].destroy).not.toHaveBeenCalled();

    swarm.emit('connection', makeConn(), info([TOPIC]));
    await expect(second).resolves.toBeInstanceOf(HyperswarmStreamTransport);

    await manager.close();
  });

  it('matches a target public key even without topics', async () => {
    const swarm = new FakeSwarm();
    const manager = new SwarmConnectionManager({ createSwarm: () => swarm });
    const pending = manager.connect(TOPIC, { targetPublicKey: PEER, timeoutMs: 500 });
    await tick();

    swarm.emit('connection', makeConn(), { publicKey: Buffer.alloc(32, 9) });
    swarm.emit('connection', makeConn(), { publicKey: PEER });
    await expect(pending).resolves.toBeInstanceOf(HyperswarmStreamTransport);
    await manager.close();
  });
});

describe('createHyperswarmTransport (owned manager)', () => {
  it('destroys the swarm when the returned transport closes', async () => {
    const swarm = new FakeSwarm();
    const pending = createHyperswarmTransport({
      topic: TOPIC,
      timeoutMs: 500,
      createSwarm: () => swarm,
    });
    await tick();
    swarm.emit('connection', makeConn(), info([TOPIC]));

    const transport = await pending;
    await transport.close();

    expect(swarm.destroy).toHaveBeenCalledTimes(1);
    expect(swarm.listenerCount('connection')).toBe(0);
  });

  it('closes the owned manager when the connection attempt fails', async () => {
    const swarm = new FakeSwarm();
    await expect(createHyperswarmTransport({
      topic: TOPIC,
      timeoutMs: 20,
      createSwarm: () => swarm,
    })).rejects.toThrow(/no peers/);
    await tick();
    expect(swarm.destroy).toHaveBeenCalledTimes(1);
  });
});

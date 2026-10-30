import { EventEmitter } from 'events';
import {
  EventEmitterTransport,
  MockPubSubTransport,
  createPairedEventEmitterTransports,
  type PubSubMessage,
  type PubSubSubscription,
} from '../index.js';

describe('EventEmitterTransport', () => {
  it('delivers published messages to subscribers on the same topic', async () => {
    const t = new EventEmitterTransport();
    const received: PubSubMessage[] = [];
    await t.connect();
    await t.subscribe('sensor/temp');
    t.onMessage((m: PubSubMessage) => received.push(m));

    await t.publish('sensor/temp', '23.5');
    expect(received).toHaveLength(1);
    expect(received[0].topic).toBe('sensor/temp');
    expect(new TextDecoder().decode(received[0].payload)).toBe('23.5');
  });

  it('does not deliver to subscribers on other topics', async () => {
    const t = new EventEmitterTransport();
    const received: PubSubMessage[] = [];
    await t.subscribe('a');
    t.onMessage((m: PubSubMessage) => received.push(m));
    await t.publish('b', 'nope');
    expect(received).toHaveLength(0);
  });

  it('stops delivering after unsubscribe', async () => {
    const t = new EventEmitterTransport();
    const received: PubSubMessage[] = [];
    const sub = await t.subscribe('topic');
    t.onMessage((m: PubSubMessage) => received.push(m));
    await t.publish('topic', 'one');
    await sub.unsubscribe();
    await t.publish('topic', 'two');
    expect(received).toHaveLength(1);
    expect(new TextDecoder().decode(received[0].payload)).toBe('one');
  });

  it('encodes string payloads as UTF-8 bytes', async () => {
    const t = new EventEmitterTransport();
    const received: PubSubMessage[] = [];
    await t.subscribe('t');
    t.onMessage((m: PubSubMessage) => received.push(m));
    await t.publish('t', 'héllo ✓');
    expect(received[0].payload).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(received[0].payload)).toBe('héllo ✓');
  });

  it('removes a single onMessage handler on returned unsubscribe', async () => {
    const t = new EventEmitterTransport();
    const a: PubSubMessage[] = [];
    const b: PubSubMessage[] = [];
    await t.subscribe('t');
    const offA = t.onMessage((m: PubSubMessage) => a.push(m));
    t.onMessage((m: PubSubMessage) => b.push(m));
    offA();
    await t.publish('t', 'x');
    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });

  it('shares a bus across instances', async () => {
    const bus = new EventEmitter();
    const left = new EventEmitterTransport(bus);
    const right = new EventEmitterTransport(bus);
    const received: PubSubMessage[] = [];
    await left.connect();
    await right.connect();
    await right.subscribe('shared');
    right.onMessage((m: PubSubMessage) => received.push(m));
    await left.publish('shared', 'ping');
    expect(received).toHaveLength(1);
    expect(new TextDecoder().decode(received[0].payload)).toBe('ping');
  });

  it('removes all listeners on disconnect', async () => {
    const t = new EventEmitterTransport();
    await t.subscribe('t');
    await t.disconnect();
    await t.publish('t', 'x');
    expect(t.bus.listenerCount('msg:t')).toBe(0);
  });
});

describe('createPairedEventEmitterTransports', () => {
  it('routes messages both ways over the shared bus', async () => {
    const [a, b] = createPairedEventEmitterTransports();
    const fromB: PubSubMessage[] = [];
    const fromA: PubSubMessage[] = [];
    await a.subscribe('a');
    await b.subscribe('b');
    a.onMessage((m: PubSubMessage) => fromB.push(m));
    b.onMessage((m: PubSubMessage) => fromA.push(m));

    await b.publish('a', 'to-a');
    await a.publish('b', 'to-b');
    expect(new TextDecoder().decode(fromB[0].payload)).toBe('to-a');
    expect(new TextDecoder().decode(fromA[0].payload)).toBe('to-b');
  });
});

describe('MockPubSubTransport', () => {
  it('records publishes and subscriptions', async () => {
    const m = new MockPubSubTransport();
    await m.connect();
    expect(m.connected).toBe(true);
    const sub = await m.subscribe('sensor/temp');
    await m.publish('sensor/temp', '18.0');
    expect(m.subscriptions).toEqual(['sensor/temp']);
    expect(m.published).toHaveLength(1);
    expect(m.published[0].topic).toBe('sensor/temp');
    await sub.unsubscribe();
    expect(m.subscriptions).toEqual([]);
  });

  it('injects inbound messages to handlers', async () => {
    const m = new MockPubSubTransport();
    const received: PubSubMessage[] = [];
    m.onMessage((msg: PubSubMessage) => received.push(msg));
    m.inject('cmd', 'shutdown');
    expect(received).toHaveLength(1);
    expect(received[0].topic).toBe('cmd');
    expect(new TextDecoder().decode(received[0].payload)).toBe('shutdown');
  });

  it('tracks connected state across disconnect', async () => {
    const m = new MockPubSubTransport();
    await m.connect();
    expect(m.connected).toBe(true);
    await m.disconnect();
    expect(m.connected).toBe(false);
  });

  it('enforces the IPubSubTransport interface shape', async () => {
    const m: MockPubSubTransport = new MockPubSubTransport();
    const sub: PubSubSubscription = await m.subscribe('t');
    expect(typeof sub.unsubscribe).toBe('function');
  });
});

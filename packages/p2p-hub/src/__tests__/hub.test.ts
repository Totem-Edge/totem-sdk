import { bytesToBase64, type HubClientFrame, type HubServerFrame } from '@totemsdk/pubsub-transport';
import {
  createP2PHub,
  deriveTopicKey,
  type HubClient,
  type HubNetwork,
  type HubNetworkConnection,
} from '../index';

class FakeClient implements HubClient {
  readonly sent: HubServerFrame[] = [];
  readonly id: string;
  closed = false;
  private frameHandlers: Array<(frame: HubClientFrame) => void> = [];
  private closeHandlers: Array<() => void> = [];

  constructor(id: string) {
    this.id = id;
  }

  send(frame: HubServerFrame): void { this.sent.push(frame); }
  onFrame(handler: (frame: HubClientFrame) => void): () => void {
    this.frameHandlers.push(handler);
    return () => { this.frameHandlers = this.frameHandlers.filter((h) => h !== handler); };
  }
  onClose(handler: () => void): () => void {
    this.closeHandlers.push(handler);
    return () => { this.closeHandlers = this.closeHandlers.filter((h) => h !== handler); };
  }
  close(): void {
    this.closed = true;
    for (const handler of this.closeHandlers) handler();
  }
  emit(frame: HubClientFrame): void {
    for (const handler of this.frameHandlers) handler(frame);
  }
}

class FakePeer {
  readonly sent: Uint8Array[] = [];
  private dataHandlers: Array<(data: Uint8Array) => void> = [];
  private closeHandlers: Array<() => void> = [];

  readonly connection: HubNetworkConnection = {
    remoteId: 'peer-1',
    onData: (handler) => {
      this.dataHandlers.push(handler);
      return () => { this.dataHandlers = this.dataHandlers.filter((h) => h !== handler); };
    },
    onClose: (handler) => {
      this.closeHandlers.push(handler);
      return () => { this.closeHandlers = this.closeHandlers.filter((h) => h !== handler); };
    },
    send: (data) => { this.sent.push(data); },
    close: () => { for (const handler of this.closeHandlers) handler(); },
  };

  deliver(frame: unknown): void {
    const data = new TextEncoder().encode(JSON.stringify(frame) + '\n');
    for (const handler of this.dataHandlers) handler(data);
  }
}

class FakeNetwork implements HubNetwork {
  readonly joined = new Set<string>();
  private handlers: Array<(connection: HubNetworkConnection, topics: string[]) => void> = [];

  async join(topic: Uint8Array): Promise<void> {
    this.joined.add(Buffer.from(topic).toString('hex'));
  }
  async leave(topic: Uint8Array): Promise<void> {
    this.joined.delete(Buffer.from(topic).toString('hex'));
  }
  onConnection(handler: (connection: HubNetworkConnection, topics: string[]) => void): () => void {
    this.handlers.push(handler);
    return () => { this.handlers = this.handlers.filter((h) => h !== handler); };
  }
  connectPeer(topics: string[]): FakePeer {
    const peer = new FakePeer();
    const keys = topics.map((topic) => Buffer.from(deriveTopicKey(topic)).toString('hex'));
    for (const handler of this.handlers) handler(peer.connection, keys);
    return peer;
  }
}

const TOPIC = 'dex.v1.orders.MINIMA_USDT';
const payload = (text: string) => bytesToBase64(new TextEncoder().encode(text));

describe('p2p hub', () => {
  it('authenticates clients and joins the DHT topic on subscribe', async () => {
    const network = new FakeNetwork();
    const hub = createP2PHub({ network, token: 'secret' });
    const client = new FakeClient('c1');

    hub.attachClient(client);
    client.emit({ op: 'hello', token: 'wrong' });
    expect(client.sent[0]).toMatchObject({ op: 'error', code: 'UNAUTHORIZED' });
    expect(client.closed).toBe(true);

    const good = new FakeClient('c2');
    hub.attachClient(good);
    good.emit({ op: 'hello', token: 'secret' });
    expect(good.sent[0]).toMatchObject({ op: 'ready' });

    good.emit({ op: 'sub', topic: TOPIC, id: 's1' });
    await new Promise((r) => setTimeout(r, 0));
    expect(network.joined.has(Buffer.from(deriveTopicKey(TOPIC)).toString('hex'))).toBe(true);
    expect(good.sent.at(-1)).toMatchObject({ op: 'ack', id: 's1', ok: true });
  });

  it('routes local publishes to local subscribers and DHT peers without echo', async () => {
    const network = new FakeNetwork();
    const hub = createP2PHub({ network });
    const alice = new FakeClient('alice');
    const bob = new FakeClient('bob');
    hub.attachClient(alice);
    hub.attachClient(bob);
    alice.emit({ op: 'hello' });
    bob.emit({ op: 'hello' });
    alice.emit({ op: 'sub', topic: TOPIC });
    bob.emit({ op: 'sub', topic: TOPIC });
    const peer = network.connectPeer([TOPIC]);

    alice.emit({ op: 'pub', topic: TOPIC, payload: payload('order-1') });
    await new Promise((r) => setTimeout(r, 0));

    expect(alice.sent.filter((f) => f.op === 'msg')).toHaveLength(0);
    expect(bob.sent.filter((f) => f.op === 'msg')).toHaveLength(1);
    expect(peer.sent).toHaveLength(1);
    expect(JSON.parse(new TextDecoder().decode(peer.sent[0]))).toMatchObject({ op: 'msg', topic: TOPIC, payload: payload('order-1') });
  });

  it('routes peer publishes to local subscribers', async () => {
    const network = new FakeNetwork();
    const hub = createP2PHub({ network });
    const client = new FakeClient('client');
    hub.attachClient(client);
    client.emit({ op: 'hello' });
    client.emit({ op: 'sub', topic: TOPIC });
    await new Promise((r) => setTimeout(r, 0));
    const peer = network.connectPeer([TOPIC]);

    peer.deliver({ op: 'pub', topic: TOPIC, payload: payload('from-peer') });
    await new Promise((r) => setTimeout(r, 0));

    const messages = client.sent.filter((f) => f.op === 'msg');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ op: 'msg', topic: TOPIC, payload: payload('from-peer') });
  });

  it('enforces the topic allowlist', async () => {
    const network = new FakeNetwork();
    const hub = createP2PHub({ network, allowedTopicPrefixes: ['omnia.'] });
    const client = new FakeClient('client');
    hub.attachClient(client);
    client.emit({ op: 'hello' });
    client.emit({ op: 'sub', topic: TOPIC, id: 'nope' });
    expect(client.sent.at(-1)).toMatchObject({ op: 'ack', id: 'nope', ok: false });
    expect(network.joined.size).toBe(0);
  });
});

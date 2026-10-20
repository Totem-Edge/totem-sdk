import {
  WebSocketPubSubTransport,
  base64ToBytes,
  bytesToBase64,
  type HubClientFrame,
  type HubServerFrame,
} from '../index.js';

class FakeWebSocket {
  readonly sent: HubClientFrame[] = [];
  readyState = 0;
  private handlers = new Map<string, Array<(...args: any[]) => void>>();

  constructor(readonly url: string) {
    setTimeout(() => {
      this.readyState = 1;
      this.emit('open');
    }, 0);
  }

  addEventListener(event: string, handler: (...args: any[]) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  send(data: string): void {
    const frame = JSON.parse(data) as HubClientFrame;
    this.sent.push(frame);
    if (frame.op === 'hello') {
      setTimeout(() => this.emit('message', {
        data: JSON.stringify({ op: 'ready', hubId: 'hub-test' } satisfies HubServerFrame),
      }), 0);
    }
  }

  close(): void {
    this.readyState = 3;
    this.emit('close');
  }

  emit(event: string, value?: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(value);
  }
}

describe('WebSocketPubSubTransport', () => {
  it('handshakes, subscribes, publishes and receives hub frames', async () => {
    let socket!: FakeWebSocket;
    const transport = new WebSocketPubSubTransport({
      url: 'ws://127.0.0.1:7788/p2p',
      token: 'secret',
      WebSocketImpl: class extends FakeWebSocket {
        constructor(url: string) {
          super(url);
          socket = this;
        }
      } as never,
    });
    const received: Array<{ topic: string; text: string }> = [];
    transport.onMessage((message) => {
      received.push({ topic: message.topic, text: new TextDecoder().decode(message.payload) });
    });

    await transport.connect();
    expect(socket.sent[0]).toEqual({ op: 'hello', token: 'secret' });
    expect(transport.connected).toBe(true);

    await transport.subscribe('dex.v1.orders.MINIMA_USDT');
    expect(socket.sent.at(-1)).toEqual({ op: 'sub', topic: 'dex.v1.orders.MINIMA_USDT' });

    await transport.publish('dex.v1.orders.MINIMA_USDT', 'order-1');
    expect(socket.sent.at(-1)).toEqual({
      op: 'pub',
      topic: 'dex.v1.orders.MINIMA_USDT',
      payload: bytesToBase64(new TextEncoder().encode('order-1')),
    });

    socket.emit('message', {
      data: JSON.stringify({
        op: 'msg',
        topic: 'dex.v1.orders.MINIMA_USDT',
        payload: bytesToBase64(new TextEncoder().encode('from-peer')),
      } satisfies HubServerFrame),
    });
    expect(received).toEqual([{ topic: 'dex.v1.orders.MINIMA_USDT', text: 'from-peer' }]);
  });

  it('round-trips base64 payloads', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

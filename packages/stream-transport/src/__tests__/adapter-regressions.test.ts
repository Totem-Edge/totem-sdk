import { EventEmitter } from 'node:events';
import {
  NodeStreamTransport,
  StdioStreamTransport,
  WebSocketTransport,
} from '../index.js';

class BrowserWebSocketFake {
  binaryType = 'blob';
  sent: Uint8Array[] = [];
  private readonly handlers = new Map<string, (...args: unknown[]) => void>();

  addEventListener(event: string, handler: (...args: unknown[]) => void): void {
    this.handlers.set(event, handler);
  }

  send(data: Uint8Array): void {
    this.sent.push(data);
  }

  close(): void {
    this.handlers.get('close')?.();
  }
}

describe('transport adapter regressions', () => {
  it('resolves browser WebSocket sends without a Node callback', async () => {
    const socket = new BrowserWebSocketFake();
    const transport = new WebSocketTransport(socket);

    await transport.send(new Uint8Array([1, 2, 3]));

    expect(socket.binaryType).toBe('arraybuffer');
    expect(socket.sent).toHaveLength(1);
    expect(Array.from(socket.sent[0])).toEqual([1, 2, 3]);
  });

  it('marks a Node stream closed when the remote side closes it', () => {
    const stream = new EventEmitter() as EventEmitter & {
      write: (data: Uint8Array) => boolean;
    };
    stream.write = () => true;
    const transport = new NodeStreamTransport(stream);

    stream.emit('close');

    expect(transport.state).toBe('closed');
  });

  it('closes injected stdio streams without touching process.stdin', async () => {
    const input = Object.assign(new EventEmitter(), { destroy: jest.fn() });
    const output = Object.assign(new EventEmitter(), {
      end: jest.fn(),
      write: jest.fn(() => true),
    });
    const transport = new StdioStreamTransport(input, output);

    await transport.close();

    expect(input.destroy).toHaveBeenCalledTimes(1);
    expect(output.end).toHaveBeenCalledTimes(1);
    expect(transport.state).toBe('closed');
  });
});

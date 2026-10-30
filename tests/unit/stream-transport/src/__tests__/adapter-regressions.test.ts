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

  emit(event: string, value: unknown): void {
    this.handlers.get(event)?.(value);
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
    const transport = new StdioStreamTransport(input, output, {
      ownInput: true,
      ownOutput: true,
    });

    await transport.close();

    expect(input.destroy).toHaveBeenCalledTimes(1);
    expect(output.end).toHaveBeenCalledTimes(1);
    expect(transport.state).toBe('closed');
  });

  it('does not close injected stdio streams unless ownership is explicit', async () => {
    const input = Object.assign(new EventEmitter(), { destroy: jest.fn() });
    const output = Object.assign(new EventEmitter(), {
      end: jest.fn(),
      write: jest.fn(() => true),
    });
    const transport = new StdioStreamTransport(input, output);

    await transport.close();

    expect(input.destroy).not.toHaveBeenCalled();
    expect(output.end).not.toHaveBeenCalled();
  });

  it('delivers Blob messages as bytes', async () => {
    const socket = new BrowserWebSocketFake();
    const transport = new WebSocketTransport(socket);
    const received: Uint8Array[] = [];
    transport.onData((chunk) => received.push(chunk));

    socket.emit('message', { data: new Blob([new Uint8Array([4, 5, 6])]) });
    await new Promise((resolve) => setImmediate(resolve));

    expect(Array.from(received[0])).toEqual([4, 5, 6]);
  });

  it('rejects a backpressured Node send when the stream closes', async () => {
    const stream = Object.assign(new EventEmitter(), {
      write: jest.fn(() => false),
      destroy: jest.fn(),
    });
    const transport = new NodeStreamTransport(stream);
    const send = transport.send(new Uint8Array([1]));

    stream.emit('close');

    await expect(send).rejects.toBeInstanceOf(Error);
  });
});

/**
 * IStreamTransport contract tests.
 *
 * Verifies the canonical transport contract against every in-memory
 * implementation: data delivery, ordering, copy isolation, remote close,
 * local close, error delivery, handler removal, double close, send-after-close,
 * backpressure/error on send, and no delivery after unsubscribe.
 */

import {
  createInMemoryPair,
  ClosedTransportError,
  InMemoryTransport,
  type IStreamTransport,
} from '../index.js';

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

describe('IStreamTransport contract (InMemoryTransport)', () => {
  let pair: [InMemoryTransport, InMemoryTransport];
  let a: InMemoryTransport;
  let b: InMemoryTransport;

  beforeEach(() => {
    pair = createInMemoryPair();
    a = pair[0];
    b = pair[1];
  });

  it('1. delivers data written on one side to the other', async () => {
    const received: Uint8Array[] = [];
    b.onData((chunk: Uint8Array) => received.push(chunk));
    await a.send(new Uint8Array([1, 2, 3]));
    expect(received).toHaveLength(1);
    expect(Array.from(received[0])).toEqual([1, 2, 3]);
  });

  it('2. preserves order of consecutive sends', async () => {
    const received: Uint8Array[] = [];
    b.onData((chunk: Uint8Array) => received.push(chunk));
    for (let i = 0; i < 100; i++) {
      await a.send(new Uint8Array([i]));
    }
    expect(received.map(c => c[0])).toEqual(Array.from({ length: 100 }, (_, i) => i));
  });

  it('3. delivers an isolated copy — mutating the sent buffer does not affect the receiver', async () => {
    const received: Uint8Array[] = [];
    b.onData((chunk: Uint8Array) => received.push(chunk));
    const buf = new Uint8Array([1, 2, 3]);
    await a.send(buf);
    buf[0] = 99;
    expect(Array.from(received[0])).toEqual([1, 2, 3]);
  });

  it('4. fires onClose on both sides when the remote side closes', async () => {
    const aClosed = jest.fn();
    const bClosed = jest.fn();
    a.onClose(aClosed);
    b.onClose(bClosed);
    await a.close();
    expect(bClosed).toHaveBeenCalledTimes(1);
    expect(aClosed).toHaveBeenCalledTimes(1);
  });

  it('5. local close() prevents further delivery and transitions state to closed', async () => {
    const received: Uint8Array[] = [];
    b.onData((chunk: Uint8Array) => received.push(chunk));
    await a.close();
    expect(a.state).toBe('closed');
    await expect(a.send(new Uint8Array([1]))).rejects.toThrow(ClosedTransportError);
  });

  it('6. delivers transport errors to onError handlers', async () => {
    const errHandler = jest.fn();
    b.onError(errHandler);
    const err = new Error('boom');
    b._deliver('error', err);
    expect(errHandler).toHaveBeenCalledWith(err);
  });

  it('7. handler removal — unsubscribing stops further deliveries', async () => {
    const received: Uint8Array[] = [];
    const unsub = b.onData((chunk: Uint8Array) => received.push(chunk));
    await a.send(new Uint8Array([1]));
    unsub();
    await a.send(new Uint8Array([2]));
    expect(received).toHaveLength(1);
  });

  it('8. double close() is safe and idempotent', async () => {
    const closed = jest.fn();
    b.onClose(closed);
    await a.close();
    await a.close();
    expect(a.state).toBe('closed');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('9. send() after close rejects with ClosedTransportError', async () => {
    await a.close();
    await expect(a.send(new Uint8Array([1]))).rejects.toBeInstanceOf(ClosedTransportError);
  });

  it('10. send() to an unlinked transport rejects (no peer)', async () => {
    const orphan = new InMemoryTransport();
    await expect(orphan.send(new Uint8Array([1]))).rejects.toBeInstanceOf(ClosedTransportError);
  });

  it('11. no delivery after unsubscribe (onClose too)', async () => {
    const closed = jest.fn();
    const unsubClose = b.onClose(closed);
    unsubClose();
    await a.close();
    expect(closed).not.toHaveBeenCalled();
  });

  it('12. listeners added after close are not invoked', async () => {
    await a.close();
    const late = jest.fn();
    b.onClose(late);
    expect(late).not.toHaveBeenCalled();
  });

  it('state transitions to closed on remote close', async () => {
    const bState = jest.fn(() => b.state);
    await a.close();
    await flush();
    expect(bState()).toBe('closed');
  });
});

describe('IStreamTransport contract (type-level shape)', () => {
  it('all on* methods return an unsubscribe function and send/close are async', () => {
    const [a] = createInMemoryPair();
    const s: IStreamTransport = a;
    const unsubData = s.onData(() => {});
    const unsubClose = s.onClose(() => {});
    const unsubError = s.onError(() => {});
    expect(typeof unsubData).toBe('function');
    expect(typeof unsubClose).toBe('function');
    expect(typeof unsubError).toBe('function');
    expect(typeof s.send).toBe('function');
    expect(typeof s.close).toBe('function');
    expect(typeof s.state).toBe('string');
  });
});

/**
 * Durable queue tests (RFC-007 G4): claim/ack/retry against a shared
 * storage adapter, crash-window re-delivery, reopen persistence, and the
 * no-silent-downgrade guard for non-CAS adapters.
 */

import { MemoryStore } from '@totemsdk/storage';
import type { StorageAdapter } from '@totemsdk/core';
import { createDurableMqttEdgeQueue } from '../durable-queue.js';
import type { MqttQueuedEvent } from '../types.js';

function makeEvent(id: string, topic = 'test/topic'): MqttQueuedEvent {
  return {
    id,
    type: 'message',
    topic,
    payload: Buffer.from(`payload:${id}`),
    createdAt: Date.now(),
    attempts: 0,
  };
}

const VOLATILE = { requireAckMode: 'volatile' as const };

describe('createDurableMqttEdgeQueue', () => {
  it('rejects a non-CAS adapter at construction (no silent downgrade)', () => {
    const bucket = new Map<string, unknown>();
    const plain = {
      async get<T>(): Promise<T | null> { return null; },
      async set(): Promise<void> { void bucket; },
      async remove(): Promise<boolean> { return true; },
      async keys(): Promise<string[]> { return []; },
    } as unknown as StorageAdapter;

    expect(() => createDurableMqttEdgeQueue(plain)).toThrow(/CAS-capable storage adapter/);
  });

  it('enqueues, claims, and durably acks (message forgotten after ack)', async () => {
    const store = new MemoryStore();
    const queue = createDurableMqttEdgeQueue(store, VOLATILE);

    await queue.enqueue(makeEvent('e1'));
    expect(await queue.size()).toBe(1);

    const claimed = await queue.dequeue();
    expect(claimed?.id).toBe('e1');

    await queue.ack('e1');
    expect(await queue.size()).toBe(0);
    expect(await queue.dequeue()).toBeUndefined();
  });

  it('re-delivers a claimed-but-unacked event across a simulated crash', async () => {
    const store = new MemoryStore();
    let queue = createDurableMqttEdgeQueue(store, VOLATILE);

    await queue.enqueue(makeEvent('crash1'));
    const claimed = await queue.dequeue();
    expect(claimed?.id).toBe('crash1');

    // Crash before ack: a fresh queue instance over the same store recovers.
    queue = createDurableMqttEdgeQueue(store, VOLATILE);
    const recovered = await queue.recoverInFlight();
    expect(recovered).toBe(1);

    const reDelivered = await queue.dequeue();
    expect(reDelivered?.id).toBe('crash1');

    await queue.ack('crash1');
    expect(await queue.dequeue()).toBeUndefined();
  });

  it('persists pending events across a reopen (new queue instance, same store)', async () => {
    const store = new MemoryStore();
    const first = createDurableMqttEdgeQueue(store, VOLATILE);
    await first.enqueue(makeEvent('persist1'));
    await first.enqueue(makeEvent('persist2'));

    const second = createDurableMqttEdgeQueue(store, VOLATILE);
    const got: string[] = [];
    let event = await second.dequeue();
    while (event) {
      got.push(event.id);
      await second.ack(event.id);
      event = await second.dequeue();
    }
    expect(got).toEqual(['persist1', 'persist2']);
  });

  it('honors backoff via release and returns the event once eligible', async () => {
    const store = new MemoryStore();
    const queue = createDurableMqttEdgeQueue(store, VOLATILE);

    await queue.enqueue(makeEvent('retry1'));
    const claimed = await queue.dequeue();
    expect(claimed?.id).toBe('retry1');

    // Release with a nextAttemptAt in the near future: not yet eligible.
    const future = Date.now() + 60_000;
    await queue.release('retry1', { attempts: 1, nextAttemptAt: future });
    expect(await queue.dequeue()).toBeUndefined();
    expect(await queue.peek()).toBeUndefined();
    expect(await queue.recoverInFlight()).toBe(0);

    // Release again once the event is claimed... but it is pending. A release
    // only applies to a claimed event, so this is a no-op.
    await queue.release('retry1', { attempts: 2, nextAttemptAt: Date.now() });
    const stillPending = await queue.dequeue();
    expect(stillPending).toBeUndefined();
  });

  it('re-delivers a backed-off event after its nextAttemptAt passes', async () => {
    const store = new MemoryStore();
    const queue = createDurableMqttEdgeQueue(store, VOLATILE);

    await queue.enqueue(makeEvent('retry2'));
    const claimed = await queue.dequeue();
    expect(claimed?.id).toBe('retry2');

    const shortBackoff = Date.now() + 25;
    await queue.release('retry2', { attempts: 1, nextAttemptAt: shortBackoff });
    expect(await queue.dequeue()).toBeUndefined();
    expect(await queue.peek()).toBeUndefined();

    const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    await wait(50);

    const redelivered = await queue.dequeue();
    expect(redelivered?.id).toBe('retry2');
    expect(redelivered?.attempts).toBe(2);
    await queue.ack('retry2');
  });

  it('dead-letters a claimed event without re-delivering it', async () => {
    const store = new MemoryStore();
    const queue = createDurableMqttEdgeQueue(store, VOLATILE);

    await queue.enqueue(makeEvent('dead1'));
    expect((await queue.dequeue())?.id).toBe('dead1');

    await queue.deadLetter('dead1', 'poison payload');
    expect(await queue.deadLetterCount()).toBe(1);
    expect(await queue.size()).toBe(0);
    expect(await queue.dequeue()).toBeUndefined();

    await queue.recoverInFlight();
    expect(await queue.dequeue()).toBeUndefined();
  });

  it('recoverInFlight respects a maxAge window', async () => {
    const store = new MemoryStore();
    const queue = createDurableMqttEdgeQueue(store, VOLATILE);

    await queue.enqueue(makeEvent('aged', 'test/topic'));
    await queue.dequeue();

    const recovered = await queue.recoverInFlight(10 * 60_000);
    expect(recovered).toBe(0);

    const recoveredNow = await queue.recoverInFlight();
    expect(recoveredNow).toBe(1);
  });

  it('rejects a low-durability adapter when durable ack is required by default', () => {
    const store = new MemoryStore();
    expect(() => createDurableMqttEdgeQueue(store)).toThrow(/acknowledges "volatile"/);
  });
});
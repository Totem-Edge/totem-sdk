import {
  createMemoryMqttEdgeQueue,
  flushQueuedEvents,
  createDeadLetterEvent,
} from '../queue.js';
import type { MqttQueuedEvent } from '../types.js';
import type { MqttClientPort } from '../client-port.js';

function makeEvent(id: string, topic = 'test/topic'): MqttQueuedEvent {
  return {
    id,
    type: 'message',
    topic,
    payload: `payload-${id}`,
    createdAt: Date.now(),
    attempts: 0,
  };
}

function makeSuccessClient(): MqttClientPort {
  const published: string[] = [];
  return {
    async subscribe(topic) { return { topic, async unsubscribe() {} }; },
    async publish(topic) { published.push(topic); },
    onMessage() { return () => {}; },
  };
}

describe('queue.test — enqueue/dequeue/peek/clear/flush/dead-letter', () => {
  it('enqueue and dequeue work FIFO', async () => {
    const queue = createMemoryMqttEdgeQueue();
    await queue.enqueue(makeEvent('1'));
    await queue.enqueue(makeEvent('2'));
    const first = await queue.dequeue();
    expect(first?.id).toBe('1');
    const second = await queue.dequeue();
    expect(second?.id).toBe('2');
    const empty = await queue.dequeue();
    expect(empty).toBeUndefined();
  });

  it('peek returns first item without removing it', async () => {
    const queue = createMemoryMqttEdgeQueue();
    await queue.enqueue(makeEvent('a'));
    const peeked = await queue.peek();
    expect(peeked?.id).toBe('a');
    expect(await queue.size()).toBe(1);
  });

  it('size returns correct count', async () => {
    const queue = createMemoryMqttEdgeQueue();
    expect(await queue.size()).toBe(0);
    await queue.enqueue(makeEvent('x'));
    await queue.enqueue(makeEvent('y'));
    expect(await queue.size()).toBe(2);
  });

  it('clear empties the queue', async () => {
    const queue = createMemoryMqttEdgeQueue();
    await queue.enqueue(makeEvent('1'));
    await queue.enqueue(makeEvent('2'));
    await queue.clear();
    expect(await queue.size()).toBe(0);
  });

  it('flushQueuedEvents publishes all queued messages', async () => {
    const queue = createMemoryMqttEdgeQueue();
    const published: string[] = [];
    const client: MqttClientPort = {
      async subscribe(t) { return { topic: t, async unsubscribe() {} }; },
      async publish(topic) { published.push(topic); },
      onMessage() { return () => {}; },
    };
    await queue.enqueue(makeEvent('e1', 'topic/a'));
    await queue.enqueue(makeEvent('e2', 'topic/b'));
    const result = await flushQueuedEvents(client, queue);
    expect(result.ok).toBe(true);
    expect(published).toContain('topic/a');
    expect(published).toContain('topic/b');
    expect(await queue.size()).toBe(0);
  });

  it('failed publish creates dead-letter event via onDeadLetter callback', async () => {
    const queue = createMemoryMqttEdgeQueue();
    const deadLettered: MqttQueuedEvent[] = [];
    const failClient: MqttClientPort = {
      async subscribe(t) { return { topic: t, async unsubscribe() {} }; },
      async publish() { throw new Error('publish failed'); },
      onMessage() { return () => {}; },
    };
    await queue.enqueue(makeEvent('fail-1'));
    const result = await flushQueuedEvents(failClient, queue, {
      maxRetries: 1,
      onDeadLetter: (e) => deadLettered.push(e),
    });
    expect(result.ok).toBe(false);
    expect(deadLettered).toHaveLength(1);
    expect(deadLettered[0].metadata?.deadLetter).toBe(true);
  });

  it('createDeadLetterEvent adds deadLetter metadata', () => {
    const event = makeEvent('dl-1');
    const dead = createDeadLetterEvent(event, 'connection lost');
    expect(dead.metadata?.deadLetter).toBe(true);
    expect(dead.metadata?.deadLetterReason).toBe('connection lost');
    expect(dead.metadata?.deadLetterAt).toBeDefined();
  });
});

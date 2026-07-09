/**
 * In-memory offline queue for @totemsdk/edge-mqtt.
 *
 * No persistent storage — pure in-memory array.
 */

import type { MqttEdgeQueue, MqttQueuedEvent } from './types.js';
import type { MqttClientPort } from './client-port.js';
import type { EdgeOperationResult } from '@totemsdk/edge';

export function createMemoryMqttEdgeQueue(): MqttEdgeQueue {
  const items: MqttQueuedEvent[] = [];

  return {
    async enqueue(event: MqttQueuedEvent): Promise<void> {
      items.push(event);
    },
    async dequeue(): Promise<MqttQueuedEvent | undefined> {
      return items.shift();
    },
    async peek(): Promise<MqttQueuedEvent | undefined> {
      return items[0];
    },
    async size(): Promise<number> {
      return items.length;
    },
    async clear(): Promise<void> {
      items.length = 0;
    },
  };
}

export interface FlushQueueOptions {
  maxRetries?: number;
  onDeadLetter?: (event: MqttQueuedEvent) => void;
}

export async function flushQueuedEvents(
  client: MqttClientPort,
  queue: MqttEdgeQueue,
  options: FlushQueueOptions = {}
): Promise<EdgeOperationResult> {
  const { maxRetries = 3, onDeadLetter } = options;
  let flushed = 0;
  let failed = 0;

  let event = await queue.dequeue();
  while (event !== undefined) {
    try {
      await client.publish(event.topic, event.payload);
      flushed++;
    } catch (err) {
      const attempts = (event.attempts ?? 0) + 1;
      if (attempts >= maxRetries) {
        const dead = createDeadLetterEvent(event, err instanceof Error ? err.message : String(err));
        if (onDeadLetter) onDeadLetter(dead);
        failed++;
      } else {
        await queue.enqueue({ ...event, attempts });
      }
    }
    event = await queue.dequeue();
  }

  return {
    ok: failed === 0,
    data: { flushed, failed },
    ...(failed > 0 ? { error: `${failed} events could not be flushed` } : {}),
  };
}

export function createDeadLetterEvent(event: MqttQueuedEvent, reason: string): MqttQueuedEvent {
  return {
    ...event,
    metadata: {
      ...(event.metadata ?? {}),
      deadLetter: true,
      deadLetterReason: reason,
      deadLetterAt: Date.now(),
    },
  };
}

/**
 * In-memory offline queue for @totemsdk/edge-mqtt.
 *
 * No persistent storage — pure in-memory array.
 */

import type { MqttEdgeQueue, MqttQueuedEvent, MqttQueueReleaseOptions } from './types.js';
import type { MqttClientPort } from './client-port.js';
import type { EdgeOperationResult } from '@totemsdk/edge';

export function createMemoryMqttEdgeQueue(): MqttEdgeQueue {
  const pending: MqttQueuedEvent[] = [];
  const inFlight = new Map<string, MqttQueuedEvent>();

  return {
    async enqueue(event: MqttQueuedEvent): Promise<void> {
      pending.push(event);
    },
    async dequeue(): Promise<MqttQueuedEvent | undefined> {
      const event = pending.shift();
      if (event) inFlight.set(event.id, event);
      return event;
    },
    async peek(): Promise<MqttQueuedEvent | undefined> {
      return pending[0];
    },
    async size(): Promise<number> {
      return pending.length;
    },
    async clear(): Promise<void> {
      pending.length = 0;
      inFlight.clear();
    },
    async ack(id: string): Promise<void> {
      inFlight.delete(id);
    },
    async release(id: string, options: MqttQueueReleaseOptions = {}): Promise<void> {
      const event = inFlight.get(id);
      if (!event) return;
      const updated = {
        ...event,
        attempts: options.attempts ?? event.attempts + 1,
        ...(options.nextAttemptAt !== undefined ? { nextAttemptAt: options.nextAttemptAt } : {}),
      };
      inFlight.delete(id);
      pending.push(updated);
    },
    async deadLetter(id: string): Promise<void> {
      inFlight.delete(id);
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
      await queue.ack?.(event.id);
    } catch (err) {
      const attempts = (event.attempts ?? 0) + 1;
      if (attempts >= maxRetries) {
        const dead = createDeadLetterEvent(event, err instanceof Error ? err.message : String(err));
        if (onDeadLetter) onDeadLetter(dead);
        await queue.deadLetter?.(event.id, err instanceof Error ? err.message : String(err));
        failed++;
      } else {
        await queue.release?.(event.id, { attempts, nextAttemptAt: Date.now() });
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

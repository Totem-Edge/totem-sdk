/**
 * Durable claim/ack/retry queue for @totemsdk/edge-mqtt.
 *
 * Implements RFC-007 G4 at-least-once delivery: a message is only forgotten
 * after a durable `ack()`. A crash between `dequeue()` (claim) and `ack()`
 * leaves the claim durable, so `recoverInFlight()` on startup re-delivers the
 * event rather than losing it.
 *
 * Storage layout (single `StorageAdapter`, prefixed keys):
 *   key                value
 *   mqtt:event:<id>    { event, status: 'pending' | 'claimed' | 'dead',
 *                        attempts, nextAttemptAt }
 *
 * Claim/ack/release/dead-letter are guarded with the adapter's CAS
 * (`CasStore.conditionalUpdate`) so concurrent consumers and crash recovery
 * never double-claim or clobber an update. Building over a non-CAS adapter
 * throws at construction (RFC-007 §4.2 no-silent-downgrade).
 */

import type { StorageAdapter } from '@totemsdk/core';
import type {
  CasStore,
  StorageAdapterWithCapabilities,
  WriteAckMode,
} from '@totemsdk/storage/types';
import { assertCapabilities } from '@totemsdk/storage/types';
import type { MqttEdgeQueue, MqttQueuedEvent, MqttQueueReleaseOptions } from './types.js';

const EVENT_PREFIX = 'mqtt:event:';

type QueueStatus = 'pending' | 'claimed' | 'dead';

export interface DurableEventRecord {
  event: MqttQueuedEvent;
  status: QueueStatus;
  attempts: number;
  nextAttemptAt?: number;
  deadAt?: number;
  deadReason?: string;
}

export interface DurableMqttEdgeQueueOptions {
  /** Namespace prefix for the queue keys (default 'mqtt'). */
  namespace?: string;
  /**
   * Required write-ack level the backing adapter must satisfy (default
   * 'durably-acknowledged').
   */
  requireAckMode?: WriteAckMode;
}

/** Durable queue surface plus dead-letter observability. */
export type DurableMqttEdgeQueue = MqttEdgeQueue & {
  ack(id: string): Promise<void>;
  release(id: string, options?: MqttQueueReleaseOptions): Promise<void>;
  deadLetter(id: string, reason?: string): Promise<void>;
  recoverInFlight(maxAgeMs?: number): Promise<number>;
  deadLetterCount(): Promise<number>;
};

function isCasStore(adapter: StorageAdapter): adapter is StorageAdapter & CasStore {
  return typeof (adapter as unknown as CasStore).conditionalUpdate === 'function';
}

function keyFor(namespace: string, id: string): string {
  return `${namespace}:${EVENT_PREFIX}${id}`;
}

function readRecord(adapter: StorageAdapter, key: string): Promise<DurableEventRecord | null> {
  return adapter.get<DurableEventRecord>(key);
}

async function scanRecords(
  adapter: StorageAdapter,
  namespace: string,
): Promise<Array<{ key: string; record: DurableEventRecord }>> {
  const prefix = `${namespace}:${EVENT_PREFIX}`;
  const out: Array<{ key: string; record: DurableEventRecord }> = [];
  for (const key of await adapter.keys()) {
    if (!key.startsWith(prefix)) continue;
    const record = await readRecord(adapter, key);
    if (record) out.push({ key, record });
  }
  out.sort((a, b) => a.record.event.createdAt - b.record.event.createdAt);
  return out;
}

/**
 * Create a durable, at-least-once MQTT offline queue over a CAS-capable
 * adapter (`CasStore.conditionalUpdate`).
 *
 * After a restart, call `recoverInFlight()` before `dequeue()` to re-deliver
 * events that were claimed but never acked (the RFC-007 crash window).
 * Pending events are eligible for delivery again automatically on restart.
 */
export function createDurableMqttEdgeQueue(
  adapter: StorageAdapter,
  options: DurableMqttEdgeQueueOptions = {},
): DurableMqttEdgeQueue {
  const namespace = options.namespace ?? 'mqtt';

  if (typeof (adapter as StorageAdapterWithCapabilities).capabilities === 'object') {
    assertCapabilities(adapter as StorageAdapterWithCapabilities, {
      acknowledge: options.requireAckMode ?? 'durably-acknowledged',
      atomic: true,
      conditional: true,
    });
  }
  if (!isCasStore(adapter)) {
    throw new Error('createDurableMqttEdgeQueue requires a CAS-capable storage adapter (CasStore.conditionalUpdate)');
  }

  const cas = (adapter as StorageAdapter & CasStore).conditionalUpdate.bind(adapter);

  const scan = (): Promise<Array<{ key: string; record: DurableEventRecord }>> =>
    scanRecords(adapter, namespace);

  async function pendingEligible(record: DurableEventRecord): Promise<boolean> {
    if (record.status !== 'pending') return false;
    if (record.nextAttemptAt !== undefined && record.nextAttemptAt > Date.now()) return false;
    return true;
  }

  async function claimOnce(): Promise<MqttQueuedEvent | undefined> {
    for (const { key, record } of await scan()) {
      if (!(await pendingEligible(record))) continue;
      const result = await cas<DurableEventRecord>(
        key,
        (current) => {
          if (!current || current.status !== 'pending') return { abort: 'not pending' };
          if (current.nextAttemptAt !== undefined && current.nextAttemptAt > Date.now()) {
            return { abort: 'backoff' };
          }
          return { next: { ...current, status: 'claimed', attempts: current.attempts + 1 } };
        },
      );
      if (result.applied && result.value) {
        return { ...result.value.event, attempts: result.value.attempts };
      }
    }
    return undefined;
  }

  return {
    async enqueue(event: MqttQueuedEvent): Promise<void> {
      const record: DurableEventRecord = {
        event,
        status: 'pending',
        attempts: event.attempts ?? 0,
        ...(event.nextAttemptAt !== undefined ? { nextAttemptAt: event.nextAttemptAt } : {}),
      };
      await adapter.set(keyFor(namespace, event.id), record);
    },

    async dequeue(): Promise<MqttQueuedEvent | undefined> {
      return claimOnce();
    },

    async peek(): Promise<MqttQueuedEvent | undefined> {
      for (const { record } of await scan()) {
        if (await pendingEligible(record)) return record.event;
      }
      return undefined;
    },

    async size(): Promise<number> {
      let count = 0;
      for (const { record } of await scan()) {
        if (record.status === 'pending') count++;
      }
      return count;
    },

    /** Durable acknowledgment: forget the event once published. */
    async ack(id: string): Promise<void> {
      const key = keyFor(namespace, id);
      const record = await readRecord(adapter, key);
      if (!record) return;
      if (record.status !== 'claimed') return;
      await adapter.remove(key);
    },

    /** Return a claimed event to pending for a later retry attempt. */
    async release(id: string, options: MqttQueueReleaseOptions = {}): Promise<void> {
      const key = keyFor(namespace, id);
      const result = await cas<DurableEventRecord>(
        key,
        (current) => {
          if (!current || current.status !== 'claimed') return { abort: 'not claimed' };
          return {
            next: {
              ...current,
              status: 'pending',
              attempts: options.attempts ?? current.attempts,
              ...(options.nextAttemptAt !== undefined
                ? { nextAttemptAt: options.nextAttemptAt }
                : { nextAttemptAt: undefined }),
            },
          };
        },
      );
      if (!result.applied) return;
    },

    /** Durably move a claimed event to the dead-letter set (never re-delivered). */
    async deadLetter(id: string, reason?: string): Promise<void> {
      const key = keyFor(namespace, id);
      const result = await cas<DurableEventRecord>(
        key,
        (current) => {
          if (!current || current.status !== 'claimed') return { abort: 'not claimed' };
          return {
            next: {
              ...current,
              status: 'dead',
              deadAt: Date.now(),
              ...(reason !== undefined ? { deadReason: reason } : {}),
            },
          };
        },
      );
      if (!result.applied) return;
    },

    /** Reset in-flight (claimed, never acked) events to pending after a crash. */
    async recoverInFlight(maxAgeMs?: number): Promise<number> {
      let recovered = 0;
      const now = Date.now();
      for (const { key, record } of await scan()) {
        if (record.status !== 'claimed') continue;
        if (maxAgeMs !== undefined && now - record.event.createdAt < maxAgeMs) continue;
        const result = await cas<DurableEventRecord>(
          key,
          (current) => {
            if (!current || current.status !== 'claimed') return { abort: 'not claimed' };
            return { next: { ...current, status: 'pending' } };
          },
        );
        if (result.applied) recovered++;
      }
      return recovered;
    },

    async deadLetterCount(): Promise<number> {
      let count = 0;
      for (const { record } of await scan()) {
        if (record.status === 'dead') count++;
      }
      return count;
    },

    async clear(): Promise<void> {
      for (const { key } of await scan()) {
        await adapter.remove(key);
      }
    },
  };
}

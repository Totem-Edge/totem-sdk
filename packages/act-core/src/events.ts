/**
 * RFC-011 §4.6 — lifecycle events and audit stream.
 *
 * Every transition emits a structured event. Events are the operational
 * timeline; receipts (RFC-010 §6.7) are the cryptographic summary. A durable
 * sink (revision-CAS snapshot) makes the timeline survivable.
 */

import {
  createRevisionedSnapshotStore,
  type RevisionedSnapshotStore,
} from '@totemsdk/storage/snapshot';
import type { StorageAdapterWithCapabilities, CasStore, WriteAckMode } from '@totemsdk/storage/types';
import { StorageError } from '@totemsdk/storage/errors';
import type { ResourceId } from './resources.js';
import type { ActionOutcome } from './edge-adapter.js';

const DEFAULT_NAMESPACE = 'totem_industrial_events:v1:';

export type IndustrialActionEventType =
  | 'proposed'
  | 'validated'
  | 'guardrails_passed'
  | 'interlocks_passed'
  | 'authorized'
  | 'reserved'
  | 'actuation_started'
  | 'actuation_succeeded'
  | 'actuation_failed'
  | 'retried'
  | 'rolled_back'
  | 'settled'
  | 'rejected';

export interface IndustrialActionEvent {
  type: IndustrialActionEventType;
  actionId?: string;
  proposalId?: string;
  operationId?: string;
  resourceId?: ResourceId;
  /** Injectable clock / chain block. */
  at: number;
  outcome?: ActionOutcome;
  attempts?: number;
  detail?: Record<string, unknown>;
}

export interface ActionEventSink {
  emit(event: IndustrialActionEvent): void | Promise<void>;
}

export interface ActionEventStream extends ActionEventSink {
  list(): Promise<IndustrialActionEvent[]>;
}

/** In-memory event sink (tests / ephemeral runtimes). */
export function createMemoryActionEventSink(): ActionEventStream & { events: IndustrialActionEvent[] } {
  const events: IndustrialActionEvent[] = [];
  return {
    events,
    emit: (event) => {
      events.push(event);
    },
    list: async () => [...events],
  };
}

export interface DurableActionEventSinkOptions {
  readonly namespace?: string;
  readonly requireAckMode?: WriteAckMode;
}

interface EventState {
  events: IndustrialActionEvent[];
}

export function createDurableActionEventSink(
  adapter: StorageAdapterWithCapabilities & CasStore,
  options: DurableActionEventSinkOptions = {},
): ActionEventStream {
  const snapshots: RevisionedSnapshotStore<EventState> = createRevisionedSnapshotStore(adapter, {
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    requireAckMode: options.requireAckMode,
    empty: (): EventState => ({ events: [] }),
    validate: assertEventState,
  });

  return {
    async emit(event) {
      await snapshots.mutate((state) => ({ events: [...state.events, event] }));
    },
    async list() {
      const state: EventState = await snapshots.load();
      return [...state.events];
    },
  };
}

function assertEventState(state: EventState): void {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new StorageError('action event state is not an object', 'corrupt');
  }
  if (!Array.isArray((state as unknown as Record<string, unknown>).events)) {
    throw new StorageError('action event state is missing section "events"', 'corrupt');
  }
}

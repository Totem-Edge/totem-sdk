/**
 * RFC-057 Phase 4 — replicated industrial-action event stream.
 *
 * The durable local sink remains authoritative for a device. This sink mirrors
 * the same structured event timeline into a replicated log for multi-device
 * audit and recovery; it does not authorize or actuate actions.
 */

import type { ReplicatedLog } from '@totemsdk/replication';
import type { ActionEventStream, IndustrialActionEvent } from './events.js';

export function createReplicatedActionEventSink(
  log: ReplicatedLog<IndustrialActionEvent>,
): ActionEventStream {
  return {
    async emit(event) {
      await log.append(event);
    },
    async list() {
      const events: IndustrialActionEvent[] = [];
      for await (const entry of log.readSince()) events.push(entry.record);
      return events;
    },
  };
}

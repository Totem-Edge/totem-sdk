/**
 * RFC-057 Phase 4 — replicated edge device event history.
 *
 * A compact, append-only timeline for devices. It complements the authoritative
 * local operation store; it does not authorize or replay operations.
 */

import type { ReplicatedLog } from '@totemsdk/replication';

export interface EdgeDeviceEvent {
  readonly eventId: string;
  readonly deviceId: string;
  readonly kind: string;
  readonly at: number;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export class EdgeReplicatedDeviceHistory {
  constructor(private readonly log: ReplicatedLog<EdgeDeviceEvent>) {}

  async append(event: EdgeDeviceEvent): Promise<{ length: number; head: string }> {
    if (!event.eventId || !event.deviceId) throw new Error('edge device event requires eventId and deviceId');
    if (!Number.isFinite(event.at) || event.at < 0) throw new Error('edge device event requires a non-negative at');
    return this.log.append(event);
  }

  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: EdgeDeviceEvent }> {
    return this.log.readSince(cursor);
  }

  status() {
    return this.log.status();
  }

  close(): Promise<void> {
    return this.log.close();
  }
}

/**
 * RFC-057 Phase 4 — replicated announcement discovery.
 *
 * Announcements remain signed, self-verifying envelopes. The replicated log is
 * only a discovery/transport substrate: every replay verifies signatures,
 * expiry and monotonic sequences through the existing in-memory store.
 */

import type { ReplicatedLog } from '@totemsdk/replication';
import {
  MemoryAnnouncementStore,
  type AnnouncementAcceptOptions,
  type AnnouncementAcceptResult,
  type AnnouncementQuery,
} from './announcement-store.js';
import type { SignedAnnouncement } from './announcement.js';

export class ReplicatedAnnouncementStore {
  constructor(private readonly log: ReplicatedLog<SignedAnnouncement>) {}

  /** Verify, accept locally, then append the signed envelope to the replica. */
  async upsert(
    signed: SignedAnnouncement,
    options: AnnouncementAcceptOptions = {},
  ): Promise<AnnouncementAcceptResult> {
    const store = new MemoryAnnouncementStore();
    const result = await store.upsert(signed, options);
    if (!result.accepted) return result;
    await this.log.append(signed);
    return result;
  }

  /** Replay the replicated log through the verified, ranked in-memory store. */
  async list(query: AnnouncementQuery = {}): Promise<SignedAnnouncement[]> {
    const store = new MemoryAnnouncementStore();
    for await (const entry of this.log.readSince()) await store.upsert(entry.record);
    return store.list(query);
  }

  async get(announcementId: string): Promise<SignedAnnouncement | undefined> {
    const store = new MemoryAnnouncementStore();
    for await (const entry of this.log.readSince()) await store.upsert(entry.record);
    return store.get(announcementId);
  }

  async close(): Promise<void> {
    await this.log.close();
  }
}

import { createUnifiedChildTreeKey, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import { createAnnouncement, signAnnouncement, type AnnouncementEnvelope } from '../announcement.js';
import { ReplicatedAnnouncementStore } from '../replicated-announcements.js';
import type { SignedAnnouncement } from '../announcement.js';

const TEST_TREE = createUnifiedChildTreeKey(new Uint8Array(32).fill(0x31), 0);
const PUBLISHER = scriptToAddress(scriptFromWotsPk(TEST_TREE.getPublicKey()));

function announcement(sequence: number): AnnouncementEnvelope {
  return createAnnouncement({
    kind: 'liquidity-pool',
    subjectId: 'pool-1',
    subjectHash: '0x' + '11'.repeat(32),
    publisher: PUBLISHER,
    sequence,
    createdAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    asset: 'MIN',
    custody: { mode: 'self' },
    liquidity: { mode: 'exact', verifiedAvailable: '1000' },
    topics: ['totemsdk:announcement:v1:liquidity-pool'],
    payload: { poolType: 'omnia-router' },
    nonce: `nonce-${sequence}`,
  });
}

function fakeLog() {
  const records: SignedAnnouncement[] = [];
  return {
    async append(record: SignedAnnouncement) {
      records.push(record);
      return { length: records.length, head: `h:${records.length}` };
    },
    async *readSince(cursor?: string) {
      const start = cursor ? Number(cursor.split(':')[1]) : 0;
      for (let i = start; i < records.length; i += 1) yield { cursor: `h:${i + 1}`, record: records[i] };
    },
    status: () => ({ connectedPeers: 0, localHead: null, observedHeads: [], syncing: false }),
    async close() {},
  };
}

describe('replicated announcements', () => {
  it('accepts a verified announcement and replays it', async () => {
    const signed = await signAnnouncement(announcement(1), TEST_TREE, 0);
    const store = new ReplicatedAnnouncementStore(fakeLog());
    expect((await store.upsert(signed, { now: 1_750_000_000_000 })).accepted).toBe(true);
    expect(await store.list({ now: 1_750_000_000_000 })).toHaveLength(1);
    expect((await store.get(signed.announcement.announcementId))?.announcement.sequence).toBe(1);
  });

  it('does not append an invalid announcement', async () => {
    const signed = await signAnnouncement(announcement(1), TEST_TREE, 0);
    const tampered = { ...signed, announcement: { ...signed.announcement, expiresAt: signed.announcement.expiresAt + 1 } };
    const store = new ReplicatedAnnouncementStore(fakeLog());
    expect((await store.upsert(tampered, { now: 1_750_000_000_000 })).accepted).toBe(false);
    expect(await store.list({ now: 1_750_000_000_000 })).toHaveLength(0);
  });
});

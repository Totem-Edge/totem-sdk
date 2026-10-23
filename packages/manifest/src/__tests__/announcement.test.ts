import { createUnifiedChildTreeKey, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import {
  announcementTopic,
  createAnnouncement,
  rankAnnouncements,
  signAnnouncement,
  verifyAnnouncement,
  type AnnouncementEnvelope,
} from '../announcement.js';
import { MemoryAnnouncementStore } from '../announcement-store.js';

const TEST_SEED = new Uint8Array(32).fill(0x42);
const TEST_TREE = createUnifiedChildTreeKey(TEST_SEED, 0);
const PUBLISHER = scriptToAddress(scriptFromWotsPk(TEST_TREE.getPublicKey()));

function poolAnnouncement(overrides: Partial<AnnouncementEnvelope> = {}): AnnouncementEnvelope {
  return createAnnouncement({
    kind: 'liquidity-pool',
    subjectId: overrides.subjectId ?? 'pool-1',
    subjectHash: '0x' + '11'.repeat(32),
    publisher: PUBLISHER,
    sequence: overrides.sequence ?? 1,
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
    expiresAt: overrides.expiresAt ?? 1_800_000_000_000,
    asset: overrides.asset ?? 'MIN',
    custody: overrides.custody ?? { mode: 'self' },
    liquidity: overrides.liquidity ?? { mode: 'exact', verifiedAvailable: '1000' },
    topics: ['totemsdk:announcement:v1:liquidity-pool'],
    payload: { poolType: 'omnia-router', purpose: 'route-reserve' },
    nonce: 'nonce-1',
  });
}

describe('announcement envelope', () => {
  it('creates a canonical id and payload hash', () => {
    const announcement = poolAnnouncement();
    expect(announcement.announcementId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(announcement.payloadHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(announcement.announcementId).toBe(
      createAnnouncement({ ...announcement, nonce: 'other' }).announcementId,
    );
  });

  it('signs and verifies', async () => {
    const announcement = poolAnnouncement();
    const signed = await signAnnouncement(announcement, TEST_TREE, 0);
    const result = verifyAnnouncement(signed, { now: 1_750_000_000_000 });
    expect(result.valid).toBe(true);
    expect(result.signerAddress).toBe(announcement.publisher);
  });

  it('rejects tampering and expiry', async () => {
    const announcement = poolAnnouncement();
    const signed = await signAnnouncement(announcement, TEST_TREE, 1);

    const tampered = {
      ...signed,
      announcement: { ...signed.announcement, expiresAt: signed.announcement.expiresAt + 1 },
    };
    expect(verifyAnnouncement(tampered).valid).toBe(false);
    expect(verifyAnnouncement(signed, { now: signed.announcement.expiresAt }).valid).toBe(false);
  });

  it('derives deterministic topics', () => {
    const a = announcementTopic({ kind: 'liquidity-pool', asset: 'MIN' });
    const b = announcementTopic({ kind: 'liquidity-pool', asset: 'MIN' });
    const c = announcementTopic({ index: true });
    expect(Buffer.from(a).toString('hex')).toBe(Buffer.from(b).toString('hex'));
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(c).toString('hex'));
  });

  it('ranks custody first, then verified liquidity', () => {
    const self = poolAnnouncement({
      subjectId: 'pool-self',
      custody: { mode: 'self' },
      liquidity: { mode: 'exact', verifiedAvailable: '10' },
    });
    const trust = poolAnnouncement({
      subjectId: 'pool-trust',
      custody: { mode: 'trust-minimised' },
      liquidity: { mode: 'exact', verifiedAvailable: '999999' },
    });
    const hosted = poolAnnouncement({
      subjectId: 'pool-hosted',
      custody: { mode: 'hosted' },
      liquidity: { mode: 'exact', verifiedAvailable: '9999999' },
    });

    expect(rankAnnouncements([hosted, trust, self]).map((a) => a.subjectId)).toEqual([
      'pool-self',
      'pool-trust',
      'pool-hosted',
    ]);
  });
});

describe('MemoryAnnouncementStore', () => {
  const NOW = 1_750_000_000_000;

  it('accepts, ranks and dedupes by sequence', async () => {
    const store = new MemoryAnnouncementStore({ now: () => NOW });
    const first = await signAnnouncement(poolAnnouncement({ sequence: 1 }), TEST_TREE, 2);
    expect((await store.upsert(first, { now: NOW })).accepted).toBe(true);

    const stale = await signAnnouncement(poolAnnouncement({ sequence: 1 }), TEST_TREE, 3);
    expect((await store.upsert(stale, { now: NOW })).accepted).toBe(false);

    const newer = await signAnnouncement(poolAnnouncement({ sequence: 2 }), TEST_TREE, 4);
    expect((await store.upsert(newer, { now: NOW })).accepted).toBe(true);
    expect(store.list({ now: NOW })).toHaveLength(1);
    expect(store.list({ now: NOW })[0].announcement.sequence).toBe(2);
  });

  it('filters by kind, asset and custody', async () => {
    const store = new MemoryAnnouncementStore({ now: () => NOW });
    await store.upsert(
      await signAnnouncement(
        poolAnnouncement({ subjectId: 'pool-self', custody: { mode: 'self' } }),
        TEST_TREE,
        5,
      ),
      { now: NOW },
    );
    await store.upsert(
      await signAnnouncement(
        poolAnnouncement({ subjectId: 'pool-hosted', custody: { mode: 'hosted' } }),
        TEST_TREE,
        6,
      ),
      { now: NOW },
    );

    expect(store.list({ now: NOW, custody: 'self' })).toHaveLength(1);
    expect(store.list({ now: NOW, asset: 'MIN' })).toHaveLength(2);
    expect(store.list({ now: NOW, kind: 'credit-offer' })).toHaveLength(0);
  });

  it('rejects expired announcements and prunes them', async () => {
    const store = new MemoryAnnouncementStore({ now: () => NOW });
    const expired = await signAnnouncement(
      poolAnnouncement({ expiresAt: NOW - 1 }),
      TEST_TREE,
      7,
    );
    expect((await store.upsert(expired, { now: NOW })).accepted).toBe(false);

    const live = await signAnnouncement(poolAnnouncement(), TEST_TREE, 8);
    await store.upsert(live, { now: NOW });
    expect(store.removeExpired(NOW + 100_000_000_000)).toBe(1);
    expect(store.size).toBe(0);
  });
});

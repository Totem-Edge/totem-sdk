import { createUnifiedChildTreeKey, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import {
  announcementTopic,
  createAnnouncement,
  rankAnnouncements,
  signAnnouncement,
  verifyAnnouncement,
  type AnnouncementEnvelope,
} from '../announcement.js';

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
    createdAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
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

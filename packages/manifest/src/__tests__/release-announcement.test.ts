import { createUnifiedChildTreeKey } from '@totemsdk/core';
import { publishReleaseAnnouncement, verifyAnnouncement } from '../announcement.js';
import { evaluateReleaseFeed, releaseFeedFromAnnouncements } from '../release-feed.js';

const SEED = new Uint8Array(32).fill(0x11);
const TREE = createUnifiedChildTreeKey(SEED, 0);
const NOW = 1_800_000_000_000;

describe('release announcements', () => {
  it('signs a sdk-release announcement that verifies', async () => {
    const signed = await publishReleaseAnnouncement({
      kind: 'sdk-release',
      sequence: 1,
      useIndex: 0,
      now: NOW,
      payload: {
        packages: [
          { name: '@totemsdk/omnia-host', distTags: { next: '0.13.2' }, recommended: '0.13.2', versions: [{ version: '0.13.2' }] },
        ],
      },
      treeKey: TREE,
    });
    expect(signed.announcement.kind).toBe('sdk-release');
    expect(signed.announcement.topics).toContain('sdk-release');
    const verified = verifyAnnouncement(signed, { now: NOW });
    expect(verified.valid).toBe(true);
  });

  it('projects signed announcements into an evaluable feed', async () => {
    const release = await publishReleaseAnnouncement({
      kind: 'sdk-release',
      sequence: 2,
      useIndex: 1,
      now: NOW,
      payload: {
        packages: [
          { name: '@totemsdk/edge-mqtt', distTags: { latest: '0.2.5' }, recommended: '0.2.5', versions: [{ version: '0.2.5' }] },
        ],
      },
      treeKey: TREE,
    });
    const advisory = await publishReleaseAnnouncement({
      kind: 'security-advisory',
      sequence: 3,
      useIndex: 2,
      now: NOW,
      payload: {
        advisories: [
          { id: 'TOTEM-2026-002', severity: 'critical', title: 'test', affected: [{ name: '@totemsdk/edge-mqtt', range: '<0.2.5' }], patchedIn: '0.2.5' },
        ],
      },
      treeKey: TREE,
    });

    const feed = releaseFeedFromAnnouncements([release, advisory], { now: NOW + 1000 });
    const result = evaluateReleaseFeed(feed, { '@totemsdk/edge-mqtt': '0.2.0' });

    expect(feed.packages.map((p) => p.name)).toEqual(['@totemsdk/edge-mqtt']);
    expect(result.updates).toHaveLength(1);
    expect(result.advisories).toEqual([
      expect.objectContaining({ id: 'TOTEM-2026-002', severity: 'critical', installed: '0.2.0' }),
    ]);
  });

  it('ignores expired announcements and lets the newest sequence win', async () => {
    const old = await publishReleaseAnnouncement({
      kind: 'sdk-release', publisher: 'totem:release', sequence: 1, useIndex: 3, now: NOW - 100, ttlMs: 10, treeKey: TREE,
      payload: { packages: [{ name: '@totemsdk/x', distTags: { latest: '0.0.1' }, recommended: '0.0.1', versions: [{ version: '0.0.1' }] }] },
    });
    const fresh = await publishReleaseAnnouncement({
      kind: 'sdk-release', publisher: 'totem:release', sequence: 2, useIndex: 4, now: NOW, treeKey: TREE,
      payload: { packages: [{ name: '@totemsdk/x', distTags: { latest: '0.0.2' }, recommended: '0.0.2', versions: [{ version: '0.0.2' }] }] },
    });
    const feed = releaseFeedFromAnnouncements([old, fresh], { now: NOW + 1 });
    expect(feed.packages).toHaveLength(1);
    expect(feed.packages[0]!.recommended).toBe('0.0.2');
  });
});

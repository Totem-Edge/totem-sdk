import { compareVersions, evaluateReleaseFeed, satisfiesRange, type ReleaseFeed } from '../release-feed.js';

const feed: ReleaseFeed = {
  schema: 'totemsdk-release-feed/v1',
  generatedAt: '2026-10-28T00:00:00.000Z',
  packages: [
    { name: '@totemsdk/omnia-host', distTags: { latest: '0.10.0', next: '0.13.2' }, recommended: '0.13.2', versions: [{ version: '0.10.0' }, { version: '0.13.1' }, { version: '0.13.2' }] },
    { name: '@totemsdk/chain-provider', distTags: { next: '0.3.1' }, versions: [{ version: '0.3.0' }, { version: '0.3.1' }] },
  ],
  advisories: [
    { id: 'TOTEM-2026-001', severity: 'high', title: 'test advisory', affected: [{ name: '@totemsdk/omnia-host', range: '>=0.13.0 <0.13.2' }], patchedIn: '0.13.2' },
  ],
};

describe('release feed', () => {
  it('compares versions including prereleases', () => {
    expect(compareVersions('0.13.2', '0.13.1')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(compareVersions('0.3.1', '0.3.1')).toBe(0);
  });

  it('evaluates caret, tilde and comparator ranges', () => {
    expect(satisfiesRange('0.13.1', '>=0.13.0 <0.13.2')).toBe(true);
    expect(satisfiesRange('0.13.2', '>=0.13.0 <0.13.2')).toBe(false);
    expect(satisfiesRange('0.13.5', '^0.13.0')).toBe(true);
    expect(satisfiesRange('0.14.0', '^0.13.0')).toBe(false);
    expect(satisfiesRange('0.3.9', '~0.3.1')).toBe(true);
  });

  it('reports available updates without enforcing them', () => {
    const result = evaluateReleaseFeed(feed, { '@totemsdk/omnia-host': '0.13.1' });
    expect(result.updates).toEqual([
      { name: '@totemsdk/omnia-host', installed: '0.13.1', recommended: '0.13.2', newest: '0.13.2', severity: 'info' },
    ]);
    expect(result.advisories).toEqual([
      { id: 'TOTEM-2026-001', severity: 'high', title: 'test advisory', package: '@totemsdk/omnia-host', installed: '0.13.1', patchedIn: '0.13.2', url: undefined },
    ]);
  });

  it('stays quiet when installed matches the recommendation', () => {
    const result = evaluateReleaseFeed(feed, { '@totemsdk/omnia-host': '0.13.2' });
    expect(result.updates).toEqual([]);
    expect(result.advisories).toEqual([]);
  });

  it('flags unknown packages/versions instead of guessing', () => {
    const result = evaluateReleaseFeed(feed, { '@totemsdk/unknown': '1.0.0', '@totemsdk/chain-provider': '9.9.9' });
    expect(result.unknownInstalled).toEqual(['@totemsdk/unknown', '@totemsdk/chain-provider']);
  });
});

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUpdateChecker, discoverInstalledTotemPackages } from '../release-feed.js';

describe('sdk-wide update awareness', () => {
  function fakeTree(pkgs: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'totem-feed-'));
    for (const [name, version] of Object.entries(pkgs)) {
      const dir = join(root, 'node_modules', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
    }
    return root;
  }

  it('discovers installed @totemsdk packages from node_modules', async () => {
    const root = fakeTree({ '@totemsdk/edge-mqtt': '0.2.5', '@totemsdk/lookup-node': '0.3.0' });
    const found = await discoverInstalledTotemPackages({ from: root, maxDepth: 2 });
    expect(found).toEqual({ '@totemsdk/edge-mqtt': '0.2.5', '@totemsdk/lookup-node': '0.3.0' });
  });

  it('works without any explicit installed list (any runtime)', async () => {
    const seen: unknown[] = [];
    const checker = createUpdateChecker({
      url: 'https://example.test/feed.json',
      installed: { '@totemsdk/edge-mqtt': '0.1.0' },
      fetchImpl: (async () => ({
        ok: true,
        json: async () => ({
          schema: 'totemsdk-release-feed/v1',
          generatedAt: '2026-10-28T00:00:00.000Z',
          packages: [
            { name: '@totemsdk/edge-mqtt', distTags: { latest: '0.2.5' }, recommended: '0.2.5', versions: [{ version: '0.2.5' }] },
          ],
        }),
      })) as unknown as typeof fetch,
      onResult: (r) => seen.push(r),
    });
    const result = await checker.check();
    expect(result?.updates).toEqual([
      { name: '@totemsdk/edge-mqtt', installed: '0.1.0', recommended: '0.2.5', newest: '0.2.5', severity: 'info' },
    ]);
    expect(seen).toHaveLength(1);
  });

  it('is inert without a url and never reports on a clean fleet', async () => {
    await expect(createUpdateChecker({}).check()).resolves.toBeNull();
    const clean = createUpdateChecker({
      url: 'https://example.test/feed.json',
      installed: { '@totemsdk/edge-mqtt': '0.2.5' },
      fetchImpl: (async () => ({
        ok: true,
        json: async () => ({
          schema: 'totemsdk-release-feed/v1',
          generatedAt: 'x',
          packages: [{ name: '@totemsdk/edge-mqtt', distTags: { latest: '0.2.5' }, recommended: '0.2.5', versions: [{ version: '0.2.5' }] }],
        }),
      })) as unknown as typeof fetch,
    });
    await expect(clean.check()).resolves.toBeNull();
  });
});

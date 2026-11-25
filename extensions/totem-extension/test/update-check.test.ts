/**
 * Extension update detection.
 *
 * Regression: the check accepted only the legacy `totem-extension-1.2.3.zip`
 * asset name. Every build after 1.0.27 publishes `totem-extension-v1.2.3.zip`
 * (and, once the release workflow was fixed, both), so the notice silently
 * compared the running build against a stale version and never fired.
 */

import { isNewerVersion, latestFromAssets } from '../src/core/announcements/updateCheck';

describe('latestFromAssets', () => {
  const asset = (name: string) => ({ name, browser_download_url: `x/${name}` });

  it('reads the version from version-stamped assets', () => {
    expect(
      latestFromAssets([
        asset('totem-extension.zip'),
        asset('totem-extension-v1.0.27.zip'),
        asset('totem-extension-v1.0.29.zip'),
      ])
    ).toBe('1.0.29');
  });

  it('accepts the legacy unprefixed spelling', () => {
    expect(
      latestFromAssets([asset('totem-extension-1.0.26.zip'), asset('totem-extension-1.0.27.zip')])
    ).toBe('1.0.27');
  });

  it('ignores non-zip, build-stamped and checksum assets', () => {
    expect(
      latestFromAssets([
        asset('totem-extension.crx'),
        asset('totem-extension-build-20260101-000000.zip'),
        asset('SHA256SUMS.txt'),
        asset('totem-extension.xml'),
      ])
    ).toBeNull();
  });

  it('returns null for a malformed asset list', () => {
    expect(latestFromAssets(undefined)).toBeNull();
    expect(latestFromAssets([null, { name: 42 }])).toBeNull();
  });
});

describe('isNewerVersion', () => {
  it('compares numerically, not lexically', () => {
    expect(isNewerVersion('1.0.30', '1.0.29')).toBe(true);
    expect(isNewerVersion('1.0.9', '1.0.10')).toBe(false);
    expect(isNewerVersion('1.0.29', '1.0.29')).toBe(false);
    expect(isNewerVersion('v1.1.0', '1.0.99')).toBe(true);
  });
});

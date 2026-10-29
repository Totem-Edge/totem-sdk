/**
 * Hawk-mode watermark migration guard (RFC-013 / RFC-062 Amendment A).
 */

import './setup';

import {
  assertHawkWatermarkSafe,
  readWatermarkSafetyState,
  recordAxiaLease,
  recordWatermarkMirror,
  recordWatermarkSync,
} from '../src/core/providers/watermarkSafety';

const store: Record<string, any> = {};

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, callback?: any) => {
    const list = Array.isArray(keys) ? keys : [keys];
    const result = Object.fromEntries(list.map((key: string) => [key, store[key]]));
    callback?.(result);
    return Promise.resolve(result);
  });
  (chrome.storage.local.set as jest.Mock).mockImplementation((values: any, callback?: any) => {
    Object.assign(store, values);
    callback?.();
    return Promise.resolve();
  });
});

describe('Hawk watermark safety', () => {
  test('a fresh Hawk-only wallet is allowed', async () => {
    await expect(assertHawkWatermarkSafe()).resolves.toBeUndefined();
  });

  test('Axia usage with no failures is allowed', async () => {
    await recordAxiaLease();
    await expect(assertHawkWatermarkSafe()).resolves.toBeUndefined();
  });

  test('a failed Axia→local mirror blocks local signing', async () => {
    await recordAxiaLease();
    await recordWatermarkMirror(false, 'disk full');

    const state = await readWatermarkSafetyState();
    expect(state.everUsedAxia).toBe(true);
    await expect(assertHawkWatermarkSafe()).rejects.toThrow(/watermark was not updated/i);
  });

  test('a later successful Axia sync clears the mirror failure', async () => {
    await recordAxiaLease();
    await recordWatermarkMirror(false, 'disk full');
    await new Promise((resolve) => setTimeout(resolve, 2));
    await recordWatermarkSync(true);

    await expect(assertHawkWatermarkSafe()).resolves.toBeUndefined();
  });

  test('a failed unlock sync blocks local signing until a later mirror succeeds', async () => {
    await recordAxiaLease();
    await recordWatermarkSync(false, 'axia offline');

    await expect(assertHawkWatermarkSafe()).rejects.toThrow(/sync failed/i);

    await new Promise((resolve) => setTimeout(resolve, 2));
    await recordWatermarkMirror(true);
    await expect(assertHawkWatermarkSafe()).resolves.toBeUndefined();
  });
});

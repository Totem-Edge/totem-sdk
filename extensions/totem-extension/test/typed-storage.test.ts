/**
 * Regression test for the runtime `chrome.storage.*.getTyped` polyfill.
 *
 * RFC-013 (`3ac959e`) switched ~60 call sites from `chrome.storage.local.get`
 * to `.getTyped` but only shipped the type declaration
 * (`src/types/chrome-storage.d.ts`). At runtime `getTyped` was `undefined`, so
 * the popup's first storage read threw `TypeError: ... is not a function`, the
 * React tree unmounted, and the popup collapsed to a tiny dark box.
 *
 * `src/core/storage/typedStorage.ts` installs the missing runtime. These tests
 * lock in its behaviour and overloads.
 */
import { installTypedStorage } from '../src/core/storage/typedStorage';

type AnyFn = (...args: unknown[]) => unknown;

function makeMockArea() {
  const calls: unknown[][] = [];
  const get: AnyFn = (...args: unknown[]) => {
    calls.push(args);
    // Resolve like Chrome: promise when called without a trailing callback.
    const maybeCb = args[args.length - 1];
    if (typeof maybeCb === 'function') {
      (maybeCb as (items: Record<string, unknown>) => void)({ key: 'value' });
      return undefined;
    }
    return Promise.resolve({ key: 'value' });
  };
  return { area: { get } as { get: AnyFn; getTyped?: AnyFn }, calls };
}

describe('typedStorage runtime polyfill', () => {
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('installs getTyped on local, session and sync', () => {
    const local = makeMockArea();
    const session = makeMockArea();
    const sync = makeMockArea();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: { local: local.area, session: session.area, sync: sync.area },
    };

    installTypedStorage();

    expect(typeof local.area.getTyped).toBe('function');
    expect(typeof session.area.getTyped).toBe('function');
    expect(typeof sync.area.getTyped).toBe('function');
  });

  it('delegates the promise overload to the real get', async () => {
    const { area, calls } = makeMockArea();
    (globalThis as { chrome?: unknown }).chrome = { storage: { local: area } };

    installTypedStorage();

    const result = await (area.getTyped as AnyFn)(['a', 'b']);
    expect(result).toEqual({ key: 'value' });
    expect(calls[0]).toEqual([['a', 'b']]);
  });

  it('delegates the callback overload to the real get', () => {
    const { area } = makeMockArea();
    (globalThis as { chrome?: unknown }).chrome = { storage: { local: area } };

    installTypedStorage();

    const seen: unknown[] = [];
    (area.getTyped as AnyFn)(['a'], (items: unknown) => seen.push(items));
    expect(seen).toEqual([{ key: 'value' }]);
  });

  it('is idempotent and does not clobber an existing getTyped', () => {
    const existing: AnyFn = () => 'original';
    const area = { get: jest.fn(), getTyped: existing };
    (globalThis as { chrome?: unknown }).chrome = { storage: { local: area } };

    installTypedStorage();
    installTypedStorage();

    expect(area.getTyped).toBe(existing);
  });

  it('no-ops when chrome.storage is unavailable', () => {
    expect(() => installTypedStorage()).not.toThrow();
  });
});

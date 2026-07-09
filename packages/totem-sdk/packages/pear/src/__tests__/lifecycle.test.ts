/**
 * Lifecycle tests — onExit, runExitHandlers, createPearApp
 *
 * Verifies that teardown callbacks fire in LIFO order and that
 * the Pear runtime hook is registered when `globalThis.Pear` is present.
 */

import {
  onExit,
  runExitHandlers,
  createPearApp,
  _resetForTesting,
} from '../lifecycle';

beforeEach(() => {
  _resetForTesting();
});

describe('onExit / runExitHandlers', () => {
  it('registered callback is called on runExitHandlers', async () => {
    const called: string[] = [];
    onExit(() => { called.push('cb1'); });
    await runExitHandlers();
    expect(called).toEqual(['cb1']);
  });

  it('callbacks fire in LIFO order', async () => {
    const order: number[] = [];
    onExit(() => { order.push(1); });
    onExit(() => { order.push(2); });
    onExit(() => { order.push(3); });
    await runExitHandlers();
    expect(order).toEqual([3, 2, 1]);
  });

  it('unsubscribe removes the callback', async () => {
    const called: string[] = [];
    const unsub = onExit(() => { called.push('should-not-fire'); });
    onExit(() => { called.push('should-fire'); });
    unsub();
    await runExitHandlers();
    expect(called).toEqual(['should-fire']);
  });

  it('async callbacks are awaited', async () => {
    const order: string[] = [];
    onExit(async () => {
      await new Promise<void>(r => setTimeout(r, 10));
      order.push('async-done');
    });
    await runExitHandlers();
    expect(order).toEqual(['async-done']);
  });

  it('a throwing callback does not abort remaining handlers', async () => {
    const called: string[] = [];
    onExit(() => { called.push('before'); });
    onExit(() => { throw new Error('boom'); });
    onExit(() => { called.push('after'); });
    await expect(runExitHandlers()).resolves.toBeUndefined();
    expect(called).toContain('before');
    expect(called).toContain('after');
  });

  it('runExitHandlers can be called multiple times safely', async () => {
    const calls: number[] = [];
    onExit(() => { calls.push(1); });
    await runExitHandlers();
    await runExitHandlers();
    expect(calls).toHaveLength(2);
  });
});

describe('createPearApp', () => {
  it('returns onExit and runExitHandlers', () => {
    const app = createPearApp();
    expect(typeof app.onExit).toBe('function');
    expect(typeof app.runExitHandlers).toBe('function');
  });

  it('registers with globalThis.Pear.teardown when present', () => {
    const teardownCbs: (() => void)[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Pear = {
      teardown: (cb: () => void) => { teardownCbs.push(cb); },
      updates: jest.fn(),
    };
    try {
      createPearApp();
      expect(teardownCbs).toHaveLength(1);
      expect(typeof teardownCbs[0]).toBe('function');
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Pear;
    }
  });

  it('Pear.teardown is only registered once even on repeated createPearApp calls', () => {
    const teardownCbs: (() => void)[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Pear = {
      teardown: (cb: () => void) => { teardownCbs.push(cb); },
    };
    try {
      createPearApp();
      createPearApp();
      createPearApp();
      expect(teardownCbs).toHaveLength(1);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Pear;
    }
  });

  it('works without globalThis.Pear (Node.js / standalone Bare)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Pear;
    expect(() => createPearApp()).not.toThrow();
  });

  it('registered onExit via createPearApp fires on runExitHandlers', async () => {
    const fired: boolean[] = [];
    const app = createPearApp();
    app.onExit(() => { fired.push(true); });
    await app.runExitHandlers();
    expect(fired).toEqual([true]);
  });
});

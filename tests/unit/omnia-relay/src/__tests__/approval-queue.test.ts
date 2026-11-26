/**
 * RFC-035 B5 — consent queue.
 */

import { createApprovalQueue } from '../approval-queue.js';

describe('createApprovalQueue (RFC-035 B5 consent gate)', () => {
  it('resolves the head request with the user decision', async () => {
    const queue = createApprovalQueue<{ kind: string }>();
    const first = queue.enqueue({ kind: 'factory-open' });
    expect(queue.pending()).toEqual({ kind: 'factory-open' });

    expect(queue.resolve(true)).toBe(true);
    await expect(first).resolves.toBe(true);
    expect(queue.pending()).toBeNull();
    expect(queue.size()).toBe(0);
  });

  it('resolves a rejection as false', async () => {
    const queue = createApprovalQueue<{ kind: string }>();
    const first = queue.enqueue({ kind: 'splice-accept' });
    queue.resolve(false);
    await expect(first).resolves.toBe(false);
  });

  it('shows one request at a time instead of overwriting the first', async () => {
    const queue = createApprovalQueue<{ kind: string }>();
    const first = queue.enqueue({ kind: 'factory-open' });
    const second = queue.enqueue({ kind: 'vc-open' });

    // The second request must not replace the one on screen: the earlier PWA
    // slot did, and the first handler then waited forever.
    expect(queue.pending()).toEqual({ kind: 'factory-open' });
    expect(queue.size()).toBe(2);

    queue.resolve(true);
    await expect(first).resolves.toBe(true);
    expect(queue.pending()).toEqual({ kind: 'vc-open' });

    queue.resolve(true);
    await expect(second).resolves.toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('denies everything outstanding on teardown', async () => {
    const queue = createApprovalQueue<{ kind: string }>();
    const first = queue.enqueue({ kind: 'factory-open' });
    const second = queue.enqueue({ kind: 'factory-close' });

    queue.cancelAll();

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
    expect(queue.size()).toBe(0);
    // A late click after teardown must not resolve anything.
    expect(queue.resolve(true)).toBe(false);
  });

  it('denies an unanswered request after the timeout', async () => {
    jest.useFakeTimers();
    try {
      const queue = createApprovalQueue<{ kind: string }>({ timeoutMs: 1_000 });
      const first = queue.enqueue({ kind: 'factory-open' });
      const second = queue.enqueue({ kind: 'vc-open' });
      expect(queue.pending()).toEqual({ kind: 'factory-open' });

      jest.advanceTimersByTime(1_000);

      await expect(first).resolves.toBe(false);
      expect(queue.pending()).toEqual({ kind: 'vc-open' });
      expect(second).toBeInstanceOf(Promise);
      queue.cancelAll();
      await expect(second).resolves.toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports nothing to resolve when the queue is empty', () => {
    const queue = createApprovalQueue<{ kind: string }>();
    expect(queue.pending()).toBeNull();
    expect(queue.resolve(true)).toBe(false);
  });

  it('signals the UI on every change', async () => {
    const changes: number[] = [];
    const queue = createApprovalQueue<{ kind: string }>({
      onChange: () => changes.push(queue.size()),
    });
    const first = queue.enqueue({ kind: 'factory-open' });
    queue.resolve(true);
    await first;
    expect(changes).toEqual([1, 0]);
  });

  it('does not keep the process alive for an idle timer', () => {
    const queue = createApprovalQueue<{ kind: string }>({ timeoutMs: 60_000 });
    const pending = queue.enqueue({ kind: 'factory-open' });
    queue.cancelAll();
    return expect(pending).resolves.toBe(false);
  });
});

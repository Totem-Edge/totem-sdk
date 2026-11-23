/**
 * RFC-035 B5 — consent queue for peer-coordination approvals.
 *
 * Accepting a factory/virtual-channel/splice proposal emits a WOTS signature, so
 * every request needs an explicit user decision. Two properties matter and were
 * previously left to each wallet:
 *
 *  - **One decision at a time.** A wallet UI can show one modal at a time. The
 *    earlier PWA implementation kept a single pending slot, so a second request
 *    overwrote the first and the first handler waited forever on a promise
 *    nobody could resolve.
 *  - **Fail closed.** Teardown (lock, tab close, host stop) denies everything
 *    outstanding, and an unanswered request expires rather than signing later.
 */

export interface ApprovalQueueOptions {
  /** Deny a request that is not answered within this window. */
  timeoutMs?: number;
  /** Called whenever the head of the queue changes (UI re-render signal). */
  onChange?: () => void;
}

interface Entry<T> {
  request: T;
  resolve: (approved: boolean) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export interface ApprovalQueue<T> {
  /** Append a request; resolves once the user (or the timeout) decides. */
  enqueue(request: T): Promise<boolean>;
  /** The request the UI should show now, if any. */
  pending(): T | null;
  /** Answer the head request. Returns false when nothing was pending. */
  resolve(approved: boolean): boolean;
  /** Deny every outstanding request (teardown / lock). */
  cancelAll(): void;
  /** Number of requests waiting, including the one on screen. */
  size(): number;
}

export function createApprovalQueue<T>(options: ApprovalQueueOptions = {}): ApprovalQueue<T> {
  const queue: Entry<T>[] = [];

  const emit = (): void => {
    options.onChange?.();
  };

  const settle = (entry: Entry<T>, approved: boolean): void => {
    if (entry.timer) clearTimeout(entry.timer);
    const index = queue.indexOf(entry);
    if (index >= 0) queue.splice(index, 1);
    entry.resolve(approved);
    // The clock starts when a request is actually shown, not when it is queued:
    // a request waiting behind another must not expire unseen.
    const next = queue[0];
    if (next) armTimeout(next);
    emit();
  };

  const armTimeout = (entry: Entry<T>): void => {
    if (!options.timeoutMs || options.timeoutMs <= 0) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      // Only the head can be answered; if it is still queued, deny it.
      if (queue.includes(entry)) settle(entry, false);
    }, options.timeoutMs);
    // Do not keep a Node process alive for a UI timer.
    (entry.timer as { unref?: () => void }).unref?.();
  };

  return {
    enqueue(request) {
      return new Promise<boolean>((resolve) => {
        const entry: Entry<T> = { request, resolve };
        queue.push(entry);
        if (queue[0] === entry) armTimeout(entry);
        emit();
      });
    },
    pending() {
      return queue[0]?.request ?? null;
    },
    resolve(approved) {
      const head = queue[0];
      if (!head) return false;
      settle(head, approved);
      return true;
    },
    cancelAll() {
      for (const entry of [...queue]) settle(entry, false);
    },
    size() {
      return queue.length;
    },
  };
}

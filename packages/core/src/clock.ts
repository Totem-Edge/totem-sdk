/**
 * Clock port.
 *
 * Freshness checks in financial paths must use the operator's clock, never a
 * value supplied by the caller (OMN-067). A function returning epoch
 * milliseconds is the whole interface — the point is that a component receives
 * one at construction instead of calling `Date.now()` inline, so time can be
 * pinned in tests and audited in production.
 */

export interface Clock {
  /** Epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A clock frozen at `at`, or advanced by `step` on each read. */
export function fixedClock(at: number, step = 0): Clock {
  let current = at;
  return {
    now() {
      const value = current;
      current += step;
      return value;
    },
  };
}

export function isClock(value: unknown): value is Clock {
  return Boolean(value) && typeof (value as Clock).now === 'function';
}

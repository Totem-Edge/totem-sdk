import { checkUsageLimit, calculateUsageDelta, snapshotFromUsage } from '../usage.js';
import type { AuthorityUsage, UsageLimit, AuthorityUsageSnapshot } from '../types.js';
import type { ActionIntent } from '../types.js';

describe('checkUsageLimit', () => {
  it('allows when under maxCount', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 3 };
    const limit: UsageLimit = { maxCount: 5 };
    expect(checkUsageLimit(snap, limit, 5000)).toBe(true);
  });

  it('allows when exactly at maxCount with no proposed delta', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 5 };
    const limit: UsageLimit = { maxCount: 5 };
    expect(checkUsageLimit(snap, limit, 5000)).toBe(true);
  });

  it('rejects when proposed delta would exceed maxCount', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 5 };
    const limit: UsageLimit = { maxCount: 5 };
    expect(checkUsageLimit(snap, limit, 5000, { count: 1 })).toBe(false);
  });

  it('rejects when over maxCount', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 10 };
    const limit: UsageLimit = { maxCount: 5 };
    expect(checkUsageLimit(snap, limit, 5000)).toBe(false);
  });

  it('allows when under maxTotal amount', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 0, totalAmount: '50' };
    const limit: UsageLimit = { maxTotal: '100' };
    expect(checkUsageLimit(snap, limit, 5000)).toBe(true);
  });

  it('allows when exactly at maxTotal with no proposed delta', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 0, totalAmount: '100' };
    const limit: UsageLimit = { maxTotal: '100' };
    expect(checkUsageLimit(snap, limit, 5000)).toBe(true);
  });

  it('rejects when proposed delta would exceed maxTotal', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 0, totalAmount: '100' };
    const limit: UsageLimit = { maxTotal: '100' };
    expect(checkUsageLimit(snap, limit, 5000, { count: 1, amount: '1' })).toBe(false);
  });

  it('rejects when over maxTotal amount', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 0, totalAmount: '150' };
    const limit: UsageLimit = { maxTotal: '100' };
    expect(checkUsageLimit(snap, limit, 5000)).toBe(false);
  });

  it('allows within windowMs', () => {
    const snap: AuthorityUsageSnapshot = {
      mandateProofId: 'm1', totalCount: 2, windowStart: 1000, windowEnd: 5000,
    };
    const limit: UsageLimit = { maxCount: 5, windowMs: 10000 };
    expect(checkUsageLimit(snap, limit, 3000)).toBe(true);
  });

  it('does not fail open when a prior window has expired (AUD-018)', () => {
    const snap: AuthorityUsageSnapshot = {
      mandateProofId: 'm1', totalCount: 5, windowStart: 1000, windowEnd: 5000,
    };
    const limit: UsageLimit = { maxCount: 3, windowMs: 2000 };
    // The cap is still enforced; expiring a window resets totals, never the cap.
    expect(checkUsageLimit(snap, limit, 4000)).toBe(false);
  });

  it('rejects a proposed delta larger than the entire cap even with no prior usage', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 0 };
    const limit: UsageLimit = { maxCount: 1, maxTotal: '10' };
    expect(checkUsageLimit(snap, limit, 4000, { count: 99, amount: '1000000' })).toBe(false);
  });

  it('allows when no limits set', () => {
    const snap: AuthorityUsageSnapshot = { mandateProofId: 'm1', totalCount: 999 };
    const limit: UsageLimit = {};
    expect(checkUsageLimit(snap, limit, 5000)).toBe(true);
  });
});

describe('calculateUsageDelta', () => {
  it('defaults to count=1 and no amount', () => {
    const action: ActionIntent = { action: 'data:read', principal: 'p', agent: 'MxA' };
    const delta = calculateUsageDelta(action);
    expect(delta.count).toBe(1);
    expect(delta.amount).toBeUndefined();
  });

  it('reads amount from action constraints', () => {
    const action: ActionIntent = {
      action: 'payment:send', principal: 'p', agent: 'MxA',
      constraints: { amount: '500' },
    };
    const delta = calculateUsageDelta(action);
    expect(delta.count).toBe(1);
    expect(delta.amount).toBe('500');
  });
});

describe('snapshotFromUsage', () => {
  it('aggregates counts from usage records', () => {
    const usages: AuthorityUsage[] = [
      { usageId: 'u1', mandateProofId: 'm1', intentId: 'i1', usedAt: 1000 },
      { usageId: 'u2', mandateProofId: 'm1', intentId: 'i2', usedAt: 2000 },
      { usageId: 'u3', mandateProofId: 'm1', intentId: 'i3', usedAt: 3000 },
    ];
    const snap = snapshotFromUsage(usages, 5000);
    expect(snap.totalCount).toBe(3);
    expect(snap.totalAmount).toBeUndefined();
    expect(snap.windowStart).toBeUndefined();
  });

  it('includes countsToward values', () => {
    const usages: AuthorityUsage[] = [
      { usageId: 'u1', mandateProofId: 'm1', intentId: 'i1', usedAt: 1000, countsToward: { count: 2, amount: '100' } },
      { usageId: 'u2', mandateProofId: 'm1', intentId: 'i2', usedAt: 2000, countsToward: { count: 3, amount: '200' } },
    ];
    const snap = snapshotFromUsage(usages, 5000);
    expect(snap.totalCount).toBe(5);
    expect(snap.totalAmount).toBe('300');
  });

  it('applies windowMs filter to the window containing now (AUD-018)', () => {
    const usages: AuthorityUsage[] = [
      { usageId: 'u1', mandateProofId: 'm1', intentId: 'i1', usedAt: 1000 },
      { usageId: 'u2', mandateProofId: 'm1', intentId: 'i2', usedAt: 5000 },
    ];
    const limit: UsageLimit = { windowMs: 2000 };
    const snap = snapshotFromUsage(usages, 5000, limit);
    // Window containing now=5000 is [4000, 6000): the 1000 receipt is retired.
    expect(snap.windowStart).toBe(4000);
    expect(snap.windowEnd).toBe(6000);
    expect(snap.totalCount).toBe(1);
  });

  it('does not retire the cap when the earliest receipt is in a past window (AUD-018)', () => {
    const usages: AuthorityUsage[] = [
      { usageId: 'u1', mandateProofId: 'm1', intentId: 'i1', usedAt: 0, countsToward: { count: 1, amount: '10' } },
      { usageId: 'u2', mandateProofId: 'm1', intentId: 'i2', usedAt: 190, countsToward: { count: 1, amount: '100' } },
    ];
    const limit: UsageLimit = { maxCount: 1, maxTotal: '10', windowMs: 100 };
    const snap = snapshotFromUsage(usages, 200, limit);
    expect(snap.totalCount).toBe(0);
    expect(snap.totalAmount).toBeUndefined();
    expect(checkUsageLimit(snap, limit, 200, { count: 99, amount: '1000000' })).toBe(false);
  });
});

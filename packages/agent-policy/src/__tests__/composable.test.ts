import {
  ComposablePolicy,
  RateLimitPolicy,
  AmountCapPolicy,
  RecipientAllowlistPolicy,
  TimeWindowPolicy,
  RiskThresholdPolicy,
} from '../index.js';
import type { AgentProposal, PolicyMiddleware } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProposal(overrides?: Partial<AgentProposal['intent']>): AgentProposal {
  return {
    id: 'prop-1',
    agentId: 'test-agent',
    intent: {
      type: 'payment',
      amount: '100',
      tokenId: '0x00',
      recipient: 'MxABC',
      reason: 'test',
      risk: 'low',
      ...overrides,
    },
    explanation: 'Test proposal',
    confidence: 0.95,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// RateLimitPolicy
// ---------------------------------------------------------------------------

describe('RateLimitPolicy', () => {
  it('rejects invalid construction', () => {
    expect(() => new RateLimitPolicy(0, 1000)).toThrow('maxProposals must be >= 1');
    expect(() => new RateLimitPolicy(1, 0)).toThrow('windowMs must be >= 1');
  });

  it('approves within limit', async () => {
    const policy = new RateLimitPolicy(3, 60_000);
    expect(await policy.evaluate(makeProposal())).toMatchObject({ outcome: 'approved' });
    expect(await policy.evaluate(makeProposal())).toMatchObject({ outcome: 'approved' });
    expect(await policy.evaluate(makeProposal())).toMatchObject({ outcome: 'approved' });
  });

  it('rejects after limit', async () => {
    const policy = new RateLimitPolicy(2, 60_000);
    await policy.evaluate(makeProposal());
    await policy.evaluate(makeProposal());
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('Rate limit exceeded');
  });

  it('resets after window expires', async () => {
    const policy = new RateLimitPolicy(1, 50);
    await policy.evaluate(makeProposal());
    const result1 = await policy.evaluate(makeProposal());
    expect(result1.outcome).toBe('rejected');

    await policy.reset();
    const result2 = await policy.evaluate(makeProposal());
    expect(result2.outcome).toBe('approved');
  });

  it('resets the window automatically after it rolls over (time-based)', async () => {
    const policy = new RateLimitPolicy(1, 1000);
    const t0 = 1_000_000;
    expect((await policy.evaluate(makeProposal(), t0)).outcome).toBe('approved');
    expect((await policy.evaluate(makeProposal(), t0 + 500)).outcome).toBe('rejected');
    expect((await policy.evaluate(makeProposal(), t0 + 1000)).outcome).toBe('approved');
    expect((await policy.evaluate(makeProposal(), t0 + 1001)).outcome).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// AmountCapPolicy
// ---------------------------------------------------------------------------

describe('AmountCapPolicy', () => {
  it('rejects amount exceeding per-tx cap', async () => {
    const policy = new AmountCapPolicy({ perTx: '50' });
    const result = await policy.evaluate(makeProposal({ amount: '100' }));
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('per-transaction cap');
  });

  it('approves amount within per-tx cap', async () => {
    const policy = new AmountCapPolicy({ perTx: '200' });
    const result = await policy.evaluate(makeProposal({ amount: '100' }));
    expect(result.outcome).toBe('approved');
  });

  it('approves proposals without amount', async () => {
    const policy = new AmountCapPolicy({ perTx: '50' });
    const result = await policy.evaluate(makeProposal({ amount: undefined }));
    expect(result.outcome).toBe('approved');
  });

  it('tracks per-day cap', async () => {
    const policy = new AmountCapPolicy({ perDay: '300' });
    await policy.evaluate(makeProposal({ amount: '100' }));
    await policy.evaluate(makeProposal({ amount: '100' }));
    const result = await policy.evaluate(makeProposal({ amount: '100' }));
    expect(result.outcome).toBe('approved');
    // Fourth exceeds 300
    const result2 = await policy.evaluate(makeProposal({ amount: '100' }));
    expect(result2.outcome).toBe('rejected');
    expect(result2.reason).toContain('per-day cap');
  });

  it('rejects negative amounts', async () => {
    const policy = new AmountCapPolicy({});
    const result = await policy.evaluate(makeProposal({ amount: '-50' }));
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('Negative');
  });

  it('resets day counter', async () => {
    const policy = new AmountCapPolicy({ perDay: '100' });
    await policy.evaluate(makeProposal({ amount: '100' }));
    const result1 = await policy.evaluate(makeProposal({ amount: '50' }));
    expect(result1.outcome).toBe('rejected');
    await policy.reset();
    const result2 = await policy.evaluate(makeProposal({ amount: '50' }));
    expect(result2.outcome).toBe('approved');
  });

  it('resets the day budget automatically after 24h (time-based)', async () => {
    const policy = new AmountCapPolicy({ perDay: '100' });
    const day1 = 1_000_000;
    expect((await policy.evaluate(makeProposal({ amount: '100' }), day1)).outcome).toBe('approved');
    expect((await policy.evaluate(makeProposal({ amount: '50' }), day1 + 1000)).outcome).toBe('rejected');
    expect((await policy.evaluate(makeProposal({ amount: '50' }), day1 + 86_400_000)).outcome).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// RecipientAllowlistPolicy
// ---------------------------------------------------------------------------

describe('RecipientAllowlistPolicy', () => {
  it('approves allowlisted recipient', async () => {
    const policy = new RecipientAllowlistPolicy(['MxABC', 'MxDEF']);
    const result = await policy.evaluate(makeProposal({ recipient: 'MxABC' }));
    expect(result.outcome).toBe('approved');
  });

  it('rejects non-allowlisted recipient', async () => {
    const policy = new RecipientAllowlistPolicy(['MxABC']);
    const result = await policy.evaluate(makeProposal({ recipient: 'MxUNKNOWN' }));
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('not in the allowlist');
  });

  it('approves proposals without recipient', async () => {
    const policy = new RecipientAllowlistPolicy(['MxABC']);
    const result = await policy.evaluate(makeProposal({ recipient: undefined }));
    expect(result.outcome).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// TimeWindowPolicy
// ---------------------------------------------------------------------------

describe('TimeWindowPolicy', () => {
  it('rejects invalid construction', () => {
    expect(() => new TimeWindowPolicy(-1, 100)).toThrow();
    expect(() => new TimeWindowPolicy(100, 1441)).toThrow();
    expect(() => new TimeWindowPolicy(100, 50)).toThrow();
  });

  it('approves within the window', async () => {
    const policy = new TimeWindowPolicy(360, 1320);
    const result = await policy.evaluate(makeProposal(), new Date('2026-08-03T12:30:00Z'));
    expect(result.outcome).toBe('approved');
  });

  it('rejects outside the window', async () => {
    const policy = new TimeWindowPolicy(0, 1);
    const result = await policy.evaluate(makeProposal(), new Date('2026-08-03T12:00:00Z'));
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('Outside time window');
  });

  it('rejects just before midnight-UTC rollover when outside window', async () => {
    const policy = new TimeWindowPolicy(360, 1320);
    const result = await policy.evaluate(makeProposal(), new Date('2026-08-03T00:00:00Z'));
    expect(result.outcome).toBe('rejected');
  });

  it('approves at the window boundary (start inclusive, end exclusive)', async () => {
    const policy = new TimeWindowPolicy(360, 1320);
    expect((await policy.evaluate(makeProposal(), new Date('2026-08-03T06:00:00Z'))).outcome).toBe('approved');
    expect((await policy.evaluate(makeProposal(), new Date('2026-08-03T21:59:00Z'))).outcome).toBe('approved');
    expect((await policy.evaluate(makeProposal(), new Date('2026-08-03T22:00:00Z'))).outcome).toBe('rejected');
  });

  it('static hour helper works', () => {
    expect(TimeWindowPolicy.hour(0)).toBe(0);
    expect(TimeWindowPolicy.hour(6)).toBe(360);
    expect(TimeWindowPolicy.hour(22)).toBe(1320);
    expect(TimeWindowPolicy.hour(23)).toBe(1380);
    expect(() => TimeWindowPolicy.hour(24)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// RiskThresholdPolicy
// ---------------------------------------------------------------------------

describe('RiskThresholdPolicy', () => {
  it('approves risk at or below threshold', async () => {
    const policy = new RiskThresholdPolicy('medium');
    expect(await policy.evaluate(makeProposal({ risk: 'low' }))).toMatchObject({ outcome: 'approved' });
    expect(await policy.evaluate(makeProposal({ risk: 'medium' }))).toMatchObject({ outcome: 'approved' });
  });

  it('requires human for risk above threshold', async () => {
    const policy = new RiskThresholdPolicy('low');
    const result = await policy.evaluate(makeProposal({ risk: 'high' }));
    expect(result.outcome).toBe('requires_human');
  });

  it('treats absent risk as high', async () => {
    const policy = new RiskThresholdPolicy('low');
    const result = await policy.evaluate(makeProposal({ risk: undefined }));
    expect(result.outcome).toBe('requires_human');
  });

  it('high threshold approves all', async () => {
    const policy = new RiskThresholdPolicy('high');
    expect(await policy.evaluate(makeProposal({ risk: 'high' }))).toMatchObject({ outcome: 'approved' });
    expect(await policy.evaluate(makeProposal({ risk: undefined }))).toMatchObject({ outcome: 'approved' });
  });
});

// ---------------------------------------------------------------------------
// ComposablePolicy
// ---------------------------------------------------------------------------

describe('ComposablePolicy', () => {
  it('approves with no layers (pass-through)', async () => {
    const policy = new ComposablePolicy([]);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('approved');
  });

  it('approves when all layers approve', async () => {
    const alwaysApprove: PolicyMiddleware = {
      async evaluate() {
        return { outcome: 'approved' as const, reason: 'yes' };
      },
    };
    const policy = new ComposablePolicy([alwaysApprove, alwaysApprove]);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('approved');
  });

  it('short-circuits on first rejection', async () => {
    let secondCalled = false;
    const firstReject: PolicyMiddleware = {
      async evaluate() {
        return { outcome: 'rejected' as const, reason: 'no' };
      },
    };
    const second: PolicyMiddleware = {
      async evaluate() {
        secondCalled = true;
        return { outcome: 'approved' as const, reason: 'yes' };
      },
    };
    const policy = new ComposablePolicy([firstReject, second]);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('rejected');
    expect(secondCalled).toBe(false);
  });

  it('short-circuits on requires_human', async () => {
    const firstHuman: PolicyMiddleware = {
      async evaluate() {
        return { outcome: 'requires_human' as const, reason: 'ask user' };
      },
    };
    let secondCalled = false;
    const second: PolicyMiddleware = {
      async evaluate() {
        secondCalled = true;
        return { outcome: 'approved' as const, reason: 'yes' };
      },
    };
    const policy = new ComposablePolicy([firstHuman, second]);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('requires_human');
    expect(secondCalled).toBe(false);
  });

  it('implements legacy AgentPolicy canAutoApprove', async () => {
    const alwaysApprove: PolicyMiddleware = {
      async evaluate() {
        return { outcome: 'approved' as const, reason: 'yes' };
      },
    };
    const policy = new ComposablePolicy([alwaysApprove]);
    expect(await policy.canAutoApprove(makeProposal())).toBe(true);
  });

  it('implements legacy AgentPolicy requiresUserApproval', async () => {
    const requiresHuman: PolicyMiddleware = {
      async evaluate() {
        return { outcome: 'requires_human' as const, reason: 'ask' };
      },
    };
    const policy = new ComposablePolicy([requiresHuman]);
    expect(await policy.requiresUserApproval(makeProposal())).toBe(true);
  });

  it('resets all layers', async () => {
    let resetCount = 0;
    const layer: PolicyMiddleware = {
      async evaluate() {
        return { outcome: 'approved' as const, reason: 'yes' };
      },
      async reset() {
        resetCount++;
      },
    };
    const policy = new ComposablePolicy([layer, layer]);
    await policy.reset();
    expect(resetCount).toBe(2);
  });

  // Integration test: real policies chained together
  it('real policy chain — approves within all bounds', async () => {
    const policy = new ComposablePolicy([
      new RateLimitPolicy(10, 60_000),
      new AmountCapPolicy({ perTx: '500', perDay: '2000' }),
      new RecipientAllowlistPolicy(['MxABC', 'MxDEF']),
      new RiskThresholdPolicy('medium'),
    ]);

    const result = await policy.evaluate(makeProposal({ amount: '250', recipient: 'MxABC', risk: 'low' }));
    expect(result.outcome).toBe('approved');
  });

  it('real policy chain — rejects on first failing layer', async () => {
    const policy = new ComposablePolicy([
      new AmountCapPolicy({ perTx: '50' }),
      new RecipientAllowlistPolicy(['MxABC']),
    ]);

    const result = await policy.evaluate(makeProposal({ amount: '100', recipient: 'MxABC' }));
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('per-transaction cap');
  });
});

// ---------------------------------------------------------------------------
// AuthorityPolicy
// ---------------------------------------------------------------------------

import { AuthorityPolicy } from '../authority.js';
import type { AuthorityEvaluator } from '../authority.js';

describe('AuthorityPolicy', () => {
  it('approves when authority allows', async () => {
    const evaluator: AuthorityEvaluator = {
      async evaluate() {
        return { allowed: true, reason: 'Mandate valid' };
      },
    };
    const policy = new AuthorityPolicy(evaluator);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('approved');
  });

  it('rejects when authority denies', async () => {
    const evaluator: AuthorityEvaluator = {
      async evaluate() {
        return { allowed: false, reason: 'Scope mismatch' };
      },
    };
    const policy = new AuthorityPolicy(evaluator);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('Scope mismatch');
  });

  it('uses custom action extractor', async () => {
    const extractor = jest.fn(() => ({
      action: 'custom:action',
      principal: 'test',
      agent: 'test',
    }));
    const evaluator: AuthorityEvaluator = {
      async evaluate(params) {
        expect(params.action.action).toBe('custom:action');
        return { allowed: true };
      },
    };
    const policy = new AuthorityPolicy(evaluator, extractor);
    await policy.evaluate(makeProposal());
    expect(extractor).toHaveBeenCalledTimes(1);
  });

  it('works in ComposablePolicy chain', async () => {
    const evaluator: AuthorityEvaluator = {
      async evaluate() {
        return { allowed: true };
      },
    };
    const policy = new ComposablePolicy([
      new AmountCapPolicy({ perTx: '500' }),
      new AuthorityPolicy(evaluator),
    ]);
    const result = await policy.evaluate(makeProposal({ amount: '100' }));
    expect(result.outcome).toBe('approved');
  });

  it('short-circuits when authority denies in chain', async () => {
    const denyEvaluator: AuthorityEvaluator = {
      async evaluate() {
        return { allowed: false, reason: 'No mandate' };
      },
    };
    const policy = new ComposablePolicy([
      new AuthorityPolicy(denyEvaluator),
      new AmountCapPolicy({ perTx: '500' }),
    ]);
    const result = await policy.evaluate(makeProposal());
    expect(result.outcome).toBe('rejected');
    expect(result.reason).toContain('No mandate');
  });
});

// ---------------------------------------------------------------------------
// ReceiptStore
// ---------------------------------------------------------------------------

import { MemoryReceiptStore } from '../receipt-store.js';

describe('MemoryReceiptStore', () => {
  it('saves and retrieves a receipt', async () => {
    const store = new MemoryReceiptStore();
    const receipt = {
      proposalId: 'prop-1',
      status: 'approved' as const,
      txpowId: '0xabc',
      settledAt: Date.now(),
    };
    const id = await store.save(receipt);
    expect(id).toMatch(/^rcpt-/);
    const retrieved = await store.get(id);
    expect(retrieved).toEqual(receipt);
  });

  it('returns null for unknown receiptId', async () => {
    const store = new MemoryReceiptStore();
    expect(await store.get('nonexistent')).toBeNull();
  });

  it('lists receipts newest first', async () => {
    const store = new MemoryReceiptStore();
    const r1 = { proposalId: 'prop-1', status: 'approved' as const, settledAt: 100 };
    const r2 = { proposalId: 'prop-2', status: 'rejected' as const, rejectionReason: 'no', settledAt: 200 };
    await store.save(r1);
    await store.save(r2);
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].proposalId).toBe('prop-2');
    expect(list[1].proposalId).toBe('prop-1');
  });

  it('reports count', async () => {
    const store = new MemoryReceiptStore();
    expect(await store.count()).toBe(0);
    await store.save({ proposalId: 'p1', status: 'approved' as const, settledAt: Date.now() });
    expect(await store.count()).toBe(1);
  });

  it('supports pagination', async () => {
    const store = new MemoryReceiptStore();
    for (let i = 0; i < 10; i++) {
      await store.save({ proposalId: `prop-${i}`, status: 'approved' as const, settledAt: i });
    }
    expect((await store.list(3, 0)).length).toBe(3);
    expect((await store.list(3, 3)).length).toBe(3);
  });
});

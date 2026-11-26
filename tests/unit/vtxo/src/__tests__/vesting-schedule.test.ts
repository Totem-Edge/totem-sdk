/**
 * OMN-008 — the vesting policy must enforce the vested amount at the current
 * block, not merely the cliff and a positive claim.
 */

import { verifyClaimPolicy, type VtxoClaimPolicy } from '../claim-policy';

// start 10 → end 100 is a span of 90 blocks.
const POLICY: VtxoClaimPolicy = {
  type: 'vesting',
  owner: 'employer',
  beneficiary: 'alice',
  startBlock: 10,
  cliffBlock: 20,
  endBlock: 100,
  totalAmount: 1_000n,
};

function claim(amount: bigint, block: number, policy: VtxoClaimPolicy = POLICY) {
  return verifyClaimPolicy(
    policy,
    { signers: ['alice'], claimAmount: amount },
    { block },
  );
}

describe('OMN-008 — linear vesting schedule', () => {
  it('rejects a claim above the vested amount at the current block', () => {
    // At block 20: floor(1000 * (20 - 10) / (100 - 10)) = 111.
    const result = claim(112n, 20);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceeds vested amount/);

    // At block 50: floor(1000 * 40 / 90) = 444.
    expect(claim(445n, 50).valid).toBe(false);
    expect(claim(444n, 50).valid).toBe(true);
  });

  it('accepts a claim at or below the vested amount', () => {
    expect(claim(111n, 20).valid).toBe(true);
    expect(claim(1n, 20).valid).toBe(true);
    expect(claim(444n, 50).valid).toBe(true);
    expect(claim(200n, 50).valid).toBe(true);
  });

  it('floors the vested fraction (never rounds up)', () => {
    const policy: VtxoClaimPolicy = {
      type: 'vesting',
      owner: 'employer',
      beneficiary: 'alice',
      startBlock: 0,
      cliffBlock: 0,
      endBlock: 3,
      totalAmount: 100n,
    };
    // block 1: floor(100 / 3) = 33 — 34 must be rejected.
    expect(claim(33n, 1, policy).valid).toBe(true);
    expect(claim(34n, 1, policy).valid).toBe(false);
  });

  it('makes the full amount claimable at/after endBlock', () => {
    expect(claim(1_000n, 100).valid).toBe(true);
    expect(claim(1_000n, 250).valid).toBe(true);
    const result = claim(1_000n, 100);
    expect(result.schedule?.vestedAmount).toBe(1_000n);
  });

  it('rejects a non-positive claim', () => {
    expect(claim(0n, 50).valid).toBe(false);
    expect(claim(-1n, 50).valid).toBe(false);
  });

  it('keeps the cliff check', () => {
    expect(claim(1n, 19).valid).toBe(false);
    expect(claim(1n, 20).valid).toBe(true);
  });

  it('fails closed when no total allocation is available', () => {
    const noTotal: VtxoClaimPolicy = {
      type: 'vesting',
      owner: 'employer',
      beneficiary: 'alice',
      startBlock: 10,
      cliffBlock: 20,
      endBlock: 100,
    };
    expect(claim(1n, 50, noTotal).valid).toBe(false);
    expect(claim(1n, 50, noTotal).error).toMatch(/total amount required/);

    // The total may come from the context instead of the policy.
    const fromContext = verifyClaimPolicy(
      noTotal,
      { signers: ['alice'], claimAmount: 400n },
      { block: 50, totalAmount: 1_000n },
    );
    expect(fromContext.valid).toBe(true);
  });

  it('exposes the schedule (cliff, end, vested amount) in the result', () => {
    const result = claim(100n, 20);
    expect(result.valid).toBe(true);
    expect(result.schedule).toEqual({
      startBlock: 10,
      cliffBlock: 20,
      endBlock: 100,
      totalAmount: 1_000n,
      vestedAmount: 111n,
    });
  });
});

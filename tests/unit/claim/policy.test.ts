import {
  computeClaimEnvelopeHash,
  computeVestingSchedule,
  evaluateClaim,
  serializeClaimEnvelope,
  type ClaimEnvelope,
  type ClaimPolicy,
} from '@totemsdk/claim';

describe('claim policy evaluation', () => {
  it('enforces a single owner', () => {
    const policy: ClaimPolicy = { type: 'single', owner: 'alice' };
    expect(evaluateClaim(policy, { signers: ['alice'] }, { block: 1 }).valid).toBe(true);
    expect(evaluateClaim(policy, { signers: ['bob'] }, { block: 1 }).valid).toBe(false);
  });

  it('enforces an M-of-N threshold', () => {
    const policy: ClaimPolicy = {
      type: 'threshold',
      threshold: 2,
      owners: ['alice', 'bob', 'carol'],
    };
    expect(evaluateClaim(policy, { signers: ['alice', 'bob'] }, { block: 1 }).valid).toBe(true);
    expect(evaluateClaim(policy, { signers: ['alice'] }, { block: 1 }).valid).toBe(false);
    expect(evaluateClaim({ ...policy, threshold: 4 }, { signers: ['alice', 'bob', 'carol'] }, { block: 1 }).valid).toBe(false);
  });

  it('enforces the delegation scope, expiry and revocation', () => {
    const policy: ClaimPolicy = {
      type: 'delegated',
      owner: 'alice',
      delegate: 'agent',
      scope: 'claim',
      expiresAtBlock: 100,
    };
    expect(evaluateClaim(policy, { signers: ['agent'], scope: 'claim' }, { block: 50 }).valid).toBe(true);
    expect(evaluateClaim(policy, { signers: ['agent'], scope: 'transfer' }, { block: 50 }).valid).toBe(false);
    expect(evaluateClaim(policy, { signers: ['agent'], scope: 'claim' }, { block: 101 }).valid).toBe(false);
    expect(evaluateClaim({ ...policy, revoked: true }, { signers: ['agent'], scope: 'claim' }, { block: 50 }).valid).toBe(false);
  });

  it('enforces recovery after the window opens', () => {
    const policy: ClaimPolicy = {
      type: 'recovery',
      owner: 'alice',
      guardians: ['g1', 'g2', 'g3'],
      threshold: 2,
      recoverAfterBlock: 100,
    };
    expect(evaluateClaim(policy, { signers: ['g1', 'g2'] }, { block: 99 }).valid).toBe(false);
    expect(evaluateClaim(policy, { signers: ['g1', 'g2'] }, { block: 100 }).valid).toBe(true);
    expect(evaluateClaim(policy, { signers: ['g1'] }, { block: 100 }).valid).toBe(false);
  });
});

describe('vesting arithmetic', () => {
  const vesting: ClaimPolicy = {
    type: 'vesting',
    owner: 'treasury',
    beneficiary: 'alice',
    startBlock: 0,
    cliffBlock: 10,
    endBlock: 100,
    totalAmount: 1000n,
  };

  it('floors linearly between start and end', () => {
    const atFive = computeVestingSchedule(vesting, 5);
    expect(atFive.valid && atFive.schedule.vestedAmount).toBe(50n);
    const atFifty = computeVestingSchedule(vesting, 50);
    expect(atFifty.valid && atFifty.schedule.vestedAmount).toBe(500n);
    const atEnd = computeVestingSchedule(vesting, 100);
    expect(atEnd.valid && atEnd.schedule.vestedAmount).toBe(1000n);
  });

  it('rejects a claim above the vested amount', () => {
    expect(evaluateClaim(vesting, { signers: ['alice'], claimAmount: 500n }, { block: 50 }).valid).toBe(true);
    expect(evaluateClaim(vesting, { signers: ['alice'], claimAmount: 501n }, { block: 50 }).valid).toBe(false);
    expect(evaluateClaim(vesting, { signers: ['alice'], claimAmount: 1n }, { block: 9 }).valid).toBe(false);
  });

  it('falls back to the context total when the policy omits it', () => {
    const { totalAmount: _omit, ...withoutTotal } = vesting as Extract<ClaimPolicy, { type: 'vesting' }>;
    const result = evaluateClaim(
      { ...withoutTotal },
      { signers: ['alice'], claimAmount: 500n },
      { block: 50, totalAmount: 1000n },
    );
    expect(result.valid).toBe(true);
    expect(result.schedule?.totalAmount).toBe(1000n);
  });
});

describe('claim envelope', () => {
  const envelope: ClaimEnvelope = {
    version: 1,
    payload: { kind: 'token', tokenId: '0x00', amount: '1000', decimals: 0 },
    policy: { type: 'single', owner: 'alice' },
  };

  it('hashes deterministically regardless of key order', () => {
    const reordered: ClaimEnvelope = {
      policy: { owner: 'alice', type: 'single' },
      payload: { decimals: 0, amount: '1000', tokenId: '0x00', kind: 'token' },
      version: 1,
    };
    expect(computeClaimEnvelopeHash(envelope)).toBe(computeClaimEnvelopeHash(reordered));
    expect(computeClaimEnvelopeHash(envelope)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the payload changes', () => {
    const other: ClaimEnvelope = {
      ...envelope,
      payload: { kind: 'native', amount: '1000' },
    };
    expect(computeClaimEnvelopeHash(envelope)).not.toBe(computeClaimEnvelopeHash(other));
  });

  it('serializes bigint policy values as decimal strings', () => {
    const withBigint: ClaimEnvelope = {
      ...envelope,
      policy: {
        type: 'vesting',
        owner: 'treasury',
        beneficiary: 'alice',
        startBlock: 0,
        cliffBlock: 0,
        endBlock: 10,
        totalAmount: 10n,
      },
    };
    expect(serializeClaimEnvelope(withBigint)).toContain('"totalAmount":"10"');
  });
});

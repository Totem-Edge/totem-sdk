/**
 * @totemsdk/governance — test suite
 */

import {
  createGovernanceConfig,
  validateGovernanceConfig,
  freezeMembershipSnapshot,
  verifyMembershipSnapshot,
  getMemberWeight,
  getTotalWeight,
  createProposal,
  createProposalProofDraft,
  activateProposal,
  cancelProposal,
  createDelegation,
  recallDelegation,
  getActiveDelegations,
  resolveDelegation,
  resolveVotingPower,
  createVote,
  createQuadraticVote,
  createDelegatedVote,
  createVoteProofDraft,
  tallyVotes,
  finalizeProposal,
  createOutcome,
  createGovernedMandate,
  createOutcomeProofDraft,
  finalizeProposalExecution,
  UsageStore,
  executeProposal,
  isExecutionReady,
} from '../index'
import type {
  GovernanceConfig,
  MembershipEntry,
  MembershipSnapshot,
  Proposal,
  Delegation,
  Vote,
} from '../index'

function makeSnapshot(
  daoId: string,
  members: Array<{ id: string; weight: number }>,
  frozenAt?: number,
): MembershipSnapshot {
  const entries: MembershipEntry[] = members.map((m) => ({
    memberId: m.id,
    role: 'voter',
    weight: m.weight,
    addedAt: (frozenAt ?? Date.now()) - 1000,
    addedBy: 'admin',
  }))
  return freezeMembershipSnapshot(daoId, entries, frozenAt)
}

function makeConfig(overrides?: Partial<GovernanceConfig>): GovernanceConfig {
  return createGovernanceConfig({
    daoId: 'dao-1',
    name: 'Test DAO',
    voting: {
      algorithm: 'linear',
      quorumBps: 5000,
      passThresholdBps: 5000,
      votingPeriodMs: 86400000,
      delayBeforeVotingMs: 0,
      executionDelayMs: 0,
      allowAbstain: true,
    },
    membership: {
      defaultWeight: 1,
      minWeightToPropose: 1,
    },
    authorityScope: 'governance:execute',
    authorityResolver: 'totem:id:org:test',
    ...overrides,
  })
}

const NOW = 1000000000000

// ─── 1. config ──────────────────────────────────────────────────────────────

describe('config', () => {
  it('createGovernanceConfig returns valid config', () => {
    const cfg = makeConfig()
    expect(cfg.daoId).toBe('dao-1')
    expect(cfg.voting.algorithm).toBe('linear')
    expect(cfg.voting.quorumBps).toBe(5000)
  })

  it('validateGovernanceConfig returns no errors for valid config', () => {
    const errors = validateGovernanceConfig(makeConfig())
    expect(errors).toHaveLength(0)
  })

  it('validateGovernanceConfig catches missing daoId', () => {
    const cfg = makeConfig()
    cfg.daoId = ''
    const errors = validateGovernanceConfig(cfg)
    expect(errors).toContain('daoId is required')
  })

  it('validateGovernanceConfig catches invalid quorumBps', () => {
    const cfg = makeConfig()
    cfg.voting.quorumBps = 20000
    const errors = validateGovernanceConfig(cfg)
    expect(errors).toContain('quorumBps must be between 0 and 10000')
  })

  it('validateGovernanceConfig requires quadratic config for quadratic algorithm', () => {
    const cfg = makeConfig({ voting: { ...makeConfig().voting, algorithm: 'quadratic', quadratic: undefined } })
    const errors = validateGovernanceConfig(cfg)
    expect(errors).toContain('quadratic config required when algorithm is quadratic')
  })

  it('validateGovernanceConfig requires delegation config for liquid algorithm', () => {
    const cfg = makeConfig({ voting: { ...makeConfig().voting, algorithm: 'liquid', delegation: undefined } })
    const errors = validateGovernanceConfig(cfg)
    expect(errors).toContain('delegation config required when algorithm is liquid')
  })
})

// ─── 2. snapshot ────────────────────────────────────────────────────────────

describe('snapshot', () => {
  it('freezeMembershipSnapshot creates deterministic hash', () => {
    const s1 = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    const s2 = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    expect(s1.hash).toBe(s2.hash)
    expect(s1.entries.get('alice')).toBeDefined()
  })

  it('freezeMembershipSnapshot uses latest entry per member', () => {
    const entries: MembershipEntry[] = [
      { memberId: 'alice', role: 'voter', weight: 5, addedAt: 100, addedBy: 'admin' },
      { memberId: 'alice', role: 'voter', weight: 10, addedAt: 200, addedBy: 'admin' },
    ]
    const s = freezeMembershipSnapshot('dao-1', entries, NOW)
    expect(s.entries.get('alice')!.weight).toBe(10)
  })

  it('verifyMembershipSnapshot returns true for valid snapshot', () => {
    const s = makeSnapshot('dao-1', [{ id: 'bob', weight: 5 }], NOW)
    expect(verifyMembershipSnapshot(s)).toBe(true)
  })

  it('verifyMembershipSnapshot returns false for tampered snapshot', () => {
    const s = makeSnapshot('dao-1', [{ id: 'bob', weight: 5 }], NOW)
    s.hash = s.hash.replace(/0/g, 'f')
    expect(verifyMembershipSnapshot(s)).toBe(false)
  })

  it('getMemberWeight returns weight for existing member', () => {
    const s = makeSnapshot('dao-1', [{ id: 'charlie', weight: 7 }], NOW)
    expect(getMemberWeight(s, 'charlie')).toBe(7)
  })

  it('getMemberWeight returns 0 for non-member', () => {
    const s = makeSnapshot('dao-1', [], NOW)
    expect(getMemberWeight(s, 'unknown')).toBe(0)
  })

  it('getTotalWeight sums all member weights', () => {
    const s = makeSnapshot('dao-1', [
      { id: 'a', weight: 10 },
      { id: 'b', weight: 20 },
      { id: 'c', weight: 30 },
    ], NOW)
    expect(getTotalWeight(s)).toBe(60)
  })
})

// ─── 3. proposal ────────────────────────────────────────────────────────────

describe('proposal', () => {
  it('createProposal succeeds for valid member', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    const result = createProposal({
      config: cfg,
      actions: [{ type: 'custom', payload: {}, description: 'test' }],
      title: 'Test Proposal',
      description: 'A test',
      proposer: 'alice',
      snapshot,
      createdAt: NOW,
    })
    expect(typeof result).not.toBe('string')
    const proposal = result as Proposal
    expect(proposal.id).toMatch(/^totem:gov:proposal:/)
    expect(proposal.status).toBe('draft')
    expect(proposal.daoId).toBe('dao-1')
    expect(proposal.votingStartsAt).toBe(NOW)
    expect(proposal.votingEndsAt).toBe(NOW + 86400000)
  })

  it('createProposal fails for non-member', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [], NOW)
    const result = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'unknown',
      snapshot,
      createdAt: NOW,
    })
    expect(typeof result).toBe('string')
  })

  it('activateProposal transitions to active', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    const result = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'alice',
      snapshot,
      createdAt: NOW - 1000,
    }) as Proposal
    const activated = activateProposal(result)
    expect(typeof activated).not.toBe('string')
    expect((activated as Proposal).status).toBe('active')
  })

  it('cancelProposal transitions to cancelled', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    const result = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'alice',
      snapshot,
      createdAt: NOW - 1000,
    }) as Proposal
    const cancelled = cancelProposal(result)
    expect((cancelled as Proposal).status).toBe('cancelled')
  })

  it('createProposalProofDraft produces valid proof draft', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    const proposal = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'alice',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    const draft = createProposalProofDraft(proposal, 'alice')
    expect(draft.proofId).toMatch(/^totem:proof:/)
    expect(draft.kind).toBe('custom')
    expect(draft.subject.kind).toBe('proposal')
  })
})

// ─── 4. delegation ──────────────────────────────────────────────────────────

describe('delegation', () => {
  it('createDelegation returns valid delegation', () => {
    const d = createDelegation({
      daoId: 'dao-1',
      delegator: 'alice',
      delegate: 'bob',
      weight: 10,
      castAt: NOW,
    })
    expect(d.id).toMatch(/^totem:gov:delegation:/)
    expect(d.delegator).toBe('alice')
    expect(d.delegate).toBe('bob')
    expect(d.revokedAt).toBeUndefined()
  })

  it('recallDelegation sets revokedAt', () => {
    const d = createDelegation({
      daoId: 'dao-1',
      delegator: 'alice',
      delegate: 'bob',
      castAt: NOW,
    })
    const r = recallDelegation(d, NOW + 1000)
    expect(r.revokedAt).toBe(NOW + 1000)
  })

  it('getActiveDelegations filters expired and revoked', () => {
    const ds: Delegation[] = [
      createDelegation({ daoId: 'dao-1', delegator: 'a', delegate: 'b', castAt: NOW }),
      { ...createDelegation({ daoId: 'dao-1', delegator: 'c', delegate: 'd', castAt: NOW }), revokedAt: NOW + 1 },
      { ...createDelegation({ daoId: 'dao-1', delegator: 'e', delegate: 'f', castAt: NOW }), expiresAt: NOW - 1 },
    ]
    const active = getActiveDelegations(ds, 'dao-1', NOW + 100)
    expect(active).toHaveLength(1)
    expect(active[0].delegator).toBe('a')
  })

  it('resolveDelegation resolves single hop', () => {
    const snapshot = makeSnapshot('dao-1', [
      { id: 'alice', weight: 10 },
      { id: 'bob', weight: 5 },
    ], NOW)
    const ds: Delegation[] = [
      createDelegation({ daoId: 'dao-1', delegator: 'alice', delegate: 'bob', castAt: NOW }),
    ]
    const resolved = resolveDelegation('alice', 'dao-1', snapshot, ds, { maxDepth: 5 })
    expect(resolved.finalVoter).toBe('bob')
    expect(resolved.depth).toBe(1)
    expect(resolved.chain).toEqual(['alice'])
  })

  it('resolveDelegation resolves multi-hop', () => {
    const snapshot = makeSnapshot('dao-1', [
      { id: 'alice', weight: 10 },
      { id: 'bob', weight: 5 },
      { id: 'charlie', weight: 3 },
    ], NOW)
    const ds: Delegation[] = [
      createDelegation({ daoId: 'dao-1', delegator: 'alice', delegate: 'bob', castAt: NOW }),
      createDelegation({ daoId: 'dao-1', delegator: 'bob', delegate: 'charlie', castAt: NOW }),
    ]
    const resolved = resolveDelegation('alice', 'dao-1', snapshot, ds, { maxDepth: 5 })
    expect(resolved.finalVoter).toBe('charlie')
    expect(resolved.depth).toBe(2)
  })

  it('resolveVotingPower returns direct + delegated weight', () => {
    const snapshot = makeSnapshot('dao-1', [
      { id: 'alice', weight: 10 },
      { id: 'bob', weight: 5 },
      { id: 'charlie', weight: 3 },
    ], NOW)
    const ds: Delegation[] = [
      createDelegation({ daoId: 'dao-1', delegator: 'alice', delegate: 'bob', castAt: NOW }),
    ]
    const power = resolveVotingPower('bob', 'dao-1', snapshot, ds)
    expect(power.directWeight).toBe(5)
    expect(power.delegatedFrom).toHaveLength(1)
    expect(power.totalWeight).toBe(5 + 10)
  })
})

// ─── 5. voting ──────────────────────────────────────────────────────────────

describe('voting', () => {
  let cfg: GovernanceConfig
  let snapshot: MembershipSnapshot
  let proposal: Proposal

  beforeEach(() => {
    cfg = makeConfig()
    snapshot = makeSnapshot('dao-1', [{ id: 'alice', weight: 10 }], NOW)
    proposal = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'alice',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    proposal = activateProposal(proposal) as Proposal
  })

  it('createVote succeeds for active proposal', () => {
    const vote = createVote({
      proposal,
      voter: 'alice',
      choice: 'yes',
      snapshot,
      castAt: NOW + 1000,
    }) as Vote
    expect(typeof vote).not.toBe('string')
    expect(vote.choice).toBe('yes')
    expect(vote.weight).toBe(10)
    expect(vote.id).toMatch(/^totem:gov:vote:/)
  })

  it('createVote fails before voting starts', () => {
    const result = createVote({
      proposal,
      voter: 'alice',
      choice: 'yes',
      snapshot,
      castAt: NOW - 1000,
    })
    expect(typeof result).toBe('string')
  })

  it('createVote fails for non-member', () => {
    const result = createVote({
      proposal,
      voter: 'unknown',
      choice: 'yes',
      snapshot,
      castAt: NOW + 1000,
    })
    expect(typeof result).toBe('string')
  })

  it('createVoteProofDraft produces valid proof', () => {
    const vote = createVote({
      proposal,
      voter: 'alice',
      choice: 'yes',
      snapshot,
      castAt: NOW + 1000,
    }) as Vote
    const draft = createVoteProofDraft(vote, 'alice')
    expect(draft.proofId).toMatch(/^totem:proof:/)
    expect(draft.subject.id).toBe(vote.id)
  })

  it('createQuadraticVote allocates credits correctly', () => {
    const result = createQuadraticVote({
      proposal,
      voter: 'alice',
      allocations: [
        { choice: 'yes', votes: 3 },
        { choice: 'no', votes: 1 },
      ],
      snapshot,
      castAt: NOW + 1000,
    })
    expect(Array.isArray(result)).toBe(true)
    const votes = result as Vote[]
    expect(votes).toHaveLength(2)
    const yesVote = votes.find((v) => v.choice === 'yes')!
    expect(yesVote.quadraticCredits).toBe(9)
    const noVote = votes.find((v) => v.choice === 'no')!
    expect(noVote.quadraticCredits).toBe(1)
  })

  it('createQuadraticVote rejects insufficient credits', () => {
    const result = createQuadraticVote({
      proposal,
      voter: 'alice',
      allocations: [{ choice: 'yes', votes: 100 }],
      snapshot,
      credits: { memberId: 'alice', totalCredits: 10, spentCredits: 0, creditSource: 'fixed' },
      castAt: NOW + 1000,
    })
    expect(typeof result).toBe('string')
  })

  it('createDelegatedVote creates votes for inbound delegations', () => {
    const ds: Delegation[] = [
      createDelegation({ daoId: 'dao-1', delegator: 'alice', delegate: 'bob', castAt: NOW }),
    ]
    const bobSnapshot = makeSnapshot('dao-1', [
      { id: 'alice', weight: 10 },
      { id: 'bob', weight: 5 },
    ], NOW)
    const result = createDelegatedVote({
      proposal,
      delegate: 'bob',
      delegations: ds,
      snapshot: bobSnapshot,
      choice: 'yes',
      castAt: NOW + 1000,
    })
    expect(Array.isArray(result)).toBe(true)
    const votes = result as Vote[]
    expect(votes).toHaveLength(1)
    expect(votes[0].voter).toBe('alice')
    expect(votes[0].weight).toBe(10)
  })

  it('createDelegatedVote fails with no inbound delegations', () => {
    const result = createDelegatedVote({
      proposal,
      delegate: 'unknown',
      delegations: [],
      snapshot,
      choice: 'yes',
      castAt: NOW + 1000,
    })
    expect(typeof result).toBe('string')
  })
})

// ─── 6. tally ───────────────────────────────────────────────────────────────

describe('tally', () => {
  it('tallyVotes computes linear tally correctly', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [
      { id: 'a', weight: 100 },
      { id: 'b', weight: 50 },
      { id: 'c', weight: 50 },
    ], NOW)
    const proposal = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal

    const votes: Vote[] = [
      { id: 'v1', proposalId: proposal.id, voter: 'a', choice: 'yes', weight: 100, castAt: NOW + 1000 },
      { id: 'v2', proposalId: proposal.id, voter: 'b', choice: 'yes', weight: 50, castAt: NOW + 2000 },
      { id: 'v3', proposalId: proposal.id, voter: 'c', choice: 'no', weight: 50, castAt: NOW + 3000 },
    ]

    const tally = tallyVotes({
      proposal: { ...proposal, status: 'active', votingEndsAt: NOW + 500 },
      votes,
      totalWeight: 200,
      config: cfg,
    }) as any

    expect(typeof tally).not.toBe('string')
    expect(tally.yes).toBe(150)
    expect(tally.no).toBe(50)
    expect(tally.quorumReached).toBe(true)
    expect(tally.passed).toBe(true)
  })

  it('tallyVotes rejects before voting ends', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: cfg,
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal

    const result = tallyVotes({
      proposal: { ...proposal, status: 'active', votingEndsAt: NOW + 999999 },
      votes: [],
      totalWeight: 10,
      config: cfg,
    })
    expect(typeof result).toBe('string')
  })

  it('finalizeProposal sets status based on tally', () => {
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: makeConfig(),
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    const tally = {
      proposalId: proposal.id,
      yes: 100,
      no: 50,
      abstain: 0,
      totalWeight: 200,
      quorumWeight: 100,
      quorumReached: true,
      passed: true,
      thresholdBps: 5000,
      algorithm: 'linear' as const,
    }
    const finalized = finalizeProposal(proposal, tally)
    expect(finalized.status).toBe('passed')
    expect(finalized.voteTally).toBe(tally)
  })
})

// ─── 7. outcome ─────────────────────────────────────────────────────────────

describe('outcome', () => {
  it('createOutcome returns valid outcome', () => {
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: makeConfig(),
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    const tally = {
      proposalId: proposal.id,
      yes: 10,
      no: 0,
      abstain: 0,
      totalWeight: 10,
      quorumWeight: 5,
      quorumReached: true,
      passed: true,
      thresholdBps: 5000,
      algorithm: 'linear' as const,
    }
    const outcome = createOutcome({ proposal, tally, determinedBy: 'admin', determinedAt: NOW })
    expect(outcome.proposalId).toBe(proposal.id)
    expect(outcome.passed).toBe(true)
    expect(outcome.status).toBe('passed')
    expect(outcome.tallyHash).toMatch(/^[0-9a-f]+$/)
  })

  it('createGovernedMandate binds constraints correctly', () => {
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: makeConfig(),
      actions: [
        { type: 'treasury_spend', target: '0xRECIPIENT', payload: { amount: '1000' }, description: 'pay' },
      ],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    const tally = {
      proposalId: proposal.id,
      yes: 10,
      no: 0,
      abstain: 0,
      totalWeight: 10,
      quorumWeight: 5,
      quorumReached: true,
      passed: true,
      thresholdBps: 5000,
      algorithm: 'linear' as const,
    }
    const outcome = createOutcome({ proposal, tally, determinedBy: 'admin', determinedAt: NOW })
    const mandate = createGovernedMandate(
      outcome,
      proposal.actions[0],
      0,
      'gov-identity',
      'executor-address',
      {
        membershipSnapshotHash: snapshot.hash,
        voteTallyHash: outcome.tallyHash,
        outcomeProofId: 'proof:123',
      },
    )
    expect(mandate.grantor).toBe('gov-identity')
    expect(mandate.grantee).toBe('executor-address')
    expect(mandate.scope).toBe('governance:treasury_spend:execute')
    expect(mandate.constraints).toBeDefined()
    expect(mandate.usageLimit?.maxCount).toBe(1)
    const proposalConstraint = mandate.constraints!.find((c) => c.field === 'proposalId')!
    expect(proposalConstraint.value).toBe(proposal.id)
  })

  it('createOutcomeProofDraft produces valid proof', () => {
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: makeConfig(),
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    const tally = {
      proposalId: proposal.id,
      yes: 10,
      no: 0,
      abstain: 0,
      totalWeight: 10,
      quorumWeight: 5,
      quorumReached: true,
      passed: true,
      thresholdBps: 5000,
      algorithm: 'linear' as const,
    }
    const outcome = createOutcome({ proposal, tally, determinedBy: 'admin', determinedAt: NOW })
    const draft = createOutcomeProofDraft(outcome, 'admin')
    expect(draft.proofId).toMatch(/^totem:proof:/)
    expect(draft.payload?.schema).toBe('totem:governance:outcome/v1')
  })

  it('finalizeProposalExecution sets executed status', () => {
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    let proposal = createProposal({
      config: makeConfig(),
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    proposal = { ...proposal, status: 'passed' }

    const signed = {
      proofId: 'totem:proof:abc',
      kind: 'custom' as const,
      subject: { id: proposal.id, kind: 'proposal-outcome' },
      issuer: 'admin',
      issuedAt: NOW,
      payload: {},
      signature: { address: 'Mx', publicKey: 'pk', signature: 'sig' },
    }

    const executed = finalizeProposalExecution(proposal, signed, 'tx-123')
    expect(executed.status).toBe('executed')
    expect(executed.executionTxId).toBe('tx-123')
  })
})

// ─── 8. usage store ─────────────────────────────────────────────────────────

describe('UsageStore', () => {
  it('reserve → commit round-trip works', () => {
    const store = new UsageStore()
    const res = store.reserveMandateUse('mandate:abc', 'intent:xyz')
    expect(res.status).toBe('reserved')

    const receipt = store.commitMandateUse(res.id, {
      proposalId: 'prop-1',
      actionIndex: 0,
      actionType: 'custom',
    })
    expect(typeof receipt).not.toBe('string')
    expect((receipt as any).mandateProofId).toBe('mandate:abc')
  })

  it('abortMandateUse marks reservation as aborted', () => {
    const store = new UsageStore()
    const res = store.reserveMandateUse('mandate:abc', 'intent:xyz')
    expect(store.abortMandateUse(res.id)).toBe(true)
    expect(store.getReservation(res.id)!.status).toBe('aborted')
  })

  it('commit fails for expired reservation', () => {
    const store = new UsageStore()
    const res = store.reserveMandateUse('mandate:abc', 'intent:xyz', -1)
    const receipt = store.commitMandateUse(res.id, {
      proposalId: 'prop-1',
      actionIndex: 0,
      actionType: 'custom',
    })
    expect(typeof receipt).toBe('string')
  })

  it('getReceiptsByMandate returns all receipts for a mandate', () => {
    const store = new UsageStore()
    const res1 = store.reserveMandateUse('mandate:abc', 'intent:1')
    store.commitMandateUse(res1.id, {
      proposalId: 'prop-1',
      actionIndex: 0,
      actionType: 'custom',
      proofId: 'proof:1',
    })
    const res2 = store.reserveMandateUse('mandate:abc', 'intent:2')
    store.commitMandateUse(res2.id, {
      proposalId: 'prop-2',
      actionIndex: 0,
      actionType: 'custom',
      proofId: 'proof:2',
    })
    const receipts = store.getReceiptsByMandate('mandate:abc')
    expect(receipts).toHaveLength(2)
  })
})

// ─── 9. execution ───────────────────────────────────────────────────────────

describe('execution', () => {
  it('executeProposal returns mandate plans for passed proposal', () => {
    const cfg = makeConfig()
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: cfg,
      actions: [
        { type: 'custom', target: '0xTARGET', payload: { value: '42' }, description: 'action 1' },
        { type: 'custom', payload: {}, description: 'action 2' },
      ],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW - 2000,
    }) as Proposal
    const tally = {
      proposalId: proposal.id,
      yes: 10,
      no: 0,
      abstain: 0,
      totalWeight: 10,
      quorumWeight: 5,
      quorumReached: true,
      passed: true,
      thresholdBps: 5000,
      algorithm: 'linear' as const,
    }
    const plans = executeProposal(
      { ...proposal, status: 'passed', votingEndsAt: NOW - 1000 },
      tally,
      'outcome-proof-id',
      'gov-identity',
      'executor',
    )
    expect(plans).toHaveLength(2)
    expect(plans[0].actionIndex).toBe(0)
    expect(plans[0].mandateBody.scope).toBe('governance:custom:execute')
    expect(plans[1].actionIndex).toBe(1)
  })

  it('executeProposal returns empty for non-passed proposal', () => {
    const snapshot = makeSnapshot('dao-1', [{ id: 'a', weight: 10 }], NOW)
    const proposal = createProposal({
      config: makeConfig(),
      actions: [],
      title: 'Test',
      description: 'desc',
      proposer: 'a',
      snapshot,
      createdAt: NOW,
    }) as Proposal
    const tally = {
      proposalId: proposal.id,
      yes: 0,
      no: 0,
      abstain: 0,
      totalWeight: 10,
      quorumWeight: 5,
      quorumReached: false,
      passed: false,
      thresholdBps: 5000,
      algorithm: 'linear' as const,
    }
    expect(executeProposal(proposal, tally, '', '', '')).toHaveLength(0)
  })

  it('isExecutionReady returns true after delay elapsed', () => {
    const longAgo = Date.now() - 99999999
    const cfg = makeConfig({ voting: { ...makeConfig().voting, executionDelayMs: 1000 } })
    const proposal = {
      status: 'passed' as const,
      votingEndsAt: longAgo,
      executionDelay: 1000,
    } as any
    expect(isExecutionReady(proposal, cfg)).toBe(true)
  })

  it('isExecutionReady returns false before delay', () => {
    const farFuture = Date.now() + 99999999
    const cfg = makeConfig({ voting: { ...makeConfig().voting, executionDelayMs: 5000 } })
    const proposal = {
      status: 'passed' as const,
      votingEndsAt: farFuture,
      executionDelay: 5000,
    } as any
    expect(isExecutionReady(proposal, cfg)).toBe(false)
  })
})

// ─── 10. Package root export ─────────────────────────────────────────────────

describe('root index exports', () => {
  it('exports all expected names', () => {
    const mod = require('../index')
    const expected = [
      'toHex',
      'canonicalJson',
      'hashCanonical',
      'computeProposalId',
      'computeVoteId',
      'computeTallyHash',
      'computeDelegationId',
      'computeSnapshotHash',
      'computeOutcomeId',
      'createGovernanceConfig',
      'validateGovernanceConfig',
      'freezeMembershipSnapshot',
      'verifyMembershipSnapshot',
      'getMemberWeight',
      'getTotalWeight',
      'createProposal',
      'createProposalProofDraft',
      'activateProposal',
      'cancelProposal',
      'createDelegation',
      'recallDelegation',
      'getActiveDelegations',
      'getWeightToDelegate',
      'resolveDelegation',
      'resolveVotingPower',
      'createVote',
      'createQuadraticVote',
      'createDelegatedVote',
      'createVoteProofDraft',
      'tallyVotes',
      'finalizeProposal',
      'computeTallyProofHash',
      'createOutcome',
      'createOutcomeProofDraft',
      'createGovernedMandate',
      'finalizeProposalExecution',
      'UsageStore',
      'executeProposal',
      'isExecutionReady',
    ]
    for (const sym of expected) {
      expect(mod[sym]).toBeDefined()
    }
  })
})

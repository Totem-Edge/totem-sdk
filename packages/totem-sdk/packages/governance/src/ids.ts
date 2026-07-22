import type { Proposal, Vote, VoteTally, Delegation, MembershipSnapshot, ProposalOutcome } from './types.js'
import { hashCanonical } from './canonical.js'

const DOMAIN_PROPOSAL = 'TOTEM_GOVERNANCE_PROPOSAL_V1'
const DOMAIN_VOTE = 'TOTEM_GOVERNANCE_VOTE_V1'
const DOMAIN_TALLY = 'TOTEM_GOVERNANCE_TALLY_V1'
const DOMAIN_DELEGATION = 'TOTEM_GOVERNANCE_DELEGATION_V1'
const DOMAIN_SNAPSHOT = 'TOTEM_GOVERNANCE_SNAPSHOT_V1'
const DOMAIN_OUTCOME = 'TOTEM_GOVERNANCE_OUTCOME_V1'

export function computeProposalId(daoId: string, proposer: string, createdAt: number, actions: number): string {
  return 'totem:gov:proposal:' + hashCanonical(DOMAIN_PROPOSAL, { daoId, proposer, createdAt, actionCount: actions })
}

export function computeVoteId(proposalId: string, voter: string, choice: string, castAt: number): string {
  return 'totem:gov:vote:' + hashCanonical(DOMAIN_VOTE, { proposalId, voter, choice, castAt })
}

export function computeTallyHash(tally: VoteTally): string {
  return hashCanonical(DOMAIN_TALLY, {
    proposalId: tally.proposalId,
    yes: tally.yes,
    no: tally.no,
    abstain: tally.abstain,
    totalWeight: tally.totalWeight,
    quorumWeight: tally.quorumWeight,
    thresholdBps: tally.thresholdBps,
    algorithm: tally.algorithm,
  })
}

export function computeDelegationId(delegator: string, delegate: string, daoId: string, castAt: number): string {
  return 'totem:gov:delegation:' + hashCanonical(DOMAIN_DELEGATION, { delegator, delegate, daoId, castAt })
}

export function computeSnapshotHash(daoId: string, frozenAt: number, entries: Array<{ memberId: string; weight: number }>): string {
  const sorted = [...entries].sort((a, b) => a.memberId.localeCompare(b.memberId))
  return hashCanonical(DOMAIN_SNAPSHOT, { daoId, frozenAt, entries: sorted })
}

export function computeOutcomeId(proposalId: string, tallyHash: string, determinedAt: number): string {
  return 'totem:gov:outcome:' + hashCanonical(DOMAIN_OUTCOME, { proposalId, tallyHash, determinedAt })
}

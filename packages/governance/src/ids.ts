import type { Proposal, Vote, VoteTally, Delegation, MembershipSnapshot, MembershipEntry, ProposalOutcome } from './types.js'
import { hashCanonical } from '@totemsdk/core'

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

/**
 * Canonical snapshot hash.
 *
 * Covers every field that determines voting eligibility: `memberId`, `role`,
 * `weight`, `addedAt`, `addedBy`, and `expiresAt`. Omitting any of these would
 * let an attacker mutate eligibility metadata (e.g. grant a role, extend an
 * expiry, or backdate an `addedAt`) without invalidating the snapshot hash.
 */
export function computeSnapshotHash(daoId: string, frozenAt: number, entries: MembershipEntry[]): string {
  const normalized = entries.map((e) => ({
    memberId: e.memberId,
    role: e.role,
    weight: e.weight,
    addedAt: e.addedAt,
    addedBy: e.addedBy,
    expiresAt: e.expiresAt ?? null,
  }))
  const sorted = [...normalized].sort((a, b) => a.memberId.localeCompare(b.memberId))
  return hashCanonical(DOMAIN_SNAPSHOT, { daoId, frozenAt, entries: sorted })
}

export function computeOutcomeId(proposalId: string, tallyHash: string, determinedAt: number): string {
  return 'totem:gov:outcome:' + hashCanonical(DOMAIN_OUTCOME, { proposalId, tallyHash, determinedAt })
}

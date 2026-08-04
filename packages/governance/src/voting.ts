import { createProof } from '@totemsdk/proof'
import type { UnsignedProof } from '@totemsdk/proof'
import type { Proposal, Vote, Delegation, MembershipSnapshot, GovernanceConfig, QuadraticCredits, GovernanceResult } from './types.js'
import { computeVoteId } from './ids.js'
import { getMemberWeight, verifyMembershipSnapshot } from './snapshot.js'
import { getActiveDelegations } from './delegation.js'

function validateVotingSnapshot(proposal: Proposal, snapshot: MembershipSnapshot): string | undefined {
  if (snapshot.daoId !== proposal.daoId || snapshot.hash !== proposal.membershipSnapshotHash) {
    return 'membership snapshot does not match proposal'
  }
  if (!verifyMembershipSnapshot(snapshot)) {
    return 'membership snapshot integrity check failed'
  }
  return undefined
}

export function createVote(params: {
  proposal: Proposal
  voter: string
  choice: 'yes' | 'no' | 'abstain'
  snapshot: MembershipSnapshot
  delegations?: Delegation[]
  config?: GovernanceConfig
  castAt?: number
}): GovernanceResult<Vote> {
  const { proposal, voter, choice, snapshot } = params
  const now = params.castAt ?? Date.now()

  const snapshotError = validateVotingSnapshot(proposal, snapshot)
  if (snapshotError) return { error: snapshotError }

  if (proposal.status !== 'active') {
    return { error: `proposal is in status '${proposal.status}', cannot vote` }
  }
  if (now < proposal.votingStartsAt) {
    return { error: 'voting has not started yet' }
  }
  if (now > proposal.votingEndsAt) {
    return { error: 'voting has ended' }
  }

  if (choice === 'abstain' && params.config && !params.config.voting.allowAbstain) {
    return { error: 'abstain is not allowed' }
  }

  const weight = getMemberWeight(snapshot, voter, snapshot.frozenAt)
  if (weight <= 0) {
    return { error: 'voter has no weight in membership snapshot' }
  }

  const id = computeVoteId(proposal.id, voter, choice, now)

  let delegationChain: string[] | undefined
  if (params.delegations && params.delegations.length > 0) {
    const active = getActiveDelegations(params.delegations, proposal.daoId)
    const outDelegations = active.filter((d) => d.delegator === voter)
    if (outDelegations.length > 0) {
      delegationChain = [voter]
    }
  }

  return { id, proposalId: proposal.id, voter, choice, weight, castAt: now, delegationChain }
}

export function createQuadraticVote(params: {
  proposal: Proposal
  voter: string
  allocations: Array<{ choice: 'yes' | 'no'; votes: number }>
  snapshot: MembershipSnapshot
  credits?: QuadraticCredits
  config?: GovernanceConfig
  castAt?: number
}): GovernanceResult<Vote[]> {
  const { proposal, voter, allocations, snapshot, credits } = params
  const now = params.castAt ?? Date.now()

  const snapshotError = validateVotingSnapshot(proposal, snapshot)
  if (snapshotError) return { error: snapshotError }

  if (proposal.status !== 'active') {
    return { error: `proposal is in status '${proposal.status}', cannot vote` }
  }
  if (now < proposal.votingStartsAt) {
    return { error: 'voting has not started yet' }
  }
  if (now > proposal.votingEndsAt) {
    return { error: 'voting has ended' }
  }

  const weight = getMemberWeight(snapshot, voter, snapshot.frozenAt)
  if (weight <= 0) {
    return { error: 'voter has no weight in membership snapshot' }
  }

  if (allocations.length === 0) {
    return { error: 'quadratic vote must contain at least one allocation' }
  }

  const choices = new Set<string>()
  for (const allocation of allocations) {
    if (choices.has(allocation.choice)) {
      return { error: `duplicate quadratic allocation for choice '${allocation.choice}'` }
    }
    choices.add(allocation.choice)
    if (!Number.isSafeInteger(allocation.votes) || allocation.votes <= 0) {
      return { error: 'quadratic allocation votes must be positive safe integers' }
    }
  }

  if (credits && credits.memberId !== voter) {
    return { error: 'quadratic credit state does not belong to voter' }
  }

  if (credits && (
    !Number.isSafeInteger(credits.totalCredits) ||
    !Number.isSafeInteger(credits.spentCredits) ||
    credits.totalCredits < 0 ||
    credits.spentCredits < 0 ||
    credits.spentCredits > credits.totalCredits
  )) {
    return { error: 'invalid quadratic credit state' }
  }

  const quadraticConfig = params.config?.voting.quadratic
  if (quadraticConfig?.creditSource === 'fixed' && !credits) {
    return { error: 'fixed-credit quadratic voting requires credit state' }
  }

  const totalCreditsNeeded = allocations.reduce((sum, a) => sum + a.votes * a.votes, 0)

  if (!Number.isSafeInteger(totalCreditsNeeded)) {
    return { error: 'quadratic vote exceeds safe credit limits' }
  }

  if (quadraticConfig?.maxCreditsPerMember !== undefined &&
      totalCreditsNeeded > quadraticConfig.maxCreditsPerMember) {
    return { error: 'quadratic vote exceeds per-member credit limit' }
  }

  if (credits) {
    const available = credits.totalCredits - credits.spentCredits
    if (totalCreditsNeeded > available) {
      return { error: `quadratic vote requires ${totalCreditsNeeded} credits but only ${available} available` }
    }
  }

  if (params.config?.voting.quadratic?.creditSource === 'weight') {
    if (totalCreditsNeeded > weight) {
      return { error: `quadratic vote requires ${totalCreditsNeeded} credits but weight is only ${weight}` }
    }
  }

  return allocations.map((alloc) => {
    const id = computeVoteId(proposal.id, voter, alloc.choice, now)
    return {
      id,
      proposalId: proposal.id,
      voter,
      choice: alloc.choice,
      weight: alloc.votes,
      quadraticCredits: alloc.votes * alloc.votes,
      castAt: now,
    }
  })
}

export function createDelegatedVote(params: {
  proposal: Proposal
  delegate: string
  delegations: Delegation[]
  snapshot: MembershipSnapshot
  choice: 'yes' | 'no' | 'abstain'
  castAt?: number
}): GovernanceResult<Vote[]> {
  const { proposal, delegate, delegations, snapshot, choice } = params
  const now = params.castAt ?? Date.now()

  const snapshotError = validateVotingSnapshot(proposal, snapshot)
  if (snapshotError) return { error: snapshotError }

  if (proposal.status !== 'active') {
    return { error: `proposal is in status '${proposal.status}', cannot vote` }
  }
  if (now < proposal.votingStartsAt) {
    return { error: 'voting has not started yet' }
  }
  if (now > proposal.votingEndsAt) {
    return { error: 'voting has ended' }
  }

  const activeDelegations = getActiveDelegations(delegations, proposal.daoId)
  const inboundDelegations = activeDelegations.filter((d) => d.delegate === delegate)
  if (inboundDelegations.length === 0) {
    return { error: `no delegations found pointing to ${delegate}` }
  }

  const votes: Vote[] = []
  const processed = new Set<string>()

  for (const del of inboundDelegations) {
    if (processed.has(del.delegator)) continue
    processed.add(del.delegator)

    const delegatorWeight = getMemberWeight(snapshot, del.delegator, snapshot.frozenAt)
    if (delegatorWeight <= 0) continue

    const effectiveWeight = del.weight > 0 ? Math.min(del.weight, delegatorWeight) : delegatorWeight
    const id = computeVoteId(proposal.id, del.delegator, choice, now)

    votes.push({
      id,
      proposalId: proposal.id,
      voter: del.delegator,
      choice,
      weight: effectiveWeight,
      delegationChain: [del.delegator, delegate],
      castAt: now,
    })
  }

  return votes
}

export function createVoteProofDraft(
  vote: Vote,
  issuer: string,
): UnsignedProof {
  return createProof({
    kind: 'custom',
    subject: { id: vote.id, kind: 'vote' },
    issuer,
    issuedAt: vote.castAt,
    payload: {
      schema: 'totem:governance:vote/v1',
      vote: {
        id: vote.id,
        proposalId: vote.proposalId,
        voter: vote.voter,
        choice: vote.choice,
        weight: vote.weight,
      },
    },
  })
}

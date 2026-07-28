import { createProof } from '@totemsdk/proof'
import type { UnsignedProof } from '@totemsdk/proof'
import type { Proposal, Vote, Delegation, MembershipSnapshot, GovernanceConfig, QuadraticCredits } from './types.js'
import { computeVoteId } from './ids.js'
import { getMemberWeight } from './snapshot.js'
import { getActiveDelegations } from './delegation.js'

export function createVote(params: {
  proposal: Proposal
  voter: string
  choice: 'yes' | 'no' | 'abstain'
  snapshot: MembershipSnapshot
  delegations?: Delegation[]
  config?: GovernanceConfig
  castAt?: number
}): Vote | string {
  const { proposal, voter, choice, snapshot } = params
  const now = params.castAt ?? Date.now()

  if (proposal.status !== 'active' && proposal.status !== 'draft') {
    return `proposal is in status '${proposal.status}', cannot vote`
  }
  if (now < proposal.votingStartsAt) {
    return 'voting has not started yet'
  }
  if (now > proposal.votingEndsAt) {
    return 'voting has ended'
  }

  if (choice === 'abstain' && params.config && !params.config.voting.allowAbstain) {
    return 'abstain is not allowed'
  }

  const weight = getMemberWeight(snapshot, voter)
  if (weight <= 0) {
    return 'voter has no weight in membership snapshot'
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
}): Vote[] | string {
  const { proposal, voter, allocations, snapshot, credits } = params
  const now = params.castAt ?? Date.now()

  if (proposal.status !== 'active' && proposal.status !== 'draft') {
    return `proposal is in status '${proposal.status}', cannot vote`
  }
  if (now < proposal.votingStartsAt) {
    return 'voting has not started yet'
  }
  if (now > proposal.votingEndsAt) {
    return 'voting has ended'
  }

  const weight = getMemberWeight(snapshot, voter)
  if (weight <= 0) {
    return 'voter has no weight in membership snapshot'
  }

  const totalCreditsNeeded = allocations.reduce((sum, a) => sum + a.votes * a.votes, 0)

  if (credits) {
    const available = credits.totalCredits - credits.spentCredits
    if (totalCreditsNeeded > available) {
      return `quadratic vote requires ${totalCreditsNeeded} credits but only ${available} available`
    }
  }

  if (params.config?.voting.quadratic?.creditSource === 'weight') {
    if (totalCreditsNeeded > weight) {
      return `quadratic vote requires ${totalCreditsNeeded} credits but weight is only ${weight}`
    }
  }

  return allocations.map((alloc) => {
    const id = computeVoteId(proposal.id, voter, alloc.choice, now)
    return {
      id,
      proposalId: proposal.id,
      voter,
      choice: alloc.choice,
      weight: Math.floor(Math.sqrt(alloc.votes * alloc.votes)),
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
}): Vote[] | string {
  const { proposal, delegate, delegations, snapshot, choice } = params
  const now = params.castAt ?? Date.now()

  if (proposal.status !== 'active') {
    return `proposal is in status '${proposal.status}', cannot vote`
  }
  if (now < proposal.votingStartsAt) {
    return 'voting has not started yet'
  }
  if (now > proposal.votingEndsAt) {
    return 'voting has ended'
  }

  const activeDelegations = getActiveDelegations(delegations, proposal.daoId)
  const inboundDelegations = activeDelegations.filter((d) => d.delegate === delegate)
  if (inboundDelegations.length === 0) {
    return `no delegations found pointing to ${delegate}`
  }

  const votes: Vote[] = []
  const processed = new Set<string>()

  for (const del of inboundDelegations) {
    if (processed.has(del.delegator)) continue
    processed.add(del.delegator)

    const delegatorWeight = getMemberWeight(snapshot, del.delegator)
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

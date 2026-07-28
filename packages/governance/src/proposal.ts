import { createProof } from '@totemsdk/proof'
import type { UnsignedProof } from '@totemsdk/proof'
import type { GovernanceConfig, Proposal, ProposalAction, MembershipSnapshot } from './types.js'
import { computeProposalId } from './ids.js'
import { getMemberWeight } from './snapshot.js'

export function createProposal(params: {
  config: GovernanceConfig
  actions: ProposalAction[]
  title: string
  description: string
  proposer: string
  snapshot: MembershipSnapshot
  createdAt?: number
}): Proposal | string {
  const { config, actions, title, description, proposer, snapshot } = params
  const now = params.createdAt ?? Date.now()

  const proposerWeight = getMemberWeight(snapshot, proposer)
  if (proposerWeight < config.membership.minWeightToPropose) {
    return `proposer weight ${proposerWeight} below minimum ${config.membership.minWeightToPropose}`
  }

  if (!snapshot.entries.has(proposer)) {
    return 'proposer is not a member'
  }

  const proposalId = computeProposalId(config.daoId, proposer, now, actions.length)

  const votingStartsAt = now + config.voting.delayBeforeVotingMs
  const votingEndsAt = votingStartsAt + config.voting.votingPeriodMs

  return {
    id: proposalId,
    daoId: config.daoId,
    title,
    description,
    actions: actions.map((a) => ({ ...a })),
    proposer,
    status: 'draft',
    createdAt: now,
    votingStartsAt,
    votingEndsAt,
    executionDelay: config.voting.executionDelayMs,
    membershipSnapshotHash: snapshot.hash,
  }
}

export function createProposalProofDraft(
  proposal: Proposal,
  issuer: string,
): UnsignedProof {
  return createProof({
    kind: 'custom',
    subject: { id: proposal.id, kind: 'proposal' },
    issuer,
    issuedAt: proposal.createdAt,
    payload: {
      schema: 'totem:governance:proposal/v1',
      proposal: {
        id: proposal.id,
        daoId: proposal.daoId,
        title: proposal.title,
        actionCount: proposal.actions.length,
        proposer: proposal.proposer,
        votingStartsAt: proposal.votingStartsAt,
        votingEndsAt: proposal.votingEndsAt,
        membershipSnapshotHash: proposal.membershipSnapshotHash,
      },
    },
  })
}

export function activateProposal(proposal: Proposal): Proposal | string {
  if (proposal.status !== 'draft') {
    return `cannot activate proposal in status '${proposal.status}'`
  }
  const now = Date.now()
  if (now < proposal.votingStartsAt) {
    return `voting has not started yet (starts at ${proposal.votingStartsAt})`
  }
  return { ...proposal, status: 'active' }
}

export function cancelProposal(proposal: Proposal): Proposal | string {
  if (proposal.status === 'executed' || proposal.status === 'cancelled') {
    return `cannot cancel proposal in status '${proposal.status}'`
  }
  return { ...proposal, status: 'cancelled' }
}

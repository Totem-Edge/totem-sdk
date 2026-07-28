import type { CreateProposalParams, ActionProposal } from './types.js'
import { ActionValidationError, ActionCommitmentError } from './errors.js'
import { computeActionProposalId, computeCommitmentHash } from './ids.js'

export function createProposal(params: CreateProposalParams): ActionProposal {
  const now = params.proposedAt ?? Date.now()
  const commitmentHash = computeCommitmentHash({
    kind: params.kind,
    parameters: params.parameters,
    context: params.context,
  })
  const id = computeActionProposalId({
    kind: params.kind,
    parameters: params.parameters,
    context: params.context,
    proposedAt: now,
  })
  const proposal: ActionProposal = {
    id,
    kind: params.kind,
    parameters: params.parameters,
    context: params.context,
    proposedAt: now,
    commitmentHash,
  }
  if (params.expiresAt !== undefined) proposal.expiresAt = params.expiresAt
  if (params.mandateProofId !== undefined) proposal.mandateProofId = params.mandateProofId
  return proposal
}

export function verifyCommitment(proposal: ActionProposal): boolean {
  const expected = computeCommitmentHash({
    kind: proposal.kind,
    parameters: proposal.parameters,
    context: proposal.context,
  })
  return proposal.commitmentHash === expected
}

export function assertValidProposal(proposal: ActionProposal): void {
  if (!proposal.id) throw new ActionValidationError('proposal id is required')
  if (!proposal.kind) throw new ActionValidationError('proposal kind is required')
  if (!verifyCommitment(proposal)) {
    throw new ActionCommitmentError('commitment hash mismatch')
  }
}

export function isProposalExpired(proposal: ActionProposal, now: number): boolean {
  if (proposal.expiresAt === undefined) return false
  return now > proposal.expiresAt
}

export function isProposalExecutable(proposal: ActionProposal, now: number): boolean {
  if (isProposalExpired(proposal, now)) return false
  if (proposal.authorityDecision && !proposal.authorityDecision.allowed) return false
  return true
}

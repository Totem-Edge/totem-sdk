import type { ActionProposal } from './types.js'
import { computeCommitmentHash } from './ids.js'
import { canonicalJson } from '@totemsdk/core'

export function createCommitment(proposal: {
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
  mandateProofId?: string
}): string {
  return computeCommitmentHash(proposal)
}

export function verifyCommitmentBinding(proposal: ActionProposal): boolean {
  const expected = createCommitment({
    kind: proposal.kind,
    parameters: proposal.parameters,
    context: proposal.context,
    ...(proposal.mandateProofId !== undefined ? { mandateProofId: proposal.mandateProofId } : {}),
  })
  return proposal.commitmentHash === expected
}

export function serializeCommitmentPayload(proposal: ActionProposal): string {
  return canonicalJson({
    id: proposal.id,
    kind: proposal.kind,
    commitmentHash: proposal.commitmentHash,
    parameters: proposal.parameters,
    context: proposal.context,
  })
}

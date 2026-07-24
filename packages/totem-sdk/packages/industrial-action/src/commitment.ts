import type { ActionProposal } from './types.js'
import { computeCommitmentHash } from './ids.js'
import { canonicalJson } from './canonical.js'

export function createCommitment(proposal: {
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
}): string {
  return computeCommitmentHash(proposal)
}

export function verifyCommitmentBinding(proposal: ActionProposal): boolean {
  const expected = createCommitment(proposal)
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

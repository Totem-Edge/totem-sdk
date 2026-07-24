import { hashCanonical } from './canonical.js'

export function computeActionProposalId(params: {
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
  proposedAt: number
}): string {
  return 'totem:ia:proposal:' + hashCanonical('TOTEM_INDUSTRIAL_ACTION_PROPOSAL_V1', {
    kind: params.kind,
    parameters: params.parameters,
    context: params.context,
    proposedAt: params.proposedAt,
  })
}

export function computeActionExecutionId(proposalId: string): string {
  return 'totem:ia:exec:' + hashCanonical('TOTEM_INDUSTRIAL_ACTION_EXECUTION_V1', {
    proposalId,
  })
}

export function computeCommitmentHash(proposal: {
  kind: string
  parameters: Record<string, unknown>
  context: Record<string, unknown>
}): string {
  return hashCanonical('TOTEM_INDUSTRIAL_ACTION_COMMITMENT_V1', {
    kind: proposal.kind,
    parameters: proposal.parameters,
    context: proposal.context,
  })
}

export function computeReceiptId(executionId: string, proposalId: string): string {
  return 'totem:ia:receipt:' + hashCanonical('TOTEM_INDUSTRIAL_ACTION_RECEIPT_V1', {
    executionId,
    proposalId,
  })
}

import { hashCanonical } from '@totemsdk/core'

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
  /**
   * RFC-010 §6.4: the mandate proof that authorizes this action is bound into
   * the commitment preimage, so the device operation cannot be re-pointed at a
   * different mandate after the fact.
   */
  mandateProofId?: string
}): string {
  return hashCanonical('TOTEM_INDUSTRIAL_ACTION_COMMITMENT_V2', {
    kind: proposal.kind,
    parameters: proposal.parameters,
    context: proposal.context,
    mandateProofId: proposal.mandateProofId ?? null,
  })
}

/**
 * RFC-010 §6.4 — authority binding digest.
 *
 * Ties a proposal commitment to the exact mandate proof and authorization
 * decision that authorized it. The decision id is generally only known *after*
 * authorization (the edge runtime prepares before it authorizes), so this is
 * computed at the receipt/record layer rather than at `prepare` time.
 */
export function computeAuthorityBindingHash(
  commitmentHash: string,
  mandateProofId?: string,
  decisionId?: string,
): string {
  return hashCanonical('TOTEM_INDUSTRIAL_ACTION_AUTHORITY_BINDING_V1', {
    commitmentHash,
    mandateProofId: mandateProofId ?? null,
    decisionId: decisionId ?? null,
  })
}

export function computeReceiptId(executionId: string, proposalId: string): string {
  return 'totem:ia:receipt:' + hashCanonical('TOTEM_INDUSTRIAL_ACTION_RECEIPT_V1', {
    executionId,
    proposalId,
  })
}

/**
 * Deterministic device-operation id (RFC-010 §6.6).
 *
 * Derived from the proposal commitment and the target resource, so a
 * re-submitted or retried action resolves to the same operation and can be
 * deduplicated by a durable claim.
 */
export function computeOperationId(commitmentHash: string, resourceId?: string): string {
  return 'totem:ia:op:' + hashCanonical('TOTEM_INDUSTRIAL_ACTION_OPERATION_V1', {
    commitmentHash,
    resourceId: resourceId ?? null,
  })
}

import type { GovernanceBridge, ActionProposal, ActionExecution, ActionError } from './types.js'
import type { EdgeOperationResult } from '@totemsdk/edge'
import { ActionGovernanceError } from './errors.js'

export function createGovernanceBridge(reserveFn: GovernanceBridge['reserve']): GovernanceBridge {
  return {
    async reserve(proposal, mandateProofId) {
      return reserveFn(proposal, mandateProofId)
    },
    async commit(reservationId, execution) {
      return { ok: true }
    },
    async abort(reservationId, error) {
      return { ok: true }
    },
  }
}

export function checkGovernanceConstraints(
  proposal: ActionProposal,
  now: number,
): string[] {
  const errors: string[] = []
  if (proposal.authorityDecision && !proposal.authorityDecision.allowed) {
    errors.push(`authority decision denied: ${proposal.authorityDecision.reason ?? 'no reason'}`)
  }
  if (proposal.expiresAt !== undefined && now > proposal.expiresAt) {
    errors.push('proposal has expired')
  }
  return errors
}

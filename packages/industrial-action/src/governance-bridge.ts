import type { GovernanceBridge, ActionProposal } from './types.js'

export function createGovernanceBridge(reserveFn: GovernanceBridge['reserve']): GovernanceBridge {
  return {
    async reserve(proposal, mandateProofId) {
      return reserveFn(proposal, mandateProofId)
    },
    async commit(_reservationId, _execution) {
      return { ok: true }
    },
    async abort(_reservationId, _error) {
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

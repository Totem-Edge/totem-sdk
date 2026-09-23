import type { GovernanceBridge, ActionProposal } from './types.js'

/**
 * @deprecated Superseded by the governed edge runtime (`@totemsdk/edge`
 * `AgentEdgeRuntime` + `@totemsdk/agent-policy`). The `commit`/`abort` methods
 * are stubs; use `toEdgeActionDefinition`. Will be removed in a future minor.
 */
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

/**
 * @deprecated Ad-hoc pre-check superseded by `@totemsdk/agent-policy`
 * authorization and the RFC-010 authority-proof binding. Will be removed.
 */
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

import type {
  Proposal,
  ProposalAction,
  ProposalOutcome,
  VoteTally,
  GovernanceConfig,
} from './types.js'
import { createGovernedMandate, createOutcome } from './outcome.js'
import { computeTallyHash } from './ids.js'

export function executeProposal(
  proposal: Proposal,
  tally: VoteTally,
  outcomeProofId: string,
  governanceIdentity: string,
  executor: string,
): Array<{
  action: ProposalAction
  actionIndex: number
  mandateBody: ReturnType<typeof createGovernedMandate>
}> {
  if (proposal.status !== 'passed') {
    return []
  }

  const now = Date.now()
  const executionDeadline = proposal.votingEndsAt + proposal.executionDelay
  if (now < executionDeadline) {
    return []
  }

  const outcome = createOutcome({ proposal, tally, determinedBy: governanceIdentity })
  const tallyHash = computeTallyHash(tally)

  return proposal.actions.map((action, index) => {
    const mandateBody = createGovernedMandate(
      outcome,
      action,
      index,
      governanceIdentity,
      executor,
      {
        membershipSnapshotHash: proposal.membershipSnapshotHash,
        voteTallyHash: tallyHash,
        outcomeProofId,
      },
    )
    return { action, actionIndex: index, mandateBody }
  })
}

export function isExecutionReady(
  proposal: Proposal,
  _config?: GovernanceConfig,
): boolean {
  if (proposal.status !== 'passed') return false
  const now = Date.now()
  return now >= proposal.votingEndsAt + proposal.executionDelay
}

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
  now = Date.now(),
): Array<{
  action: ProposalAction
  actionIndex: number
  mandateBody: ReturnType<typeof createGovernedMandate>
}> {
  if (proposal.status !== 'passed') {
    return []
  }

  // RFC-020 H6: the executed tally must match the tally committed on the
  // proposal — an independently passed tally cannot be substituted.
  if (proposal.voteTally && computeTallyHash(proposal.voteTally) !== computeTallyHash(tally)) {
    return []
  }

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
  now = Date.now(),
): boolean {
  if (proposal.status !== 'passed') return false
  return now >= proposal.votingEndsAt + proposal.executionDelay
}

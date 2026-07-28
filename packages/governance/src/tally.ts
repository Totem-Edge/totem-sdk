import type { Proposal, Vote, VoteTally, GovernanceConfig } from './types.js'
import { computeTallyHash } from './ids.js'

export function tallyVotes(params: {
  proposal: Proposal
  votes: Vote[]
  totalWeight: number
  quorumWeight?: number
  config?: GovernanceConfig
}): VoteTally | string {
  const { proposal, votes, totalWeight } = params

  if (votes.length === 0) {
    return 'no votes to tally'
  }

  const now = Date.now()
  if (now < proposal.votingEndsAt) {
    return 'voting has not ended yet'
  }

  const algorithm = params.config?.voting?.algorithm === 'quadratic' ? 'quadratic' : 'linear'

  let yesWeight = 0
  let noWeight = 0
  let abstainWeight = 0

  if (algorithm === 'quadratic') {
    for (const vote of votes) {
      const sqrtWeight = vote.weight > 0 ? Math.sqrt(vote.weight) : 0
      if (vote.choice === 'yes') yesWeight += sqrtWeight
      else if (vote.choice === 'no') noWeight += sqrtWeight
      else if (vote.choice === 'abstain') abstainWeight += sqrtWeight
    }
  } else {
    for (const vote of votes) {
      if (vote.choice === 'yes') yesWeight += vote.weight
      else if (vote.choice === 'no') noWeight += vote.weight
      else if (vote.choice === 'abstain') abstainWeight += vote.weight
    }
  }

  const totalCast = yesWeight + noWeight + abstainWeight
  const quorumWeight = params.quorumWeight ?? (params.config
    ? Math.floor((totalWeight * params.config.voting.quorumBps) / 10000)
    : totalWeight)

  const quorumReached = totalCast >= quorumWeight
  const passThresholdBps = params.config?.voting?.passThresholdBps ?? 5000
  const passed = quorumReached && (yesWeight / (yesWeight + noWeight)) * 10000 >= passThresholdBps

  const tally: VoteTally = {
    proposalId: proposal.id,
    yes: Math.floor(yesWeight * 1000) / 1000,
    no: Math.floor(noWeight * 1000) / 1000,
    abstain: Math.floor(abstainWeight * 1000) / 1000,
    totalWeight,
    quorumWeight,
    quorumReached,
    passed,
    thresholdBps: passThresholdBps,
    algorithm,
  }

  return tally
}

export function finalizeProposal(
  proposal: Proposal,
  tally: VoteTally,
): Proposal {
  const status = tally.passed ? 'passed' : 'failed'
  return { ...proposal, status, voteTally: tally }
}

export function computeTallyProofHash(tally: VoteTally): string {
  return computeTallyHash(tally)
}

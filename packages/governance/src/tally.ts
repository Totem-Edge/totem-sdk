import type { Proposal, Vote, VoteTally, GovernanceConfig, GovernanceResult, MembershipSnapshot } from './types.js'
import { computeTallyHash } from './ids.js'
import { getMemberWeight, getTotalWeight, verifyMembershipSnapshot } from './snapshot.js'

export function tallyVotes(params: {
  proposal: Proposal
  votes: Vote[]
  snapshot: MembershipSnapshot
  config?: GovernanceConfig
  now?: number
}): GovernanceResult<VoteTally> {
  const { proposal, votes, snapshot } = params

  if (votes.length === 0) {
    return { error: 'no votes to tally' }
  }

  if (proposal.status !== 'active') {
    return { error: `proposal is in status '${proposal.status}', cannot tally` }
  }

  if (snapshot.daoId !== proposal.daoId || snapshot.hash !== proposal.membershipSnapshotHash) {
    return { error: 'membership snapshot does not match proposal' }
  }
  if (!verifyMembershipSnapshot(snapshot)) {
    return { error: 'membership snapshot integrity check failed' }
  }

  const now = params.now ?? Date.now()
  if (now < proposal.votingEndsAt) {
    return { error: 'voting has not ended yet' }
  }

  const algorithm = params.config?.voting?.algorithm === 'quadratic' ? 'quadratic' : 'linear'

  const seenVoteIds = new Set<string>()
  const seenBallots = new Set<string>()
  const seenVoters = new Set<string>()
  const totalWeight = getTotalWeight(snapshot, snapshot.frozenAt)

  let yesWeight = 0
  let noWeight = 0
  let abstainWeight = 0

  for (const vote of votes) {
    if (vote.proposalId !== proposal.id) {
      return { error: `vote ${vote.id} belongs to a different proposal` }
    }
    if (seenVoteIds.has(vote.id)) {
      return { error: `duplicate vote ID: ${vote.id}` }
    }
    seenVoteIds.add(vote.id)

    const ballotKey = `${vote.voter}:${vote.choice}`
    if (seenBallots.has(ballotKey)) {
      return { error: `duplicate ballot for ${vote.voter} and ${vote.choice}` }
    }
    seenBallots.add(ballotKey)
    if (algorithm !== 'quadratic' && seenVoters.has(vote.voter)) {
      return { error: `duplicate ballot for voter ${vote.voter}` }
    }
    seenVoters.add(vote.voter)

    if (!['yes', 'no', 'abstain'].includes(vote.choice)) {
      return { error: `invalid vote choice for ${vote.voter}` }
    }
    if (vote.castAt < proposal.votingStartsAt || vote.castAt > proposal.votingEndsAt) {
      return { error: `vote ${vote.id} was cast outside the voting interval` }
    }

    const memberWeight = getMemberWeight(snapshot, vote.voter, snapshot.frozenAt)
    if (memberWeight <= 0) {
      return { error: `voter ${vote.voter} is not eligible in the membership snapshot` }
    }
    if (!Number.isFinite(vote.weight) || vote.weight <= 0 || vote.weight > memberWeight) {
      return { error: `invalid vote weight for ${vote.voter}` }
    }
    if (algorithm !== 'quadratic' && !vote.delegationChain && vote.weight !== memberWeight) {
      return { error: `vote weight for ${vote.voter} does not match snapshot weight` }
    }
    if (algorithm === 'quadratic') {
      if (!Number.isSafeInteger(vote.weight) || vote.quadraticCredits !== vote.weight * vote.weight) {
        return { error: `invalid quadratic weight or credits for ${vote.voter}` }
      }
    }

    if (vote.choice === 'yes') yesWeight += vote.weight
    else if (vote.choice === 'no') noWeight += vote.weight
    else abstainWeight += vote.weight
  }

  const totalCast = yesWeight + noWeight + abstainWeight
  const quorumWeight = params.config
    ? Math.floor((totalWeight * params.config.voting.quorumBps) / 10000)
    : totalWeight

  const quorumReached = totalCast >= quorumWeight
  const passThresholdBps = params.config?.voting?.passThresholdBps ?? 5000
  const decided = yesWeight + noWeight
  const passed = quorumReached && decided > 0 && (yesWeight / decided) * 10000 >= passThresholdBps

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
  if (proposal.status !== 'active') {
    throw new Error(`cannot finalize proposal in status '${proposal.status}'`)
  }
  if (tally.proposalId !== proposal.id) {
    throw new Error('tally does not belong to proposal')
  }
  const status = tally.passed ? 'passed' : 'failed'
  return { ...proposal, status, voteTally: tally }
}

export function computeTallyProofHash(tally: VoteTally): string {
  return computeTallyHash(tally)
}

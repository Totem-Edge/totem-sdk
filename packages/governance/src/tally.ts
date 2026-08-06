import type { Proposal, Vote, VoteTally, GovernanceConfig, GovernanceResult, MembershipSnapshot, Delegation } from './types.js'
import { computeTallyHash, computeVoteId } from './ids.js'
import { getMemberWeight, getTotalWeight, verifyMembershipSnapshot } from './snapshot.js'
import { getActiveDelegations } from './delegation.js'

export function tallyVotes(params: {
  proposal: Proposal
  votes: Vote[]
  snapshot: MembershipSnapshot
  config?: GovernanceConfig
  delegations?: Delegation[]
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
  const quadraticConfig = params.config?.voting?.quadratic

  const seenVoteIds = new Set<string>()
  const seenBallots = new Set<string>()
  const seenVoters = new Set<string>()
  const spentCreditsByVoter = new Map<string, number>()
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

    // Ballot ID binding: every vote's ID is deterministic given its contents,
    // so a forged or recomputed ballot cannot claim an arbitrary ID.
    const expectedVoteId = computeVoteId(vote.proposalId, vote.voter, vote.choice, vote.castAt)
    if (vote.id !== expectedVoteId) {
      return { error: `vote ID ${vote.id} does not match its ballot contents` }
    }

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

    // Delegations must resolve to real, active delegation records when a vote
    // claims to have been cast on behalf of someone else.
    if (vote.delegationChain && vote.delegationChain.length > 0) {
      if (!params.delegations) {
        return { error: `vote ${vote.id} has a delegation chain but no delegation records were provided` }
      }
      const chainError = validateDelegatedBallot(vote, params.delegations, proposal.daoId, snapshot, now)
      if (chainError) return { error: chainError }
    } else if (algorithm !== 'quadratic' && vote.weight !== memberWeight) {
      return { error: `vote weight for ${vote.voter} does not match snapshot weight` }
    }

    if (algorithm === 'quadratic') {
      if (!Number.isSafeInteger(vote.weight) || vote.quadraticCredits !== vote.weight * vote.weight) {
        return { error: `invalid quadratic weight or credits for ${vote.voter}` }
      }
      // Aggregate budget: a voter must not exceed their total quadratic credit
      // budget across ALL of their ballots, not just within a single ballot.
      const spent = (spentCreditsByVoter.get(vote.voter) ?? 0) + (vote.quadraticCredits ?? 0)
      const budget =
        quadraticConfig?.creditSource === 'fixed'
          ? (quadraticConfig.maxCreditsPerMember ?? memberWeight)
          : memberWeight
      if (spent > budget) {
        return {
          error: `aggregate quadratic credits for ${vote.voter} (${spent}) exceed budget of ${budget}`,
        }
      }
      spentCreditsByVoter.set(vote.voter, spent)
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

/**
 * Verify that a vote claiming to be delegated matches real delegation records:
 * - the chain must start at the voter who casts the ballot
 * - every hop must be an active delegation record for the proposal
 * - the weight must not exceed what the delegation actually transfers
 */
function validateDelegatedBallot(
  vote: Vote,
  delegations: Delegation[],
  daoId: string,
  snapshot: MembershipSnapshot,
  now: number,
): string | undefined {
  const chain = vote.delegationChain!
  if (chain[0] !== vote.voter) {
    return `delegation chain for ${vote.voter} does not start with the voter`
  }
  const active = getActiveDelegations(delegations, daoId, now)
  for (let i = 0; i < chain.length - 1; i++) {
    const hop = active.find((d) => d.delegator === chain[i] && d.delegate === chain[i + 1])
    if (!hop) {
      return `delegation ${chain[i]} -> ${chain[i + 1]} in vote ${vote.id} is not an active delegation record`
    }
  }
  const delegatorWeight = getMemberWeight(snapshot, vote.voter, snapshot.frozenAt)
  const firstHop = active.find((d) => d.delegator === chain[0] && d.delegate === chain[1])
  const transferred = firstHop && firstHop.weight > 0 ? Math.min(firstHop.weight, delegatorWeight) : delegatorWeight
  if (vote.weight > transferred) {
    return `delegated vote weight for ${vote.voter} exceeds delegated weight`
  }
  return undefined
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

import type { Delegation, DelegationResolution, MembershipSnapshot } from './types.js'
import { computeDelegationId } from './ids.js'
import { getMemberWeight } from './snapshot.js'

export function createDelegation(params: {
  daoId: string
  delegator: string
  delegate: string
  weight?: number
  scope?: 'all' | 'proposal' | string
  expiresAt?: number
  castAt?: number
  previousDelegationId?: string
}): Delegation {
  const now = params.castAt ?? Date.now()
  return {
    id: computeDelegationId(params.delegator, params.delegate, params.daoId, now),
    daoId: params.daoId,
    delegator: params.delegator,
    delegate: params.delegate,
    weight: params.weight ?? 0,
    scope: params.scope,
    expiresAt: params.expiresAt,
    castAt: now,
    previousDelegationId: params.previousDelegationId,
  }
}

export function recallDelegation(
  delegation: Delegation,
  revokedAt?: number,
): Delegation {
  return { ...delegation, revokedAt: revokedAt ?? Date.now() }
}

export function getActiveDelegations(
  delegations: Delegation[],
  daoId: string,
  now?: number,
): Delegation[] {
  const t = now ?? Date.now()
  return delegations.filter(
    (d) =>
      d.daoId === daoId &&
      d.revokedAt === undefined &&
      (d.expiresAt === undefined || t <= d.expiresAt),
  )
}

export function getWeightToDelegate(
  memberId: string,
  snapshot: MembershipSnapshot,
  delegations: Delegation[],
  daoId: string,
): number {
  const active = getActiveDelegations(delegations, daoId)
  const memberDelegations = active.filter((d) => d.delegator === memberId)
  if (memberDelegations.length === 0) return 0

  const totalWeight = getMemberWeight(snapshot, memberId)
  let delegatedAway = 0
  for (const d of memberDelegations) {
    if (d.weight <= 0) {
      delegatedAway += totalWeight
    } else {
      delegatedAway += Math.min(d.weight, totalWeight)
    }
  }
  return Math.min(delegatedAway, totalWeight)
}

export function resolveDelegation(
  memberId: string,
  daoId: string,
  snapshot: MembershipSnapshot,
  delegations: Delegation[],
  options?: {
    maxDepth?: number
    proposalId?: string
  },
): DelegationResolution {
  const maxDepth = options?.maxDepth ?? 5
  const activeDelegations = getActiveDelegations(delegations, daoId)

  const visited = new Set<string>()
  const chain: string[] = []
  let weight = getMemberWeight(snapshot, memberId)
  let current = memberId
  let depth = 0

  while (depth < maxDepth) {
    if (visited.has(current)) break
    visited.add(current)

    const outDelegations = activeDelegations
      .filter((d) => d.delegator === current)
      .filter((d) => {
        if (options?.proposalId && d.scope && d.scope !== 'all' && d.scope !== options.proposalId) {
          return false
        }
        return true
      })

    if (outDelegations.length === 0) break

    const primary = outDelegations[0]
    chain.push(current)
    current = primary.delegate
    depth++

    if (depth >= maxDepth) break
  }

  return { finalVoter: current, weight, chain, depth }
}

export function resolveVotingPower(
  memberId: string,
  daoId: string,
  snapshot: MembershipSnapshot,
  delegations: Delegation[],
  options?: {
    maxDepth?: number
    proposalId?: string
    processedDelegators?: Set<string>
  },
): {
  directWeight: number
  delegatedFrom: Array<{ memberId: string; weight: number; chain: string[] }>
  totalWeight: number
} {
  const maxDepth = options?.maxDepth ?? 5
  const proposalId = options?.proposalId
  const activeDelegations = getActiveDelegations(delegations, daoId)

  const directWeight = getMemberWeight(snapshot, memberId)

  const inboundDelegations = activeDelegations.filter((d) => d.delegate === memberId)
  const delegatedFrom: Array<{ memberId: string; weight: number; chain: string[] }> = []

  for (const del of inboundDelegations) {
    const delWeight = getMemberWeight(snapshot, del.delegator)
    if (delWeight <= 0) continue

    const delegatorDirectVotes: Delegation[] = [] // would need a vote lookup — here we just delegate
    const effectiveWeight = del.weight > 0 ? Math.min(del.weight, delWeight) : delWeight

    const res = resolveDelegationChain(del.delegator, daoId, snapshot, activeDelegations, {
      maxDepth,
      proposalId,
      stopAt: memberId,
    })

    const finalDelegate = res.chain.length > 0 ? res.chain[res.chain.length - 1] : del.delegator
    if (finalDelegate !== memberId) continue

    delegatedFrom.push({
      memberId: del.delegator,
      weight: effectiveWeight,
      chain: res.chain,
    })
  }

  const totalDelegatedIn = delegatedFrom.reduce((sum, d) => sum + d.weight, 0)
  const totalWeight = directWeight + totalDelegatedIn

  return { directWeight, delegatedFrom, totalWeight }
}

function resolveDelegationChain(
  start: string,
  daoId: string,
  snapshot: MembershipSnapshot,
  activeDelegations: Delegation[],
  options: { maxDepth: number; proposalId?: string; stopAt?: string },
): { chain: string[]; finalDelegate: string } {
  const visited = new Set<string>()
  const chain: string[] = []
  let current = start
  let depth = 0

  while (depth < options.maxDepth) {
    if (visited.has(current)) break
    visited.add(current)

    if (options.stopAt && current === options.stopAt) break

    const outDelegations = activeDelegations
      .filter((d) => d.delegator === current)
      .filter((d) => {
        if (options.proposalId && d.scope && d.scope !== 'all' && d.scope !== options.proposalId) {
          return false
        }
        return true
      })

    if (outDelegations.length === 0) break

    const primary = outDelegations[0]
    chain.push(primary.delegate)
    current = primary.delegate
    depth++
  }

  return { chain, finalDelegate: current }
}

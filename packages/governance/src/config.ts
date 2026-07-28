import type { GovernanceConfig, QuadraticConfig, DelegationConfig, VotingConfig } from './types.js'

export function createGovernanceConfig(params: {
  daoId: string
  name: string
  voting: {
    algorithm: 'linear' | 'quadratic' | 'liquid'
    quorumBps: number
    passThresholdBps: number
    votingPeriodMs: number
    delayBeforeVotingMs?: number
    executionDelayMs?: number
    allowAbstain?: boolean
    quadratic?: QuadraticConfig
    delegation?: DelegationConfig
  }
  membership: {
    defaultWeight?: number
    minWeightToPropose?: number
  }
  authorityScope: string
  authorityResolver: string
}): GovernanceConfig {
  const config: GovernanceConfig = {
    daoId: params.daoId,
    name: params.name,
    voting: {
      algorithm: params.voting.algorithm,
      quorumBps: params.voting.quorumBps,
      passThresholdBps: params.voting.passThresholdBps,
      votingPeriodMs: params.voting.votingPeriodMs,
      delayBeforeVotingMs: params.voting.delayBeforeVotingMs ?? 0,
      executionDelayMs: params.voting.executionDelayMs ?? 0,
      allowAbstain: params.voting.allowAbstain ?? true,
    },
    membership: {
      defaultWeight: params.membership.defaultWeight ?? 1,
      minWeightToPropose: params.membership.minWeightToPropose ?? 1,
    },
    authorityScope: params.authorityScope,
    authorityResolver: params.authorityResolver,
  }

  if (params.voting.quadratic !== undefined) {
    config.voting.quadratic = { ...params.voting.quadratic }
  }
  if (params.voting.delegation !== undefined) {
    config.voting.delegation = { ...params.voting.delegation }
  }

  return config
}

export function validateGovernanceConfig(config: GovernanceConfig): string[] {
  const errors: string[] = []

  if (!config.daoId) errors.push('daoId is required')
  if (!config.name) errors.push('name is required')

  if (config.voting.quorumBps < 0 || config.voting.quorumBps > 10000) {
    errors.push('quorumBps must be between 0 and 10000')
  }
  if (config.voting.passThresholdBps < 0 || config.voting.passThresholdBps > 10000) {
    errors.push('passThresholdBps must be between 0 and 10000')
  }
  if (config.voting.votingPeriodMs <= 0) {
    errors.push('votingPeriodMs must be positive')
  }
  if (config.voting.delayBeforeVotingMs < 0) {
    errors.push('delayBeforeVotingMs must be non-negative')
  }
  if (config.voting.executionDelayMs < 0) {
    errors.push('executionDelayMs must be non-negative')
  }

  if (config.voting.algorithm === 'quadratic') {
    if (!config.voting.quadratic) {
      errors.push('quadratic config required when algorithm is quadratic')
    } else if (config.voting.quadratic.creditSource === 'fixed') {
      if (!config.voting.quadratic.maxCreditsPerMember || config.voting.quadratic.maxCreditsPerMember <= 0) {
        errors.push('maxCreditsPerMember required and must be positive for fixed credit source')
      }
    }
  }

  if (config.voting.algorithm === 'liquid') {
    if (!config.voting.delegation) {
      errors.push('delegation config required when algorithm is liquid')
    } else {
      if (config.voting.delegation.maxChainDepth < 1) {
        errors.push('maxChainDepth must be at least 1')
      }
      if (config.voting.delegation.allowRecall && config.voting.delegation.recallThresholdBps !== undefined) {
        if (config.voting.delegation.recallThresholdBps < 0 || config.voting.delegation.recallThresholdBps > 10000) {
          errors.push('recallThresholdBps must be between 0 and 10000')
        }
      }
    }
  }

  if (config.membership.defaultWeight < 1) {
    errors.push('defaultWeight must be at least 1')
  }
  if (config.membership.minWeightToPropose < 1) {
    errors.push('minWeightToPropose must be at least 1')
  }

  if (!config.authorityScope) errors.push('authorityScope is required')
  if (!config.authorityResolver) errors.push('authorityResolver is required')

  return errors
}

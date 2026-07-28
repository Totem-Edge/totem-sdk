[**@totemsdk/governance**](../index.md)

***

[@totemsdk/governance](../index.md) / createGovernanceConfig

# Function: createGovernanceConfig()

> **createGovernanceConfig**(`params`): [`GovernanceConfig`](../interfaces/GovernanceConfig.md)

## Parameters

### params

#### authorityResolver

`string`

#### authorityScope

`string`

#### daoId

`string`

#### membership

\{ `defaultWeight?`: `number`; `minWeightToPropose?`: `number`; \}

#### membership.defaultWeight?

`number`

#### membership.minWeightToPropose?

`number`

#### name

`string`

#### voting

\{ `algorithm`: `"linear"` \| `"quadratic"` \| `"liquid"`; `allowAbstain?`: `boolean`; `delayBeforeVotingMs?`: `number`; `delegation?`: [`DelegationConfig`](../interfaces/DelegationConfig.md); `executionDelayMs?`: `number`; `passThresholdBps`: `number`; `quadratic?`: [`QuadraticConfig`](../interfaces/QuadraticConfig.md); `quorumBps`: `number`; `votingPeriodMs`: `number`; \}

#### voting.algorithm

`"linear"` \| `"quadratic"` \| `"liquid"`

#### voting.allowAbstain?

`boolean`

#### voting.delayBeforeVotingMs?

`number`

#### voting.delegation?

[`DelegationConfig`](../interfaces/DelegationConfig.md)

#### voting.executionDelayMs?

`number`

#### voting.passThresholdBps

`number`

#### voting.quadratic?

[`QuadraticConfig`](../interfaces/QuadraticConfig.md)

#### voting.quorumBps

`number`

#### voting.votingPeriodMs

`number`

## Returns

[`GovernanceConfig`](../interfaces/GovernanceConfig.md)

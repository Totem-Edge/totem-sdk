[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / checkRunLimits

# Function: checkRunLimits()

> **checkRunLimits**(`profile`, `action`, `state`): [`BoundaryFailure`](../interfaces/BoundaryFailure.md) \| `undefined`

Evaluate run limits for a prepared action's verified effects. All ceilings
are per-profile; a broader mandate is never needed.

## Parameters

### profile

[`AutonomyProfile`](../interfaces/AutonomyProfile.md)

### action

[`CanonicalAgentAction`](../interfaces/CanonicalAgentAction.md)

### state

#### abortedSteps

`number`

#### committedSteps

`number`

#### feesByToken

`Record`\<`string`, `string`\>

#### now

`number`

#### outstandingByToken

`Record`\<`string`, `string`\>

#### reservedSteps

`number`

#### spentByToken

`Record`\<`string`, `string`\>

#### startedAt

`number`

#### stepSpendByToken

`Record`\<`string`, `string`\>

## Returns

[`BoundaryFailure`](../interfaces/BoundaryFailure.md) \| `undefined`

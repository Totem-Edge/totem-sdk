[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AutonomyProfile

# Interface: AutonomyProfile

## Properties

### boundaryFailure?

> `optional` **boundaryFailure?**: `"request_narrow_grant"` \| `"reject"`

***

### grantRequirements?

> `optional` **grantRequirements?**: `Record`\<`string`, [`GrantRequirement`](GrantRequirement.md)\>

grant-set composition, keyed by action string.

***

### mode

> **mode**: [`AutonomyMode`](../type-aliases/AutonomyMode.md)

***

### obligations?

> `optional` **obligations?**: [`RunObligations`](RunObligations.md)

***

### profileId

> **profileId**: `string`

***

### runLimits

> **runLimits**: [`RunLimits`](RunLimits.md)

***

### transitions?

> `optional` **transitions?**: [`StepTransitionRule`](StepTransitionRule.md)[]

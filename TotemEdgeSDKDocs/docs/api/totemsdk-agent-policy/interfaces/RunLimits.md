[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RunLimits

# Interface: RunLimits

## Properties

### maxDurationMs?

> `optional` **maxDurationMs?**: `number`

***

### maxFailures?

> `optional` **maxFailures?**: `number`

***

### maxFees?

> `optional` **maxFees?**: `object`

Aggregate fee ceiling per run.

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

***

### maxGrossSpend?

> `optional` **maxGrossSpend?**: `object`

Gross spend per run. `amount` is the ceiling in the token's native unit.

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

***

### maxOutstandingChannelExposure?

> `optional` **maxOutstandingChannelExposure?**: `object`

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

***

### maxParallel?

> `optional` **maxParallel?**: `number`

***

### maxSteps?

> `optional` **maxSteps?**: `number`

***

### maxStepSpend?

> `optional` **maxStepSpend?**: `object`

Cap on gross spend across a single step.

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

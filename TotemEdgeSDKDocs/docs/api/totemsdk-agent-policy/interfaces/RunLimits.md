[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RunLimits

# Interface: RunLimits

## Properties

### compute?

> `optional` **compute?**: [`ComputeLimits`](ComputeLimits.md)

RFC-077 §8 compute ceilings.

***

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

***

### physical?

> `optional` **physical?**: `object`

RFC-023 physical ceilings (per step / per run).

#### allowedEnvelopes?

> `optional` **allowedEnvelopes?**: `string`[]

#### maxDurationSeconds?

> `optional` **maxDurationSeconds?**: `object`

##### maxDurationSeconds.seconds

> **seconds**: `string`

#### maxEnergy?

> `optional` **maxEnergy?**: `object`

##### maxEnergy.wattHours

> **wattHours**: `string`

#### maxSpeed?

> `optional` **maxSpeed?**: `object`

##### maxSpeed.metresPerSecond

> **metresPerSecond**: `string`

#### maxStepPower?

> `optional` **maxStepPower?**: `object`

##### maxStepPower.watts

> **watts**: `string`

[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / PreparedRebalanceOperation

# Interface: PreparedRebalanceOperation

## Properties

### channelOps

> **channelOps**: `object`[]

The channel operation the rebalance performs.

#### channelId

> **channelId**: `string`

#### operation

> **operation**: `string`

***

### executionReceipt?

> `optional` **executionReceipt?**: `unknown`

***

### fees

> **fees**: `object`[]

#### amount

> **amount**: `string`

#### tokenId

> **tokenId**: `string`

***

### fromAllocationId

> **fromAllocationId**: `string`

***

### poolId

> **poolId**: `string`

***

### positionId

> **positionId**: `string`

***

### postconditionsVerified?

> `optional` **postconditionsVerified?**: `boolean`

***

### quoteTimestamp?

> `optional` **quoteTimestamp?**: `number`

***

### simulation?

> `optional` **simulation?**: `unknown`

Quote/simulation evidence captured by the wallet.

***

### spends

> **spends**: `object`[]

Prepared by the wallet from the actual tx build/simulation.

#### amount

> **amount**: `string`

#### recipient

> **recipient**: `string`

#### tokenId

> **tokenId**: `string`

***

### toChannelId

> **toChannelId**: `string`

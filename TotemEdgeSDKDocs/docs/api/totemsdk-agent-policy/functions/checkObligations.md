[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / checkObligations

# Function: checkObligations()

> **checkObligations**(`obligations`, `action`, `evidence`, `now`): `object`

Validate obligations for a step (quoting freshness, simulation, execution, postconditions).

## Parameters

### obligations

[`RunObligations`](../interfaces/RunObligations.md) \| `undefined`

### action

[`CanonicalAgentAction`](../interfaces/CanonicalAgentAction.md)

### evidence

#### executionReceipt?

`unknown`

#### postconditionsVerified?

`boolean`

#### quoteTimestamp?

`number`

#### simulation?

`unknown`

### now

`number`

## Returns

`object`

### ok

> **ok**: `boolean`

### reason?

> `optional` **reason?**: `string`

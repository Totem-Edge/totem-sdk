[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / factoryCheckpointStateVariables

# Function: factoryCheckpointStateVariables()

> **factoryCheckpointStateVariables**(`params`): `StateValue`[]

Build the state variables the successor factory coin must carry. Exported so
a verifier can recompute the commitment from a candidate transition.

## Parameters

### params

#### allocations

`Record`\<`string`, `bigint`\>

#### escapeBlock

`number` \| `bigint`

#### participants

[`FactoryParticipant`](../interfaces/FactoryParticipant.md)[]

#### sequence

`number` \| `bigint`

#### tokenId

`string`

#### totalValue

`bigint`

## Returns

`StateValue`[]

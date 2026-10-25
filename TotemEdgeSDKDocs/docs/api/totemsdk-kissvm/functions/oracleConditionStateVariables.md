[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / oracleConditionStateVariables

# Function: oracleConditionStateVariables()

> **oracleConditionStateVariables**(`commitment`, `ports?`): [`OracleStateVariable`](../interfaces/OracleStateVariable.md)[]

Commit an oracle observation to state at funding. The witness reads these back
via `PREVSTATE`; the feed commitment is pinned with `SAMESTATE` so it cannot be
swapped by a spender.

## Parameters

### commitment

[`OracleCommitment`](../interfaces/OracleCommitment.md)

### ports?

#### feedPort?

`number`

#### observedAtPort?

`number`

#### validUntilPort?

`number`

#### valuePort?

`number`

## Returns

[`OracleStateVariable`](../interfaces/OracleStateVariable.md)[]

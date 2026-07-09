[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / validateStateTransition

# Function: validateStateTransition()

> **validateStateTransition**(`channel`, `newSequence`, `newBalances`, `pendingHTLCDelta`): `void`

Validates a proposed state transition without requiring signing indices.
Checks: sequence monotonicity, balance conservation.
Double-sign detection is handled at the updateState level using pendingProposal.

## Parameters

### channel

[`OmniaChannel`](../interfaces/OmniaChannel.md)

### newSequence

`number`

### newBalances

`Record`\<`string`, `bigint`\>

### pendingHTLCDelta

`bigint`

## Returns

`void`

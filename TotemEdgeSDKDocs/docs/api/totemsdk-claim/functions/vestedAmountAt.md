[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / vestedAmountAt

# Function: vestedAmountAt()

> **vestedAmountAt**(`policy`, `block`, `totalAmount?`): `bigint` \| `undefined`

The maximum amount claimable at `block`, or `undefined` when the schedule is
invalid or the total is unknown.

## Parameters

### policy

[`VestingPolicyShape`](../interfaces/VestingPolicyShape.md)

### block

`number`

### totalAmount?

`bigint`

## Returns

`bigint` \| `undefined`

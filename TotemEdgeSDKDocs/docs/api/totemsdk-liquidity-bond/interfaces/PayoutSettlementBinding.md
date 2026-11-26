[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / PayoutSettlementBinding

# Interface: PayoutSettlementBinding

The exact payout a piece of settlement evidence must be bound to. A
settlement that does not match all of these is rejected before any
accounting is mutated.

## Properties

### amount

> **amount**: `string`

Payout amount in atoms, as an integer string (tolerates JSON transport).
This is an internal evidence binding derived by the host from the stored
withdrawal intent; callers never supply it. RPC amount fields use decimal
MINIMA text.

***

### poolId

> **poolId**: `string`

***

### positionId

> **positionId**: `string`

***

### recipientAddress

> **recipientAddress**: `string`

Destination address of the payout.

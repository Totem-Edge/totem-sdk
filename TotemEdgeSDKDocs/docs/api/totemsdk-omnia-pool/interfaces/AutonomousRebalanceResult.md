[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / AutonomousRebalanceResult

# Interface: AutonomousRebalanceResult

## Properties

### allocation?

> `optional` **allocation?**: `object`

The executed pool allocation mutation.

#### newAllocation

> **newAllocation**: `LiquidityAllocation`

#### position

> **position**: `LiquidityPosition`

#### registry

> **registry**: `LiquidityBondRegistryState`

#### released

> **released**: `LiquidityAllocation`

***

### authorization?

> `optional` **authorization?**: `RunAuthorization`

***

### canonical?

> `optional` **canonical?**: `CanonicalAgentAction`

The canonical action that was authorized (for the receipt graph).

***

### channelUpdate?

> `optional` **channelUpdate?**: [`RebalanceChannelUpdate`](RebalanceChannelUpdate.md)

The executed channel update (when the step performed one).

***

### outcome

> **outcome**: `"approved"` \| `"requires_human"` \| `"rejected"`

***

### rejection?

> `optional` **rejection?**: `RunAuthorizationRejected`

***

### txDigest?

> `optional` **txDigest?**: `string`

The tx digest the execution proof is bound to.

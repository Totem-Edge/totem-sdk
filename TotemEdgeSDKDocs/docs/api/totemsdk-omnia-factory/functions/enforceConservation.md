[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / enforceConservation

# Function: enforceConservation()

> **enforceConservation**(`factory`): `void`

Enforce the factory's balance conservation invariant:
  sum(allocations) + sum(virtualChannel.totalValue) === totalValue

Throws on violation. Called after every committed state transition.

## Parameters

### factory

[`ChannelFactory`](../interfaces/ChannelFactory.md)

## Returns

`void`

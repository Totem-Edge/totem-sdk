[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / assertFactoryCheckpointTransition

# Function: assertFactoryCheckpointTransition()

> **assertFactoryCheckpointTransition**(`before`, `after`): `void`

Validate a candidate checkpoint against the state it replaces. This is the
rule the covenant enforces on chain; running it here lets the SDK refuse to
build a transition the node would reject.

## Parameters

### before

[`FactoryCheckpointSnapshot`](../interfaces/FactoryCheckpointSnapshot.md)

### after

[`FactoryCheckpointSnapshot`](../interfaces/FactoryCheckpointSnapshot.md)

## Returns

`void`

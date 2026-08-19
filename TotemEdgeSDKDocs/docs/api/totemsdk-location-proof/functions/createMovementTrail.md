[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / createMovementTrail

# Function: createMovementTrail()

> **createMovementTrail**(`params`): [`MovementTrail`](../interfaces/MovementTrail.md)

Build a MovementTrail from a set of samples.

Samples are sorted by observedAt, and startedAt/endedAt are derived from
the sorted range. maxComputedSpeedMps and impossibleJumpDetected are
computed from the samples. The trailId is content-derived (see
computeMovementTrailId) unless explicitly provided.

## Parameters

### params

[`CreateMovementTrailParams`](../interfaces/CreateMovementTrailParams.md)

## Returns

[`MovementTrail`](../interfaces/MovementTrail.md)

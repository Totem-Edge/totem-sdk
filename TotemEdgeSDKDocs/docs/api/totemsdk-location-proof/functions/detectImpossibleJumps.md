[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / detectImpossibleJumps

# Function: detectImpossibleJumps()

> **detectImpossibleJumps**(`samples`, `options?`): [`ImpossibleJumpResult`](../interfaces/ImpossibleJumpResult.md)

Scan consecutive samples for segments faster than the threshold.
maxSpeedMps always reports the maximum observed consecutive-pair speed
regardless of the threshold.

## Parameters

### samples

[`MotionSample`](../interfaces/MotionSample.md)[]

### options?

[`MotionOptions`](../interfaces/MotionOptions.md) = `{}`

## Returns

[`ImpossibleJumpResult`](../interfaces/ImpossibleJumpResult.md)

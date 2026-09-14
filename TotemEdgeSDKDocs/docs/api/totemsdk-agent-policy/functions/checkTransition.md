[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / checkTransition

# Function: checkTransition()

> **checkTransition**(`profile`, `fromAction`, `toAction`): `boolean`

Validate a step transition against the profile's allowed DAG. Returns
whether `toAction` may follow `fromAction` (undefined = start of run).

## Parameters

### profile

[`AutonomyProfile`](../interfaces/AutonomyProfile.md)

### fromAction

`string` \| `undefined`

### toAction

`string`

## Returns

`boolean`

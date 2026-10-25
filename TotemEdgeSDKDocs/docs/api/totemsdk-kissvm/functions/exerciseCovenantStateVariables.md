[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / exerciseCovenantStateVariables

# Function: exerciseCovenantStateVariables()

> **exerciseCovenantStateVariables**(`config`): [`ExerciseCovenantState`](../interfaces/ExerciseCovenantState.md)[]

Committed state variables for a time-bounded exercise covenant: the absolute
maturity and recovery blocks, seeded into the covenant's funding output. Read
back by the script via `PREVSTATE` and pinned with `SAMESTATE` so no spend can
move the exercise clock.

## Parameters

### config

#### maturityBlock

`bigint`

#### maturityPort?

`number`

#### recoveryBlock

`bigint`

#### recoveryPort?

`number`

## Returns

[`ExerciseCovenantState`](../interfaces/ExerciseCovenantState.md)[]

[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildOracleExerciseCovenant

# Function: buildOracleExerciseCovenant()

> **buildOracleExerciseCovenant**(`config`): `string`

Build the composed P-EXIT × OMP-19 covenant: the observation is committed at
funding, and after maturity the beneficiary can exercise **alone** — with only
its own signature — provided the committed observation is fresh and satisfies
the objective value condition. The oracle is not required at exercise time.

## Parameters

### config

[`OracleExerciseCovenantConfig`](../interfaces/OracleExerciseCovenantConfig.md)

## Returns

`string`

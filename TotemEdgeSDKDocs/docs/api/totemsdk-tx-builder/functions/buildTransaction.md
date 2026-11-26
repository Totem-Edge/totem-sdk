[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / buildTransaction

# Function: buildTransaction()

> **buildTransaction**(`params`): [`EnhancedBuildResult`](../interfaces/EnhancedBuildResult.md)

Build a Minima transaction from enhanced inputs/outputs and transaction state.

Amounts are decimal strings (Minima scale handled at serialization time), not
pre-scaled integers.

## Parameters

### params

[`EnhancedBuildParams`](../interfaces/EnhancedBuildParams.md)

## Returns

[`EnhancedBuildResult`](../interfaces/EnhancedBuildResult.md)

[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / fromEnhancedBuildParams

# Function: fromEnhancedBuildParams()

> **fromEnhancedBuildParams**(`params`, `ownAddresses`): [`BuiltTransaction`](../interfaces/BuiltTransaction.md)

Normalize an `EnhancedBuildParams` (@totemsdk/tx-builder) into a
`BuiltTransaction`. Outputs carry the real recipient amounts; inputs carry
the wallet's own addresses (change detection).

## Parameters

### params

#### inputs

`object`[]

#### outputs

`object`[]

### ownAddresses

`string`[]

## Returns

[`BuiltTransaction`](../interfaces/BuiltTransaction.md)

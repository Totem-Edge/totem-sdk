[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / splitVtxo

# Function: splitVtxo()

> **splitVtxo**(`vtxo`, `params`, `now?`): [`SplitResult`](../interfaces/SplitResult.md) & `object`

Splits a VTXO into multiple outputs.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### params

[`SplitVtxoParams`](../interfaces/SplitVtxoParams.md)

### now?

`number`

Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.

## Returns

[`SplitResult`](../interfaces/SplitResult.md) & `object`

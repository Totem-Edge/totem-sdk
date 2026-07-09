[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / refreshVtxo

# Function: refreshVtxo()

> **refreshVtxo**(`vtxo`, `params`, `now?`): [`RefreshResult`](../interfaces/RefreshResult.md) & `object`

Refreshes a VTXO to a new epoch.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### params

[`RefreshVtxoParams`](../interfaces/RefreshVtxoParams.md)

### now?

`number`

Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.

## Returns

[`RefreshResult`](../interfaces/RefreshResult.md) & `object`

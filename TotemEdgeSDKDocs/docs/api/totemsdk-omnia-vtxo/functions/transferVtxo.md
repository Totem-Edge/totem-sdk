[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / transferVtxo

# Function: transferVtxo()

> **transferVtxo**(`vtxo`, `params`, `now?`): [`TransferResult`](../interfaces/TransferResult.md) & `object`

Transfers a VTXO (fully or partially) to a recipient.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### params

[`TransferVtxoParams`](../interfaces/TransferVtxoParams.md)

### now?

`number`

Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.

## Returns

[`TransferResult`](../interfaces/TransferResult.md) & `object`

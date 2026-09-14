[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / consumeExitReceipt

# Function: consumeExitReceipt()

> **consumeExitReceipt**(`vtxo`, `receiptId`, `now?`): [`OmniaVtxo`](../interfaces/OmniaVtxo.md)

Consume a VTXO's exit receipt — the single-spend marker that prevents a
second exit draft for the same VTXO. Returns the updated VTXO.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### receiptId

`string`

### now?

`number`

## Returns

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

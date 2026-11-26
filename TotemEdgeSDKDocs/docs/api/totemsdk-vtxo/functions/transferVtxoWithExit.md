[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / transferVtxoWithExit

# Function: transferVtxoWithExit()

> **transferVtxoWithExit**(`vtxo`, `params`, `exitParams`, `exitDeps`, `now?`): `Promise`\<[`TransferResult`](../interfaces/TransferResult.md) & `object` & `object`\>

V1 transfer: build the *recipient's* independent exit before moving the
claim, then transfer only if the rebuilt entitlement verifies against the
output VTXO (OMN-003).

`exitParams` describes the pool coin and holder share set for the input.
The helper rebinds it to the recipient: the holder at `holderIndex` becomes
the recipient, the exit VTXO becomes the output and the root/epoch become
the output's proof root/epoch. The exit transaction therefore pays the
recipient, not the previous owner.

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### params

`Omit`\<[`TransferVtxoParams`](../interfaces/TransferVtxoParams.md), `"exitEntitlement"`\>

### exitParams

[`ExitTxParams`](../interfaces/ExitTxParams.md)

### exitDeps

[`ExitTxDeps`](../interfaces/ExitTxDeps.md)

### now?

`number`

## Returns

`Promise`\<[`TransferResult`](../interfaces/TransferResult.md) & `object` & `object`\>

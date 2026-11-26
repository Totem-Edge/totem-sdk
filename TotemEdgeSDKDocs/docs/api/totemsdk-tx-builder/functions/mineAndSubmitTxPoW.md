[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / mineAndSubmitTxPoW

# Function: mineAndSubmitTxPoW()

> **mineAndSubmitTxPoW**(`params`, `provider`): `Promise`\<\{ `broadcast`: \{ `message?`: `string`; `success`: `boolean`; `txpowid?`: `string`; \}; `mined`: [`MinedTransaction`](../interfaces/MinedTransaction.md); \}\>

Mine and broadcast in one call.

## Parameters

### params

#### mineOptions?

`MineOptions`

#### minWorkSource?

[`TxPowMinWorkSource`](../interfaces/TxPowMinWorkSource.md) \| `null`

#### target?

`Uint8Array`\<`ArrayBufferLike`\>

#### transaction

`unknown`

#### witness

`Uint8Array`

### provider

[`ChainBroadcastProvider`](../interfaces/ChainBroadcastProvider.md)

## Returns

`Promise`\<\{ `broadcast`: \{ `message?`: `string`; `success`: `boolean`; `txpowid?`: `string`; \}; `mined`: [`MinedTransaction`](../interfaces/MinedTransaction.md); \}\>

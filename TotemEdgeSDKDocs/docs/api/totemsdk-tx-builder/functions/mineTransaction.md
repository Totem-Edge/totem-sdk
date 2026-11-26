[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / mineTransaction

# Function: mineTransaction()

> **mineTransaction**(`params`): `Promise`\<[`MinedTransaction`](../interfaces/MinedTransaction.md)\>

Serialize and mine a signed transaction into a TxPoW envelope.

The caller supplies the transaction (or its serialized bytes) and witness.
The target defaults to the node's live `currentmintxpowwork` when a source is
provided, otherwise the protocol floor.

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

## Returns

`Promise`\<[`MinedTransaction`](../interfaces/MinedTransaction.md)\>

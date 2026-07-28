[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / MinimaL1PaymentPortConfig

# Interface: MinimaL1PaymentPortConfig

## Properties

### provider

> **provider**: `ChainStateProvider`

ChainStateProvider used to broadcast the signed TxPoW.

## Methods

### sign()

> **sign**(`params`): `Promise`\<`string`\>

Injected signing function. Receives the payment intent and returns a
fully mined TxPoW hex string ready for broadcast.

This keeps the adapter agnostic to key management — callers wire in their
own signer (e.g. @totemsdk/server's sendTransaction, a hardware wallet
bridge, or a pureminima-rpc command sequence).

#### Parameters

##### params

###### amount

`string`

###### memo?

`string`

###### toAddress

`string`

###### tokenId

`string`

#### Returns

`Promise`\<`string`\>

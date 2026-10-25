[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / OmniaVtxoOperator

# Interface: OmniaVtxoOperator

## Extended by

- [`VtxoOperatorWithIdentity`](VtxoOperatorWithIdentity.md)

## Properties

### poolId

> **poolId**: `string`

## Methods

### sign()

> **sign**(`data`): `Promise`\<`string`\>

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`string`\>

***

### verify()

> **verify**(`data`, `sig`): `Promise`\<`boolean`\>

#### Parameters

##### data

`Uint8Array`

##### sig

`string`

#### Returns

`Promise`\<`boolean`\>

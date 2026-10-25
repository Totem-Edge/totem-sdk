[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / VtxoOperatorWithIdentity

# Interface: VtxoOperatorWithIdentity

## Extends

- [`OmniaVtxoOperator`](OmniaVtxoOperator.md)

## Properties

### poolId

> **poolId**: `string`

#### Inherited from

[`OmniaVtxoOperator`](OmniaVtxoOperator.md).[`poolId`](OmniaVtxoOperator.md#poolid)

***

### publicKey

> `readonly` **publicKey**: `string`

The operator's tree-root public key (its identity).

## Methods

### sign()

> **sign**(`data`): `Promise`\<`string`\>

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`string`\>

#### Inherited from

[`OmniaVtxoOperator`](OmniaVtxoOperator.md).[`sign`](OmniaVtxoOperator.md#sign)

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

#### Inherited from

[`OmniaVtxoOperator`](OmniaVtxoOperator.md).[`verify`](OmniaVtxoOperator.md#verify)

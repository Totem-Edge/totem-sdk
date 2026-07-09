[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / NodeCryptoAdapter

# Class: NodeCryptoAdapter

## Implements

- [`CryptoAdapter`](../interfaces/CryptoAdapter.md)

## Constructors

### Constructor

> **new NodeCryptoAdapter**(): `NodeCryptoAdapter`

#### Returns

`NodeCryptoAdapter`

## Methods

### randomBytes()

> **randomBytes**(`length`): `Uint8Array`

#### Parameters

##### length

`number`

#### Returns

`Uint8Array`

#### Implementation of

[`CryptoAdapter`](../interfaces/CryptoAdapter.md).[`randomBytes`](../interfaces/CryptoAdapter.md#randombytes)

***

### sha256()

> **sha256**(`data`): `Uint8Array`

#### Parameters

##### data

`Uint8Array`

#### Returns

`Uint8Array`

#### Implementation of

[`CryptoAdapter`](../interfaces/CryptoAdapter.md).[`sha256`](../interfaces/CryptoAdapter.md#sha256)

***

### sha256Async()

> **sha256Async**(`data`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`CryptoAdapter`](../interfaces/CryptoAdapter.md).[`sha256Async`](../interfaces/CryptoAdapter.md#sha256async)

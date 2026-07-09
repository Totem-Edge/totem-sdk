[**@totem/sdk-browser**](../index.md)

***

[@totem/sdk-browser](../index.md) / BrowserCryptoAdapter

# Class: BrowserCryptoAdapter

## Implements

- `CryptoAdapter`

## Constructors

### Constructor

> **new BrowserCryptoAdapter**(): `BrowserCryptoAdapter`

#### Returns

`BrowserCryptoAdapter`

## Methods

### randomBytes()

> **randomBytes**(`length`): `Uint8Array`

#### Parameters

##### length

`number`

#### Returns

`Uint8Array`

#### Implementation of

`CryptoAdapter.randomBytes`

***

### sha256()

> **sha256**(`data`): `Uint8Array`

#### Parameters

##### data

`Uint8Array`

#### Returns

`Uint8Array`

#### Implementation of

`CryptoAdapter.sha256`

***

### sha256Async()

> **sha256Async**(`data`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### data

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

`CryptoAdapter.sha256Async`

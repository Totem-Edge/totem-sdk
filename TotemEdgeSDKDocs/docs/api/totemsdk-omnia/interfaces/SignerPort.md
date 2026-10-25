[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / SignerPort

# Interface: SignerPort

## Properties

### publicKeyDigest

> `readonly` **publicKeyDigest**: `string`

## Methods

### sign()

> **sign**(`request`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the domain-separated payload (see `signRequestPayload`).

#### Parameters

##### request

[`SignRequest`](SignRequest.md)

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

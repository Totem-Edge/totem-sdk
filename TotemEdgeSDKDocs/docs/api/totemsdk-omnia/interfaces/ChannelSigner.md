[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / ChannelSigner

# Interface: ChannelSigner

## Properties

### publicKeyDigest

> **publicKeyDigest**: `string`

## Methods

### sign()

> **sign**(`payload`, `indices`): `Promise`\<[`ChannelSignature`](../type-aliases/ChannelSignature.md)\>

Returns flat WOTS signature bytes (output of wotsSign).

#### Parameters

##### payload

`Uint8Array`

##### indices

`SigningIndices`

#### Returns

`Promise`\<[`ChannelSignature`](../type-aliases/ChannelSignature.md)\>

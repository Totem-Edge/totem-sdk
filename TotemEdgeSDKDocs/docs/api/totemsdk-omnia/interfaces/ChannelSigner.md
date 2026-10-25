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

Returns the WOTS signature over `payload` for the given indices (RFC-037:
 serialized hierarchical TreeSignature).

#### Parameters

##### payload

`Uint8Array`

##### indices

`SigningIndices`

#### Returns

`Promise`\<[`ChannelSignature`](../type-aliases/ChannelSignature.md)\>

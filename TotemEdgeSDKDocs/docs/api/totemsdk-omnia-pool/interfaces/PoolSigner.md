[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / PoolSigner

# Interface: PoolSigner

Signer aligned with `@totemsdk/omnia` `ChannelSigner`: lease-backed WOTS with
signing indices — `sign(digest)` alone is too thin for Omnia. A `PoolSigner`
is structurally a `ChannelSigner` (plus an optional convenience reader).

## Extends

- `ChannelSigner`

## Properties

### publicKeyDigest

> **publicKeyDigest**: `string`

#### Inherited from

`ChannelSigner.publicKeyDigest`

## Methods

### getPublicKey()?

> `optional` **getPublicKey**(): `Promise`\<`string`\>

#### Returns

`Promise`\<`string`\>

***

### sign()

> **sign**(`payload`, `indices`): `Promise`\<`ChannelSignature`\>

Returns flat WOTS signature bytes (output of wotsSign).

#### Parameters

##### payload

`Uint8Array`

##### indices

`SigningIndices`

#### Returns

`Promise`\<`ChannelSignature`\>

#### Inherited from

`ChannelSigner.sign`

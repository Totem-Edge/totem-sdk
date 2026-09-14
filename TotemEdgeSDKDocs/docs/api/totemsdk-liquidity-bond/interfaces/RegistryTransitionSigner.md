[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistryTransitionSigner

# Interface: RegistryTransitionSigner

Signer used to authorize registry transitions. Aligned with Omnia's
`ChannelSigner` (#31): `sign(payload, indices)` so WOTS key-indices are bound
at signing time and a single leased key is never reused across records.

## Properties

### publicKeyDigest

> **publicKeyDigest**: `string`

## Methods

### sign()

> **sign**(`payload`, `indices`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### payload

`Uint8Array`

##### indices

`SigningIndices`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

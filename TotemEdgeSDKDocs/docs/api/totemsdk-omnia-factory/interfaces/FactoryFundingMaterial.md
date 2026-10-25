[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / FactoryFundingMaterial

# Interface: FactoryFundingMaterial

On-chain funding material for one factory participant. Required by
`createFactory` when the on-chain funding path is used (every participant
supplies a `fundingCoinId` and a `chainProvider` is given).

## Properties

### coinAddress?

> `optional` **coinAddress?**: `string`

Address of the funding coin (must match the coin in `coinProof`).

***

### coinProof

> **coinProof**: `Uint8Array`

Serialized Minima CoinProof for this party's funding coin (coinexport `data`).

***

### partyId

> **partyId**: `string`

***

### script?

> `optional` **script?**: `string`

Funding coin script; used to build its ScriptProof when `scriptProof` is absent.

***

### scriptProof?

> `optional` **scriptProof?**: `Uint8Array`\<`ArrayBufferLike`\>

Pre-built serialized ScriptProof for the funding coin's address.

***

### signature?

> `optional` **signature?**: `Uint8Array`\<`ArrayBufferLike`\>

Or a pre-computed serialized Signature over the funding digest.

***

### signer?

> `optional` **signer?**: (`digest`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the funding TX digest with the funding coin's wallet key.

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

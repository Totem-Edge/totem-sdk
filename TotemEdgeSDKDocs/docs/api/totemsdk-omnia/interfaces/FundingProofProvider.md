[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / FundingProofProvider

# Interface: FundingProofProvider

## Methods

### getCoinProof()

> **getCoinProof**(`coinId`, `leaseToken?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Serialized Minima CoinProof bytes for the funding input. `leaseToken` is
supplied when the wallet leases the funding slot from a remote lease
service (for example Axia `/v1/wots-hardened/coinproofs`).

#### Parameters

##### coinId

`string`

##### leaseToken?

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### getFundingScript()

> **getFundingScript**(`coinId`): `Promise`\<`string`\>

KISSVM script whose hash is the funding coin's address.

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`string`\>

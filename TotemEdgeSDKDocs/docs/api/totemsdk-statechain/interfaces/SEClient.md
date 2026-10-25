[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / SEClient

# Interface: SEClient

## Methods

### blindSign()

> **blindSign**(`chainId`, `commitmentHex`): `Promise`\<`SESignature`\>

Blind-sign a commitment. Returns the SE signature envelope (RFC-008): a
leased one-time leaf authorized by the SE root's `OwnershipProof`.

#### Parameters

##### chainId

`string`

##### commitmentHex

`string`

#### Returns

`Promise`\<`SESignature`\>

***

### isRevoked()

> **isRevoked**(`ownerPartyId`): `Promise`\<`boolean`\>

#### Parameters

##### ownerPartyId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### registerChain()?

> `optional` **registerChain**(`chainId`, `coinId`, `ownerPublicKeyDigest`, `lockingScript`, `details?`): `Promise`\<`void`\>

Optional: register a newly locked coin with the SE.
Called during `createStateChain` when present.

AUD-028: `details` carries the record fields the SE needs to create the
registration (the locked coin is announced after funding). Implementations
that talk to a real SE server should send them; the HTTP client requires
them and fails closed otherwise.

#### Parameters

##### chainId

`string`

##### coinId

`string`

##### ownerPublicKeyDigest

`string`

##### lockingScript

`string`

##### details?

[`RegisterChainDetails`](RegisterChainDetails.md)

#### Returns

`Promise`\<`void`\>

***

### revokeKey()

> **revokeKey**(`chainId`, `opts`): `Promise`\<`void`\>

#### Parameters

##### chainId

`string`

##### opts

###### newOwnerPartyId

`string`

###### newOwnerPkd

`string`

###### newReclaimTxHex

`string`

###### previousOwnerPartyId

`string`

###### previousOwnerPkd

`string`

#### Returns

`Promise`\<`void`\>

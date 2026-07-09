[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / SEClient

# Interface: SEClient

## Methods

### blindSign()

> **blindSign**(`commitmentHex`): `Promise`\<`string`\>

#### Parameters

##### commitmentHex

`string`

#### Returns

`Promise`\<`string`\>

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

> `optional` **registerChain**(`chainId`, `coinId`, `ownerPublicKeyDigest`, `lockingScript`): `Promise`\<`void`\>

Optional: register a newly locked coin with the SE.
Called during `createStateChain` when present.

#### Parameters

##### chainId

`string`

##### coinId

`string`

##### ownerPublicKeyDigest

`string`

##### lockingScript

`string`

#### Returns

`Promise`\<`void`\>

***

### revokeKey()

> **revokeKey**(`ownerPartyId`): `Promise`\<`void`\>

#### Parameters

##### ownerPartyId

`string`

#### Returns

`Promise`\<`void`\>

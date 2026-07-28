[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / HttpSEClient

# Class: HttpSEClient

HTTP implementation of SEClient that talks to any compatible SE server.

`ownerSign(nonce)` must sign sha3_256(nonce) with the current owner's WOTS key.
It is called automatically inside `blindSign` and `revokeKey` after the SE
issues a challenge nonce — callers do not need to manage the challenge protocol.

## Implements

- [`SEClient`](../interfaces/SEClient.md)

## Constructors

### Constructor

> **new HttpSEClient**(`baseUrl`, `ownerSign`, `opts?`): `HttpSEClient`

#### Parameters

##### baseUrl

`string`

##### ownerSign

(`nonce`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### opts?

[`HttpSEClientOptions`](../interfaces/HttpSEClientOptions.md) = `{}`

#### Returns

`HttpSEClient`

## Methods

### blindSign()

> **blindSign**(`chainId`, `blindedCommitmentHex`): `Promise`\<`string`\>

#### Parameters

##### chainId

`string`

##### blindedCommitmentHex

`string`

#### Returns

`Promise`\<`string`\>

#### Implementation of

[`SEClient`](../interfaces/SEClient.md).[`blindSign`](../interfaces/SEClient.md#blindsign)

***

### isRevoked()

> **isRevoked**(`_ownerPartyId`): `Promise`\<`boolean`\>

#### Parameters

##### \_ownerPartyId

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`SEClient`](../interfaces/SEClient.md).[`isRevoked`](../interfaces/SEClient.md#isrevoked)

***

### registerChain()

> **registerChain**(`chainId`, `_coinId`, `_ownerPublicKeyDigest`, `_lockingScript`): `Promise`\<`void`\>

Optional: register a newly locked coin with the SE.
Called during `createStateChain` when present.

#### Parameters

##### chainId

`string`

##### \_coinId

`string`

##### \_ownerPublicKeyDigest

`string`

##### \_lockingScript

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SEClient`](../interfaces/SEClient.md).[`registerChain`](../interfaces/SEClient.md#registerchain)

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

#### Implementation of

[`SEClient`](../interfaces/SEClient.md).[`revokeKey`](../interfaces/SEClient.md#revokekey)

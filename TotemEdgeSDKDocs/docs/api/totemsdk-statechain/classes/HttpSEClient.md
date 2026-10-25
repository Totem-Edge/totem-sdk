[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / HttpSEClient

# Class: HttpSEClient

HTTP implementation of SEClient that talks to any compatible SE server.

`ownerSign(message)` must produce the current owner's serialized Minima
`TreeSignature` over `sha3_256(message)`, where `message` is the canonical
request message (chain + operation + nonce + body). It is called
automatically inside `blindSign` and `revokeKey` after the SE issues a
challenge nonce; the SE verifies it against the owner's root public key.

## Implements

- [`SEClient`](../interfaces/SEClient.md)

## Constructors

### Constructor

> **new HttpSEClient**(`baseUrl`, `ownerSign`, `opts?`): `HttpSEClient`

#### Parameters

##### baseUrl

`string`

##### ownerSign

(`message`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### opts?

[`HttpSEClientOptions`](../interfaces/HttpSEClientOptions.md) = `{}`

#### Returns

`HttpSEClient`

## Methods

### blindSign()

> **blindSign**(`chainId`, `blindedCommitmentHex`): `Promise`\<`SESignature`\>

Blind-sign a commitment. Returns the SE signature envelope (RFC-008): a
leased one-time leaf authorized by the SE root's `OwnershipProof`.

#### Parameters

##### chainId

`string`

##### blindedCommitmentHex

`string`

#### Returns

`Promise`\<`SESignature`\>

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

> **registerChain**(`chainId`, `coinId`, `ownerPublicKeyDigest`, `lockingScript`, `details?`): `Promise`\<`void`\>

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

[`RegisterChainDetails`](../interfaces/RegisterChainDetails.md)

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

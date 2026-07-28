[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / resolveSEClient

# Function: resolveSEClient()

> **resolveSEClient**(`sePublicKeyHex`, `ownerSign`, `opts?`): `Promise`\<[`HttpSEClient`](../classes/HttpSEClient.md)\>

Resolve an HttpSEClient for a given SE public key by looking it up in the
SE Registry. Caches the registry response for 60 seconds.

## Parameters

### sePublicKeyHex

`string`

The SE WOTS public key digest stored in the statechain.

### ownerSign

(`nonce`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Function that signs sha3_256(nonce) with the current owner's WOTS key.

### opts?

[`ResolveSEClientOptions`](../interfaces/ResolveSEClientOptions.md) = `{}`

Optional registry URL, fetch impl, and timeout.

## Returns

`Promise`\<[`HttpSEClient`](../classes/HttpSEClient.md)\>

## Throws

SENotFoundError if no entry matches sePublicKeyHex.

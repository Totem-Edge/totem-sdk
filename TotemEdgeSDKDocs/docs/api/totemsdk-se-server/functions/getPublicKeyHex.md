[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / getPublicKeyHex

# Function: getPublicKeyHex()

> **getPublicKeyHex**(`seed`): `string`

Derives the SE WOTS public key digest from seed.
Fast approximation using sha3_256 — consistent with what axia-api stores
in statechain_records.se_public_key and what clients verify against.

## Parameters

### seed

`Uint8Array`

## Returns

`string`

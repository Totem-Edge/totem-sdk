[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / VerifyFn

# Interface: VerifyFn()

A WOTS verifier: verifies (digest, signature, pkDigest) → boolean.

> **VerifyFn**(`digest`, `signature`, `publicKey`): `boolean` \| `Promise`\<`boolean`\>

A WOTS verifier: verifies (digest, signature, pkDigest) → boolean.

## Parameters

### digest

`Uint8Array`

### signature

`Uint8Array`

### publicKey

`Uint8Array`

## Returns

`boolean` \| `Promise`\<`boolean`\>

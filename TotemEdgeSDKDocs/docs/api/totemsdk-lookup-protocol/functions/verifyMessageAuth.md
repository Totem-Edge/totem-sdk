[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / verifyMessageAuth

# Function: verifyMessageAuth()

> **verifyMessageAuth**(`msg`, `publicKey`, `verify`): `Promise`\<`boolean`\>

Verify the `sig` field of a message against a known public key.
Returns false if `sig` is absent.

## Parameters

### msg

[`LookupMessage`](../type-aliases/LookupMessage.md)

### publicKey

`Uint8Array`

### verify

[`VerifyFn`](../interfaces/VerifyFn.md)

## Returns

`Promise`\<`boolean`\>

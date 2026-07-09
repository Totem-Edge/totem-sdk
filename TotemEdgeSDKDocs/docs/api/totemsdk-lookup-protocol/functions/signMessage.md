[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / signMessage

# Function: signMessage()

> **signMessage**\<`T`\>(`msg`, `sign`): `Promise`\<`T` & `object`\>

Attach a signature to a message.
Returns a new message object with the `sig` field set.

## Type Parameters

### T

`T` *extends* [`LookupMessage`](../type-aliases/LookupMessage.md)

## Parameters

### msg

`T`

### sign

[`SignFn`](../interfaces/SignFn.md)

## Returns

`Promise`\<`T` & `object`\>

[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / verifyMessageAuth

# Function: verifyMessageAuth()

> **verifyMessageAuth**(`msg`, `verify`, `now?`): `Promise`\<`boolean`\>

Verify the `auth` envelope of a message. Returns false when absent, expired,
or the signature does not verify. The caller is responsible for replay
rejection (nonce/index uniqueness) — see lookup-node.

## Parameters

### msg

[`LookupMessage`](../type-aliases/LookupMessage.md)

### verify

[`VerifyFn`](../interfaces/VerifyFn.md)

### now?

`number` = `...`

## Returns

`Promise`\<`boolean`\>

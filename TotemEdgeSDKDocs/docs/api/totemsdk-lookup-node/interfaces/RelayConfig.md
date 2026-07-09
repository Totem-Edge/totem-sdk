[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / RelayConfig

# Interface: RelayConfig

## Properties

### enabled

> **enabled**: `true`

***

### maxDedupSize?

> `optional` **maxDedupSize?**: `number`

Max entries in the relay dedup table before oldest are evicted. Default: 10_000

***

### spamMinBytes?

> `optional` **spamMinBytes?**: `number`

Minimum byte length to accept (spam filter). Default: 100 bytes

***

### verifyWorkFn?

> `optional` **verifyWorkFn?**: (`txpowHex`) => `boolean` \| `Promise`\<`boolean`\>

Optional work verifier override.
When omitted, `verifyTxPoWWork` from `@totemsdk/txpow` is used.

#### Parameters

##### txpowHex

`string`

#### Returns

`boolean` \| `Promise`\<`boolean`\>

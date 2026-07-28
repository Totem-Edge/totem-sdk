[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / SeServerConfig

# Interface: SeServerConfig

## Properties

### betaMode?

> `optional` **betaMode?**: `boolean`

Adds X-Beta headers to all responses. Default true.

***

### databaseUrl

> **databaseUrl**: `string`

Postgres connection string, e.g. postgres://user:pass@host/db

***

### onSign?

> `optional` **onSign?**: (`event`) => `void`

Called after every SE signing event. Lets operators hook in billing,
audit logging, or rate limiting without patching this package.

#### Parameters

##### event

[`SeSignEvent`](SeSignEvent.md)

#### Returns

`void`

***

### port?

> `optional` **port?**: `number`

Port to listen on when using createSeServer().listen(). Default 4000.

***

### reclaimTimelock?

> `optional` **reclaimTimelock?**: `number`

On-chain reclaim timelock in blocks. Default 256.

***

### seSeed

> **seSeed**: `Uint8Array`

32-byte WOTS seed for the SE key.

[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / SeServerConfig

# Interface: SeServerConfig

## Properties

### allowEphemeralStorage?

> `optional` **allowEphemeralStorage?**: `boolean`

Dev/test escape hatch: permit the in-memory SE storage when `seStorage` is
omitted. NEVER enable in production — leaf-use watermarks are lost on
restart. Env: `SE_ALLOW_EPHEMERAL_STORAGE=true`.

***

### betaMode?

> `optional` **betaMode?**: `boolean`

Adds X-Beta headers to all responses. Default false (stable API).

***

### confirmClaim?

> `optional` **confirmClaim?**: (`chainId`, `claimTxHex`, `txpowId`) => `Promise`\<`boolean`\>

AUD-029: confirm a claim transaction on-chain before the statechain is
marked `claimed`. Receives the claim tx body hex and the caller-supplied
txpow id; return true only when the TX is confirmed. When omitted, a
completed claim stays in the `claiming` state and the confirm endpoint
returns 501 (fail-closed).

#### Parameters

##### chainId

`string`

##### claimTxHex

`string`

##### txpowId

`string`

#### Returns

`Promise`\<`boolean`\>

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

***

### seStorage?

> `optional` **seStorage?**: `StorageAdapter`

Durable storage for the SE identity watermark and the one-time WOTS leaf
lease (RFC-008). Required — `createSeRouter` fails closed without it unless
`allowEphemeralStorage` is explicitly set. Losing this store on restart can
re-expose WOTS key indices.

***

### seStoragePath?

> `optional` **seStoragePath?**: `string`

Directory for the durable SE store. When `seStorage` is not supplied and
this is set, `loadConfigFromEnv` builds a `FileStore` here. Env:
`SE_STORAGE_PATH`.

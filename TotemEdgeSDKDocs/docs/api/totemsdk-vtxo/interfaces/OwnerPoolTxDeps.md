[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / OwnerPoolTxDeps

# Interface: OwnerPoolTxDeps

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

***

### coinProofs?

> `optional` **coinProofs?**: `Uint8Array`\<`ArrayBufferLike`\>[]

***

### mine?

> `optional` **mine?**: (`txBody`, `difficulty`) => `Promise`\<\{ `minedHeaderBytes`: `Uint8Array`; `txpowId`: `Uint8Array`; \}\>

#### Parameters

##### txBody

`Uint8Array`

##### difficulty

`Uint8Array`

#### Returns

`Promise`\<\{ `minedHeaderBytes`: `Uint8Array`; `txpowId`: `Uint8Array`; \}\>

***

### scriptProofs?

> `optional` **scriptProofs?**: `Uint8Array`\<`ArrayBufferLike`\>[]

***

### signDigest

> **signDigest**: (`digest`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the transaction digest with the previous (transfer) or current (exit) owner key.

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

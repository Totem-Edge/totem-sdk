[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / ExitTxDeps

# Interface: ExitTxDeps

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

***

### coinProofs?

> `optional` **coinProofs?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized CoinProof(s) for the pool input.

***

### mine?

> `optional` **mine?**: (`txBody`, `difficulty`) => `Promise`\<`MinedTxPow`\>

#### Parameters

##### txBody

`Uint8Array`

##### difficulty

`Uint8Array`

#### Returns

`Promise`\<`MinedTxPow`\>

***

### scriptProofs?

> `optional` **scriptProofs?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized ScriptProof(s) for the pool script.

***

### signDigest

> **signDigest**: (`digest`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

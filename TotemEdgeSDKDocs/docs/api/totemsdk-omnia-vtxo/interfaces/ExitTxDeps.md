[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / ExitTxDeps

# Interface: ExitTxDeps

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

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

### signDigest

> **signDigest**: (`digest`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

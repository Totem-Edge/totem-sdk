[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / BatchAnchorDeps

# Interface: BatchAnchorDeps

## Properties

### chainProvider?

> `optional` **chainProvider?**: `ChainStateProvider`

***

### coinProofs?

> `optional` **coinProofs?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Serialized Minima CoinProof(s) for the pool input.

***

### mine?

> `optional` **mine?**: (`txBody`, `difficulty`) => `Promise`\<`MinedTxPow`\>

PoW miner (defaults to `@totemsdk/txpow`'s mineTxPoW).

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

Serialized Minima ScriptProof(s) for the pool input script.

***

### signatures?

> `optional` **signatures?**: `Uint8Array`\<`ArrayBufferLike`\>[]

Complete N-of-N witness signatures in pool MULTISIG order:
operator first, then holders in `BatchAnchorParams.holders` order.
When supplied, `signDigest` is not called.

***

### signDigest?

> `optional` **signDigest?**: (`digest`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Sign the batch-anchor tx digest (single-signer legacy path).

#### Parameters

##### digest

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

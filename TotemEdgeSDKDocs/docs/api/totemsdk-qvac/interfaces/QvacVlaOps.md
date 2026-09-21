[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacVlaOps

# Interface: QvacVlaOps

## Properties

### vla

> **vla**: `QvacOp`\<[`VlaClientRunParams`](VlaClientRunParams.md), [`VlaClientRunResult`](VlaClientRunResult.md)\>

***

### vlaHparams

> **vlaHparams**: `QvacOp`\<\{ `modelId`: `string`; \}, [`VlaHparamsOpResult`](VlaHparamsOpResult.md)\>

***

### vlaPadState

> **vlaPadState**: (`state`, `targetDim?`) => `Promise`\<`IntelligenceOutcome`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

Real upstream signature: positional, pads a state tensor.

#### Parameters

##### state

`Uint8Array`

##### targetDim?

`number`

#### Returns

`Promise`\<`IntelligenceOutcome`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

***

### vlaPreprocessImage

> **vlaPreprocessImage**: (`pixels`, `width`, `height`, `options?`) => `Promise`\<`IntelligenceOutcome`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

Real upstream signature: positional, returns the preprocessed image.

#### Parameters

##### pixels

`Float32Array`

##### width

`number`

##### height

`number`

##### options?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`IntelligenceOutcome`\<`Uint8Array`\<`ArrayBufferLike`\>\>\>

***

### vlaSetEmbodiment

> **vlaSetEmbodiment**: `QvacOp`\<\{ `embodiment`: [`VlaEmbodimentSelection`](../type-aliases/VlaEmbodimentSelection.md); `modelId`: `string`; \}, \{ `hparams`: [`VlaHparams`](VlaHparams.md); \}\>

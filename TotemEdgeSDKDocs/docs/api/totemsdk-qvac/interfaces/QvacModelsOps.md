[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacModelsOps

# Interface: QvacModelsOps

## Properties

### assessModelFit

> **assessModelFit**: `QvacOp`\<[`AssessModelFitInput`](AssessModelFitInput.md), [`AssessModelFitResult`](AssessModelFitResult.md)\>

***

### deleteCache

> **deleteCache**: `QvacOp`\<[`DeleteCacheParams`](../type-aliases/DeleteCacheParams.md), \{ `success`: `boolean`; \}\>

***

### downloadAsset

> **downloadAsset**: `QvacOp`\<[`DownloadAssetOptions`](DownloadAssetOptions.md), `string`\>

***

### getLoadedModelInfo

> **getLoadedModelInfo**: `QvacOp`\<[`GetLoadedModelInfoParams`](GetLoadedModelInfoParams.md), [`LoadedModelInfo`](LoadedModelInfo.md)\>

***

### getModelInfo

> **getModelInfo**: `QvacOp`\<[`GetModelInfoParams`](GetModelInfoParams.md), [`ModelInfo`](ModelInfo.md)\>

***

### loadModel

> **loadModel**: `QvacOp`\<[`LoadModelOptions`](LoadModelOptions.md), `string`\>

***

### modelRegistryGetModel

> **modelRegistryGetModel**: (`registryPath`, `registrySource`) => `Promise`\<`IntelligenceOutcome`\<[`ModelRegistryEntry`](ModelRegistryEntry.md)\>\>

Real upstream signature: positional `(registryPath, registrySource)`.

#### Parameters

##### registryPath

`string`

##### registrySource

`string`

#### Returns

`Promise`\<`IntelligenceOutcome`\<[`ModelRegistryEntry`](ModelRegistryEntry.md)\>\>

***

### modelRegistryList

> **modelRegistryList**: `QvacOp`\<`Record`\<`string`, `never`\>, [`ModelRegistryEntry`](ModelRegistryEntry.md)[]\>

***

### modelRegistrySearch

> **modelRegistrySearch**: `QvacOp`\<[`ModelRegistrySearchParams`](ModelRegistrySearchParams.md), [`ModelRegistryEntry`](ModelRegistryEntry.md)[]\>

***

### resume

> **resume**: `QvacOp`\<`Record`\<`string`, `never`\>, `void`\>

***

### state

> **state**: `QvacOp`\<`Record`\<`string`, `never`\>, `unknown`\>

***

### suspend

> **suspend**: `QvacOp`\<`Record`\<`string`, `never`\>, `void`\>

***

### unloadModel

> **unloadModel**: `QvacOp`\<\{ `modelId`: `string`; \}, `void`\>

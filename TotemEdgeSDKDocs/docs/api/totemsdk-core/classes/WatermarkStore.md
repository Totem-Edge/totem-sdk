[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / WatermarkStore

# Class: WatermarkStore

## Constructors

### Constructor

> **new WatermarkStore**(`storage`, `logger?`, `config?`): `WatermarkStore`

#### Parameters

##### storage

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### logger?

[`LoggerAdapter`](../interfaces/LoggerAdapter.md) = `...`

##### config?

[`WatermarkStoreConfig`](../interfaces/WatermarkStoreConfig.md) = `{}`

#### Returns

`WatermarkStore`

## Methods

### advanceWatermark()

> **advanceWatermark**(`indices`): `Promise`\<`void`\>

#### Parameters

##### indices

`WotsIndices`

#### Returns

`Promise`\<`void`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### getCurrent()

> **getCurrent**(): [`WatermarkState`](../interfaces/WatermarkState.md) \| `null`

#### Returns

[`WatermarkState`](../interfaces/WatermarkState.md) \| `null`

***

### getNextIndices()

> **getNextIndices**(): `WotsIndices` \| `null`

#### Returns

`WotsIndices` \| `null`

***

### getUsageStats()

> **getUsageStats**(): `object`

#### Returns

`object`

##### percentage

> **percentage**: `number`

##### total

> **total**: `number`

##### used

> **used**: `number`

***

### hasAvailableIndices()

> **hasAvailableIndices**(): `boolean`

#### Returns

`boolean`

***

### initialize()

> **initialize**(): `Promise`\<[`WatermarkState`](../interfaces/WatermarkState.md)\>

#### Returns

`Promise`\<[`WatermarkState`](../interfaces/WatermarkState.md)\>

***

### isExhausted()

> **isExhausted**(): `boolean`

#### Returns

`boolean`

***

### isInitialized()

> **isInitialized**(): `boolean`

#### Returns

`boolean`

***

### load()

> **load**(): `Promise`\<[`WatermarkState`](../interfaces/WatermarkState.md) \| `null`\>

#### Returns

`Promise`\<[`WatermarkState`](../interfaces/WatermarkState.md) \| `null`\>

***

### markUsed()

> **markUsed**(`indices`): `Promise`\<`void`\>

#### Parameters

##### indices

`WotsIndices`

#### Returns

`Promise`\<`void`\>

***

### save()

> **save**(`watermark`): `Promise`\<`void`\>

#### Parameters

##### watermark

[`WatermarkState`](../interfaces/WatermarkState.md)

#### Returns

`Promise`\<`void`\>

***

### updateFromServer()

> **updateFromServer**(`serverWatermark`): `Promise`\<[`SyncResult`](../interfaces/SyncResult.md)\>

#### Parameters

##### serverWatermark

`WotsIndices`

#### Returns

`Promise`\<[`SyncResult`](../interfaces/SyncResult.md)\>

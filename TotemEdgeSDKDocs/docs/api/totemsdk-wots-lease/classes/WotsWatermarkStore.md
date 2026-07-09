[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / WotsWatermarkStore

# Class: WotsWatermarkStore

## Constructors

### Constructor

> **new WotsWatermarkStore**(`storage`, `logger?`): `WotsWatermarkStore`

#### Parameters

##### storage

`StorageAdapter`

##### logger?

`LoggerAdapter` = `...`

#### Returns

`WotsWatermarkStore`

## Methods

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### getLocalWatermark()

> **getLocalWatermark**(`treeId`): [`LocalWatermark`](../interfaces/LocalWatermark.md)

#### Parameters

##### treeId

`string`

#### Returns

[`LocalWatermark`](../interfaces/LocalWatermark.md)

***

### getNextIndices()

> **getNextIndices**(`treeId`): [`SigningIndices`](../interfaces/SigningIndices.md)

#### Parameters

##### treeId

`string`

#### Returns

[`SigningIndices`](../interfaces/SigningIndices.md)

***

### getRawState()

> **getRawState**(): [`WotsWatermarkState`](../interfaces/WotsWatermarkState.md)

#### Returns

[`WotsWatermarkState`](../interfaces/WotsWatermarkState.md)

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### isUnavailable()

> **isUnavailable**(`treeId`, `indices`): `boolean`

#### Parameters

##### treeId

`string`

##### indices

[`SigningIndices`](../interfaces/SigningIndices.md)

#### Returns

`boolean`

***

### markUnavailable()

> **markUnavailable**(`treeId`, `indices`, `reason`): `Promise`\<`void`\>

#### Parameters

##### treeId

`string`

##### indices

[`SigningIndices`](../interfaces/SigningIndices.md)

##### reason

[`UnavailableReason`](../type-aliases/UnavailableReason.md)

#### Returns

`Promise`\<`void`\>

***

### save()

> **save**(`treeId`, `patch`): `Promise`\<`void`\>

#### Parameters

##### treeId

`string`

##### patch

`Partial`\<[`TreeWatermark`](../interfaces/TreeWatermark.md)\>

#### Returns

`Promise`\<`void`\>

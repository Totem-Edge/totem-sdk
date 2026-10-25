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

### exportSeed()

> **exportSeed**(`treeId`): [`WatermarkSeed`](../interfaces/WatermarkSeed.md)

Export a portable seed for a tree (RFC-013 §9). Includes the cursor and the
flat indices already consumed, so it can rebuild the no-reuse state exactly.

#### Parameters

##### treeId

`string`

#### Returns

[`WatermarkSeed`](../interfaces/WatermarkSeed.md)

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

### refresh()

> **refresh**(): `Promise`\<`void`\>

Reload the persisted watermark and merge it monotonically into the local
state. A provider that shares its storage with another provider (AUD-004)
must call this inside its mutation critical section before allocating or
marking, so it observes writes it did not make and never re-issues a slot
another instance already took.

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

***

### seed()

> **seed**(`seed`, `options?`): `Promise`\<`void`\>

Seed the watermark from an exported/operator/on-chain snapshot. Forward-only
by default: a seed behind the current cursor raises
[WatermarkSeedRegressionError](WatermarkSeedRegressionError.md) so a restore can never re-expose used
leaves. The unavailable set is unioned, never shrunk.

#### Parameters

##### seed

[`WatermarkSeed`](../interfaces/WatermarkSeed.md)

##### options?

[`SeedWatermarkOptions`](../interfaces/SeedWatermarkOptions.md) = `{}`

#### Returns

`Promise`\<`void`\>

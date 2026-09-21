[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / DurableLiquidityBondStore

# Interface: DurableLiquidityBondStore

## Methods

### attachAllocation()

> **attachAllocation**(`allocation`): `Promise`\<`void`\>

#### Parameters

##### allocation

[`LiquidityAllocation`](LiquidityAllocation.md)

#### Returns

`Promise`\<`void`\>

***

### attachFeeRecord()

> **attachFeeRecord**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`LiquidityFeeRecord`](LiquidityFeeRecord.md)

#### Returns

`Promise`\<`void`\>

***

### attachReceipt()

> **attachReceipt**(`receipt`): `Promise`\<`void`\>

#### Parameters

##### receipt

[`LiquidityReceipt`](LiquidityReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### attachWithdrawalIntent()

> **attachWithdrawalIntent**(`intent`): `Promise`\<`void`\>

#### Parameters

##### intent

[`WithdrawalIntent`](WithdrawalIntent.md)

#### Returns

`Promise`\<`void`\>

***

### getPool()

> **getPool**(`poolId`): `Promise`\<[`LiquidityPoolManifest`](LiquidityPoolManifest.md) \| `undefined`\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`LiquidityPoolManifest`](LiquidityPoolManifest.md) \| `undefined`\>

***

### getPosition()

> **getPosition**(`positionId`): `Promise`\<[`LiquidityPosition`](LiquidityPosition.md) \| `undefined`\>

#### Parameters

##### positionId

`string`

#### Returns

`Promise`\<[`LiquidityPosition`](LiquidityPosition.md) \| `undefined`\>

***

### getReceipt()

> **getReceipt**(`receiptId`): `Promise`\<[`LiquidityReceipt`](LiquidityReceipt.md) \| `undefined`\>

#### Parameters

##### receiptId

`string`

#### Returns

`Promise`\<[`LiquidityReceipt`](LiquidityReceipt.md) \| `undefined`\>

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current registry transition counter (0 before the first write).

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)\>

#### Returns

`Promise`\<[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True once any registry record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### listActivePositions()

> **listActivePositions**(): `Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

#### Returns

`Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

***

### listPools()

> **listPools**(): `Promise`\<[`LiquidityPoolManifest`](LiquidityPoolManifest.md)[]\>

#### Returns

`Promise`\<[`LiquidityPoolManifest`](LiquidityPoolManifest.md)[]\>

***

### listPositionsByLp()

> **listPositionsByLp**(`lpAddress`): `Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

#### Parameters

##### lpAddress

`string`

#### Returns

`Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

***

### listPositionsByPool()

> **listPositionsByPool**(`poolId`): `Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

***

### listWithdrawablePositions()

> **listWithdrawablePositions**(`now`): `Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

#### Parameters

##### now

`number`

#### Returns

`Promise`\<[`LiquidityPosition`](LiquidityPosition.md)[]\>

***

### registerCommitment()

> **registerCommitment**(`commitment`): `Promise`\<`void`\>

#### Parameters

##### commitment

[`LiquidityCommitment`](LiquidityCommitment.md)

#### Returns

`Promise`\<`void`\>

***

### registerPool()

> **registerPool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`LiquidityPoolManifest`](LiquidityPoolManifest.md)

#### Returns

`Promise`\<`void`\>

***

### registerPosition()

> **registerPosition**(`position`): `Promise`\<`void`\>

#### Parameters

##### position

[`LiquidityPosition`](LiquidityPosition.md)

#### Returns

`Promise`\<`void`\>

***

### updatePool()

> **updatePool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`LiquidityPoolManifest`](LiquidityPoolManifest.md)

#### Returns

`Promise`\<`void`\>

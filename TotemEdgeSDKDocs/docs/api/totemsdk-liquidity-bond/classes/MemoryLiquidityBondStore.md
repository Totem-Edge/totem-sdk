[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / MemoryLiquidityBondStore

# Class: MemoryLiquidityBondStore

## Constructors

### Constructor

> **new MemoryLiquidityBondStore**(): `MemoryLiquidityBondStore`

#### Returns

`MemoryLiquidityBondStore`

## Methods

### attachAllocation()

> **attachAllocation**(`allocation`): `Promise`\<`void`\>

#### Parameters

##### allocation

[`LiquidityAllocation`](../interfaces/LiquidityAllocation.md)

#### Returns

`Promise`\<`void`\>

***

### attachFeeRecord()

> **attachFeeRecord**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`LiquidityFeeRecord`](../interfaces/LiquidityFeeRecord.md)

#### Returns

`Promise`\<`void`\>

***

### attachReceipt()

> **attachReceipt**(`receipt`): `Promise`\<`void`\>

#### Parameters

##### receipt

[`LiquidityReceipt`](../interfaces/LiquidityReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### attachWithdrawalIntent()

> **attachWithdrawalIntent**(`intent`): `Promise`\<`void`\>

#### Parameters

##### intent

[`WithdrawalIntent`](../interfaces/WithdrawalIntent.md)

#### Returns

`Promise`\<`void`\>

***

### getPool()

> **getPool**(`poolId`): `Promise`\<[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md) \| `undefined`\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md) \| `undefined`\>

***

### getPosition()

> **getPosition**(`positionId`): `Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md) \| `undefined`\>

#### Parameters

##### positionId

`string`

#### Returns

`Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md) \| `undefined`\>

***

### getReceipt()

> **getReceipt**(`receiptId`): `Promise`\<[`LiquidityReceipt`](../interfaces/LiquidityReceipt.md) \| `undefined`\>

#### Parameters

##### receiptId

`string`

#### Returns

`Promise`\<[`LiquidityReceipt`](../interfaces/LiquidityReceipt.md) \| `undefined`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)\>

#### Returns

`Promise`\<[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)\>

***

### listActivePositions()

> **listActivePositions**(): `Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

#### Returns

`Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

***

### listPools()

> **listPools**(): `Promise`\<[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md)[]\>

#### Returns

`Promise`\<[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md)[]\>

***

### listPositionsByLp()

> **listPositionsByLp**(`lpAddress`): `Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

#### Parameters

##### lpAddress

`string`

#### Returns

`Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

***

### listPositionsByPool()

> **listPositionsByPool**(`poolId`): `Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

***

### listWithdrawablePositions()

> **listWithdrawablePositions**(`now`): `Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

#### Parameters

##### now

`number`

#### Returns

`Promise`\<[`LiquidityPosition`](../interfaces/LiquidityPosition.md)[]\>

***

### registerCommitment()

> **registerCommitment**(`commitment`): `Promise`\<`void`\>

#### Parameters

##### commitment

[`LiquidityCommitment`](../interfaces/LiquidityCommitment.md)

#### Returns

`Promise`\<`void`\>

***

### registerPool()

> **registerPool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md)

#### Returns

`Promise`\<`void`\>

***

### registerPosition()

> **registerPosition**(`position`): `Promise`\<`void`\>

#### Parameters

##### position

[`LiquidityPosition`](../interfaces/LiquidityPosition.md)

#### Returns

`Promise`\<`void`\>

***

### updatePool()

> **updatePool**(`pool`): `Promise`\<`void`\>

#### Parameters

##### pool

[`LiquidityPoolManifest`](../interfaces/LiquidityPoolManifest.md)

#### Returns

`Promise`\<`void`\>

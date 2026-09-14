[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / GrantBoundAutonomyPolicy

# Class: GrantBoundAutonomyPolicy

## Constructors

### Constructor

> **new GrantBoundAutonomyPolicy**(`options`): `GrantBoundAutonomyPolicy`

#### Parameters

##### options

[`GrantBoundAutonomyOptions`](../interfaces/GrantBoundAutonomyOptions.md)

#### Returns

`GrantBoundAutonomyPolicy`

## Methods

### abort()

> **abort**(`reservationId`, `error`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### error

`unknown`

#### Returns

`Promise`\<`void`\>

***

### authorizeAndReserve()

> **authorizeAndReserve**(`params`): `Promise`\<`AuthorizeAndReserveResult`\>

#### Parameters

##### params

[`AuthorizeAndReserveParams`](../interfaces/AuthorizeAndReserveParams.md)

#### Returns

`Promise`\<`AuthorizeAndReserveResult`\>

***

### commit()

> **commit**(`params`): `Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md)\>

#### Parameters

##### params

[`CommitParams`](../interfaces/CommitParams.md)

#### Returns

`Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md)\>

***

### getRun()

> **getRun**(`runId`): `Promise`\<[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md) \| `undefined`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md) \| `undefined`\>

***

### getRunReceiptGraph()

> **getRunReceiptGraph**(`runId`): `Promise`\<[`RunReceiptGraph`](../interfaces/RunReceiptGraph.md) \| `undefined`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<[`RunReceiptGraph`](../interfaces/RunReceiptGraph.md) \| `undefined`\>

***

### openRun()

> **openRun**(`params`): `Promise`\<[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md)\>

#### Parameters

##### params

[`OpenRunParams`](../interfaces/OpenRunParams.md)

#### Returns

`Promise`\<[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md)\>

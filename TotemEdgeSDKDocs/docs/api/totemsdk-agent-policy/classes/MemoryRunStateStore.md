[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / MemoryRunStateStore

# Class: MemoryRunStateStore

## Implements

- [`RunStateStore`](../interfaces/RunStateStore.md)

## Constructors

### Constructor

> **new MemoryRunStateStore**(`options?`): `MemoryRunStateStore`

#### Parameters

##### options?

`MemoryRunStateStoreOptions`

#### Returns

`MemoryRunStateStore`

## Methods

### abortStep()

> **abortStep**(`reservationId`, `reason`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`abortStep`](../interfaces/RunStateStore.md#abortstep)

***

### checkNonce()

> **checkNonce**(`runId`, `nonce`): `Promise`\<`boolean`\>

#### Parameters

##### runId

`string`

##### nonce

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`checkNonce`](../interfaces/RunStateStore.md#checknonce)

***

### commitStep()

> **commitStep**(`reservationId`, `receipt`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### receipt

[`RunStepReceipt`](../interfaces/RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`commitStep`](../interfaces/RunStateStore.md#commitstep)

***

### createRun()

> **createRun**(`snapshot`): `Promise`\<`void`\>

#### Parameters

##### snapshot

[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`createRun`](../interfaces/RunStateStore.md#createrun)

***

### getReceipt()

> **getReceipt**(`reservationId`): `Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md) \| `undefined`\>

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md) \| `undefined`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`getReceipt`](../interfaces/RunStateStore.md#getreceipt)

***

### getReservation()

> **getReservation**(`reservationId`): `Promise`\<[`RunReservation`](../interfaces/RunReservation.md) \| `undefined`\>

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`RunReservation`](../interfaces/RunReservation.md) \| `undefined`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`getReservation`](../interfaces/RunStateStore.md#getreservation)

***

### getRun()

> **getRun**(`runId`): `Promise`\<[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md) \| `undefined`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<[`RunStateSnapshot`](../interfaces/RunStateSnapshot.md) \| `undefined`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`getRun`](../interfaces/RunStateStore.md#getrun)

***

### listStepReceipts()

> **listStepReceipts**(`runId`): `Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md)[]\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md)[]\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`listStepReceipts`](../interfaces/RunStateStore.md#liststepreceipts)

***

### reserveStep()

> **reserveStep**(`reservation`): `Promise`\<`void`\>

#### Parameters

##### reservation

[`RunReservation`](../interfaces/RunReservation.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`reserveStep`](../interfaces/RunStateStore.md#reservestep)

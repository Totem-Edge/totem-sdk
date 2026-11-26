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

### getMandateUsage()

> **getMandateUsage**(`reservationId`): `Promise`\<[`RunMandateUsage`](../interfaces/RunMandateUsage.md)[]\>

Per-mandate reserved/actual usage rows for ledger assertions.

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`RunMandateUsage`](../interfaces/RunMandateUsage.md)[]\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`getMandateUsage`](../interfaces/RunStateStore.md#getmandateusage)

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

### reconcileReservation()

> **reconcileReservation**(`reservationId`, `outcome`, `opts?`): `Promise`\<`void`\>

Settle a recovered (`unknown`) reservation. The ONLY way an unsettled
reservation releases its budget is an explicit `'definitely-not-executed'`
reconciliation; `'completed'` commits it and folds the receipt into the
run totals.

#### Parameters

##### reservationId

`string`

##### outcome

[`ReservationSettlementOutcome`](../type-aliases/ReservationSettlementOutcome.md)

##### opts?

###### reason?

`string`

###### receipt?

[`RunStepReceipt`](../interfaces/RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`reconcileReservation`](../interfaces/RunStateStore.md#reconcilereservation)

***

### recoverReservations()

> **recoverReservations**(`runId?`): `Promise`\<[`OutOfBandReservation`](../interfaces/OutOfBandReservation.md)[]\>

Conservative reservation recovery (RFC-007 §3.5): a reservation that was
never settled before its deadline is classified `unknown` — its budget is
HELD, never restored by expiry. Returns every unsettled reservation.

#### Parameters

##### runId?

`string`

#### Returns

`Promise`\<[`OutOfBandReservation`](../interfaces/OutOfBandReservation.md)[]\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`recoverReservations`](../interfaces/RunStateStore.md#recoverreservations)

***

### renewReservation()

> **renewReservation**(`reservationId`, `extendsTo`, `now?`): `Promise`\<`void`\>

Extend a still-reserved lease before expiry. This is a trusted
coordinator operation; a renewal never extends an already-expired
reservation or an absolute policy ceiling.

#### Parameters

##### reservationId

`string`

##### extendsTo

`number`

##### now?

`number` = `...`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`renewReservation`](../interfaces/RunStateStore.md#renewreservation)

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

***

### settleReservation()

> **settleReservation**(`instruction`): `Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md)\>

RFC-022 Amendment A: settle by verified dispatch, terminal outcome and
actual consumption. Idempotent by `settlementId`; conflicting settlement
of an already-closed reservation fails closed.

#### Parameters

##### instruction

[`SettlementInstructionV1`](../interfaces/SettlementInstructionV1.md)

#### Returns

`Promise`\<[`RunStepReceipt`](../interfaces/RunStepReceipt.md)\>

#### Implementation of

[`RunStateStore`](../interfaces/RunStateStore.md).[`settleReservation`](../interfaces/RunStateStore.md#settlereservation)

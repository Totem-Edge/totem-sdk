[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / SqliteRunStateStore

# Class: SqliteRunStateStore

## Implements

- [`RunStateStore`](../interfaces/RunStateStore.md)
- [`GrantUsageStore`](../interfaces/GrantUsageStore.md)

## Constructors

### Constructor

> **new SqliteRunStateStore**(`dbPath`, `options?`): `SqliteRunStateStore`

#### Parameters

##### dbPath

`string`

##### options?

[`SqliteRunStateStoreOptions`](../interfaces/SqliteRunStateStoreOptions.md)

#### Returns

`SqliteRunStateStore`

## Methods

### abort()

> **abort**(`reservationId`, `reason`): `Promise`\<`void`\>

Abort a reservation after execution fails or is cancelled.

#### Parameters

##### reservationId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`abort`](../interfaces/GrantUsageStore.md#abort)

***

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

### authorizeAndReserve()

> **authorizeAndReserve**(`input`): `Promise`\<[`StepAuthorization`](../interfaces/StepAuthorization.md)\>

Atomically reserve mandate usage + local quotas for a step.

#### Parameters

##### input

###### actionDigest

`string`

###### mandateId

`string`

###### now

`number`

###### runId

`string`

###### stepId

`string`

###### ttlMs?

`number`

###### usageDelta

\{ `amount?`: `string`; `count`: `number`; \}

###### usageDelta.amount?

`string`

###### usageDelta.count

`number`

#### Returns

`Promise`\<[`StepAuthorization`](../interfaces/StepAuthorization.md)\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`authorizeAndReserve`](../interfaces/GrantUsageStore.md#authorizeandreserve)

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

### close()

> **close**(): `void`

#### Returns

`void`

***

### commit()

> **commit**(`reservationId`, `receipt`): `Promise`\<`void`\>

Commit a reservation after execution succeeds.

#### Parameters

##### reservationId

`string`

##### receipt

[`StepReceipt`](../interfaces/StepReceipt.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`commit`](../interfaces/GrantUsageStore.md#commit)

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

### countAborted()

> **countAborted**(`runId`): `Promise`\<`number`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`countAborted`](../interfaces/GrantUsageStore.md#countaborted)

***

### countCommitted()

> **countCommitted**(`runId`): `Promise`\<`number`\>

Run-level accounting for local bounds.

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`countCommitted`](../interfaces/GrantUsageStore.md#countcommitted)

***

### countReserved()

> **countReserved**(`runId`): `Promise`\<`number`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`countReserved`](../interfaces/GrantUsageStore.md#countreserved)

***

### countUnknown()

> **countUnknown**(`runId`): `Promise`\<`number`\>

Reservations whose outcome is unknown after crash/timeout — budget HELD.

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`countUnknown`](../interfaces/GrantUsageStore.md#countunknown)

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

#### Call Signature

> **getReservation**(`reservationId`): `Promise`\<[`RunReservation`](../interfaces/RunReservation.md) \| `undefined`\>

Read a reservation (for commit/abort bookkeeping).

##### Parameters

###### reservationId

`string`

##### Returns

`Promise`\<[`RunReservation`](../interfaces/RunReservation.md) \| `undefined`\>

##### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`getReservation`](../interfaces/GrantUsageStore.md#getreservation)

#### Call Signature

> **getReservation**(`reservationId`): `Promise`\<[`StepAuthorization`](../interfaces/StepAuthorization.md) \| `undefined`\>

##### Parameters

###### reservationId

`string`

##### Returns

`Promise`\<[`StepAuthorization`](../interfaces/StepAuthorization.md) \| `undefined`\>

##### Implementation of

`RunStateStore.getReservation`

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

### listCommittedReceipts()

> **listCommittedReceipts**(`mandateId`): `Promise`\<[`StepReceipt`](../interfaces/StepReceipt.md)[]\>

Committed receipts for a mandate — used to build the usage snapshot.

#### Parameters

##### mandateId

`string`

#### Returns

`Promise`\<[`StepReceipt`](../interfaces/StepReceipt.md)[]\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`listCommittedReceipts`](../interfaces/GrantUsageStore.md#listcommittedreceipts)

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

`ReservationSettlementOutcome`

##### opts?

###### reason?

`string`

###### receipt?

[`StepReceipt`](../interfaces/StepReceipt.md) \| [`RunStepReceipt`](../interfaces/RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`reconcileReservation`](../interfaces/GrantUsageStore.md#reconcilereservation)

***

### recoverReservations()

> **recoverReservations**(`runId?`): `Promise`\<`OutOfBandReservation`[]\>

Conservative reservation recovery (RFC-007 §3.5): a reservation that was
never settled before its deadline is classified `unknown` — its budget is
HELD, never restored by expiry. Returns every unsettled reservation.

#### Parameters

##### runId?

`string`

#### Returns

`Promise`\<`OutOfBandReservation`[]\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`recoverReservations`](../interfaces/GrantUsageStore.md#recoverreservations)

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

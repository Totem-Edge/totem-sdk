[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / MemoryGrantUsageStore

# Class: MemoryGrantUsageStore

In-memory `GrantUsageStore`. Atomic within a single process (single-threaded
JS event loop), so concurrent steps observe a consistent budget. Swap for a
durable store (SQLite/Postgres) at the wallet boundary.

## Implements

- [`GrantUsageStore`](../interfaces/GrantUsageStore.md)

## Constructors

### Constructor

> **new MemoryGrantUsageStore**(`options?`): `MemoryGrantUsageStore`

#### Parameters

##### options?

[`MemoryGrantUsageStoreOptions`](../interfaces/MemoryGrantUsageStoreOptions.md)

#### Returns

`MemoryGrantUsageStore`

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

### getReceipt()

> **getReceipt**(`reservationId`): [`StepReceipt`](../interfaces/StepReceipt.md) \| `undefined`

#### Parameters

##### reservationId

`string`

#### Returns

[`StepReceipt`](../interfaces/StepReceipt.md) \| `undefined`

***

### getReservation()

> **getReservation**(`reservationId`): `Promise`\<[`StepAuthorization`](../interfaces/StepAuthorization.md) \| `undefined`\>

Read a reservation (for commit/abort bookkeeping).

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`StepAuthorization`](../interfaces/StepAuthorization.md) \| `undefined`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`getReservation`](../interfaces/GrantUsageStore.md#getreservation)

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

### reconcileReservation()

> **reconcileReservation**(`reservationId`, `outcome`, `opts?`): `Promise`\<`void`\>

Explicit settlement of a recovered (`unknown`) reservation. The only way
budget is released is `'definitely-not-executed'`; `'completed'` commits.

#### Parameters

##### reservationId

`string`

##### outcome

`ReservationSettlementOutcome`

##### opts?

###### reason?

`string`

###### receipt?

[`StepReceipt`](../interfaces/StepReceipt.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`reconcileReservation`](../interfaces/GrantUsageStore.md#reconcilereservation)

***

### recoverReservations()

> **recoverReservations**(`runId?`): `Promise`\<`OutOfBandReservation`[]\>

Conservative reservation recovery: unsettled past-deadline reservations are
classified `unknown` and their budget is HELD until explicit reconciliation.

#### Parameters

##### runId?

`string`

#### Returns

`Promise`\<`OutOfBandReservation`[]\>

#### Implementation of

[`GrantUsageStore`](../interfaces/GrantUsageStore.md).[`recoverReservations`](../interfaces/GrantUsageStore.md#recoverreservations)

[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / GrantUsageStore

# Interface: GrantUsageStore

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

***

### authorizeAndReserve()

> **authorizeAndReserve**(`input`): `Promise`\<[`StepAuthorization`](StepAuthorization.md)\>

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

`Promise`\<[`StepAuthorization`](StepAuthorization.md)\>

***

### commit()

> **commit**(`reservationId`, `receipt`): `Promise`\<`void`\>

Commit a reservation after execution succeeds.

#### Parameters

##### reservationId

`string`

##### receipt

[`StepReceipt`](StepReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### countAborted()

> **countAborted**(`runId`): `Promise`\<`number`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

***

### countCommitted()

> **countCommitted**(`runId`): `Promise`\<`number`\>

Run-level accounting for local bounds.

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

***

### countReserved()

> **countReserved**(`runId`): `Promise`\<`number`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

***

### countUnknown()

> **countUnknown**(`runId`): `Promise`\<`number`\>

Reservations whose outcome is unknown after crash/timeout — budget HELD.

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<`number`\>

***

### getReservation()

> **getReservation**(`reservationId`): `Promise`\<[`StepAuthorization`](StepAuthorization.md) \| `undefined`\>

Read a reservation (for commit/abort bookkeeping).

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`StepAuthorization`](StepAuthorization.md) \| `undefined`\>

***

### listCommittedReceipts()

> **listCommittedReceipts**(`mandateId`): `Promise`\<[`StepReceipt`](StepReceipt.md)[]\>

Committed receipts for a mandate — used to build the usage snapshot.

#### Parameters

##### mandateId

`string`

#### Returns

`Promise`\<[`StepReceipt`](StepReceipt.md)[]\>

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

[`StepReceipt`](StepReceipt.md)

#### Returns

`Promise`\<`void`\>

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

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

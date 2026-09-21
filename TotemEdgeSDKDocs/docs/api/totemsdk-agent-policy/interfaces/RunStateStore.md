[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RunStateStore

# Interface: RunStateStore

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

***

### commitStep()

> **commitStep**(`reservationId`, `receipt`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### receipt

[`RunStepReceipt`](RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### createRun()

> **createRun**(`snapshot`): `Promise`\<`void`\>

#### Parameters

##### snapshot

[`RunStateSnapshot`](RunStateSnapshot.md)

#### Returns

`Promise`\<`void`\>

***

### getReceipt()

> **getReceipt**(`reservationId`): `Promise`\<[`RunStepReceipt`](RunStepReceipt.md) \| `undefined`\>

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`RunStepReceipt`](RunStepReceipt.md) \| `undefined`\>

***

### getReservation()

> **getReservation**(`reservationId`): `Promise`\<[`RunReservation`](RunReservation.md) \| `undefined`\>

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`RunReservation`](RunReservation.md) \| `undefined`\>

***

### getRun()

> **getRun**(`runId`): `Promise`\<[`RunStateSnapshot`](RunStateSnapshot.md) \| `undefined`\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<[`RunStateSnapshot`](RunStateSnapshot.md) \| `undefined`\>

***

### listStepReceipts()

> **listStepReceipts**(`runId`): `Promise`\<[`RunStepReceipt`](RunStepReceipt.md)[]\>

#### Parameters

##### runId

`string`

#### Returns

`Promise`\<[`RunStepReceipt`](RunStepReceipt.md)[]\>

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

[`RunStepReceipt`](RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

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

***

### reserveStep()

> **reserveStep**(`reservation`): `Promise`\<`void`\>

#### Parameters

##### reservation

[`RunReservation`](RunReservation.md)

#### Returns

`Promise`\<`void`\>

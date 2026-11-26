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

### getMandateUsage()

> **getMandateUsage**(`reservationId`): `Promise`\<[`RunMandateUsage`](RunMandateUsage.md)[]\>

Per-mandate reserved/actual usage rows for ledger assertions.

#### Parameters

##### reservationId

`string`

#### Returns

`Promise`\<[`RunMandateUsage`](RunMandateUsage.md)[]\>

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

[`ReservationSettlementOutcome`](../type-aliases/ReservationSettlementOutcome.md)

##### opts?

###### reason?

`string`

###### receipt?

[`RunStepReceipt`](RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### recoverReservations()

> **recoverReservations**(`runId?`): `Promise`\<[`OutOfBandReservation`](OutOfBandReservation.md)[]\>

Conservative reservation recovery (RFC-007 §3.5): a reservation that was
never settled before its deadline is classified `unknown` — its budget is
HELD, never restored by expiry. Returns every unsettled reservation.

#### Parameters

##### runId?

`string`

#### Returns

`Promise`\<[`OutOfBandReservation`](OutOfBandReservation.md)[]\>

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

`number`

#### Returns

`Promise`\<`void`\>

***

### reserveStep()

> **reserveStep**(`reservation`): `Promise`\<`void`\>

#### Parameters

##### reservation

[`RunReservation`](RunReservation.md)

#### Returns

`Promise`\<`void`\>

***

### settleReservation()

> **settleReservation**(`instruction`): `Promise`\<[`RunStepReceipt`](RunStepReceipt.md)\>

RFC-022 Amendment A: settle by verified dispatch, terminal outcome and
actual consumption. Idempotent by `settlementId`; conflicting settlement
of an already-closed reservation fails closed.

#### Parameters

##### instruction

[`SettlementInstructionV1`](SettlementInstructionV1.md)

#### Returns

`Promise`\<[`RunStepReceipt`](RunStepReceipt.md)\>

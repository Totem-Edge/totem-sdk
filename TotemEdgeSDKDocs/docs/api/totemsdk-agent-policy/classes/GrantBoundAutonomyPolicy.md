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

***

### reconcileReservation()

> **reconcileReservation**(`reservationId`, `outcome`, `opts?`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### outcome

`ReservationSettlementOutcome`

##### opts?

###### reason?

`string`

###### receipt?

[`RunStepReceipt`](../interfaces/RunStepReceipt.md)

#### Returns

`Promise`\<`void`\>

***

### recoverReservations()

> **recoverReservations**(`runId?`): `Promise`\<`OutOfBandReservation`[]\>

Conservative reservation recovery (RFC-007 §3.5): reservations never
settled before their deadline are surfaced as `unknown` — budget held —
until the host settles them via `reconcileReservation`. No expiry ever
restores spending capacity.

#### Parameters

##### runId?

`string`

#### Returns

`Promise`\<`OutOfBandReservation`[]\>

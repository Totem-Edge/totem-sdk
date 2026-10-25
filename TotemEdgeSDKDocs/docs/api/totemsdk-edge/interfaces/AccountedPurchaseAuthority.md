[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / AccountedPurchaseAuthority

# Interface: AccountedPurchaseAuthority

## Methods

### abort()

> **abort**(`reservationId`, `reason`): `Promise`\<`void`\>

Abort the reservation after a failed/cancelled purchase (releases budget).

#### Parameters

##### reservationId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### approve()

> **approve**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<[`AccountedPurchaseApproval`](AccountedPurchaseApproval.md)\>\>

Evaluate mandate scope/budget and atomically reserve usage on approval.

#### Parameters

##### params

###### agreement

[`TradeAgreement`](TradeAgreement.md)

###### intent

[`PurchaseIntent`](PurchaseIntent.md)

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<[`AccountedPurchaseApproval`](AccountedPurchaseApproval.md)\>\>

***

### commit()

> **commit**(`reservationId`, `executionProof?`): `Promise`\<`void`\>

Commit the reservation after the purchase succeeds (consumes budget).

#### Parameters

##### reservationId

`string`

##### executionProof?

`unknown`

#### Returns

`Promise`\<`void`\>

***

### counts()

> **counts**(): `Promise`\<\{ `aborted`: `number`; `committed`: `number`; `reserved`: `number`; `unknown`: `number`; \}\>

Live counters read from the same authority (no second accounting layer).

#### Returns

`Promise`\<\{ `aborted`: `number`; `committed`: `number`; `reserved`: `number`; `unknown`: `number`; \}\>

***

### reconcile()

> **reconcile**(`reservationId`, `outcome`, `opts?`): `Promise`\<`void`\>

Explicitly settle a recovered reservation. `'definitely-not-executed'` is the only release.

#### Parameters

##### reservationId

`string`

##### outcome

`ReservationSettlementOutcome`

##### opts?

###### reason?

`string`

###### receipt?

`StepReceipt`

#### Returns

`Promise`\<`void`\>

***

### recover()

> **recover**(`runId?`): `Promise`\<`OutOfBandReservation`[]\>

Surface expired-unsettled reservations; their budget stays HELD until reconciliation.

#### Parameters

##### runId?

`string`

#### Returns

`Promise`\<`OutOfBandReservation`[]\>

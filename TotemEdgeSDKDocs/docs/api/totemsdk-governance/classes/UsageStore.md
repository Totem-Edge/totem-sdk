[**@totemsdk/governance**](../index.md)

***

[@totemsdk/governance](../index.md) / UsageStore

# Class: UsageStore

## Constructors

### Constructor

> **new UsageStore**(): `UsageStore`

#### Returns

`UsageStore`

## Methods

### abortMandateUse()

> **abortMandateUse**(`reservationId`, `_reason?`): `boolean`

#### Parameters

##### reservationId

`string`

##### \_reason?

`string`

#### Returns

`boolean`

***

### commitMandateUse()

> **commitMandateUse**(`reservationId`, `receiptParams`): `string` \| [`MandateReceipt`](../interfaces/MandateReceipt.md)

#### Parameters

##### reservationId

`string`

##### receiptParams

###### actionIndex

`number`

###### actionType

[`ProposalActionType`](../type-aliases/ProposalActionType.md)

###### proofId?

`string`

###### proposalId

`string`

#### Returns

`string` \| [`MandateReceipt`](../interfaces/MandateReceipt.md)

***

### getReceipt()

> **getReceipt**(`receiptId`): [`MandateReceipt`](../interfaces/MandateReceipt.md) \| `undefined`

#### Parameters

##### receiptId

`string`

#### Returns

[`MandateReceipt`](../interfaces/MandateReceipt.md) \| `undefined`

***

### getReceiptsByMandate()

> **getReceiptsByMandate**(`mandateProofId`): [`MandateReceipt`](../interfaces/MandateReceipt.md)[]

#### Parameters

##### mandateProofId

`string`

#### Returns

[`MandateReceipt`](../interfaces/MandateReceipt.md)[]

***

### getReservation()

> **getReservation**(`reservationId`): [`UsageReservation`](../interfaces/UsageReservation.md) \| `undefined`

#### Parameters

##### reservationId

`string`

#### Returns

[`UsageReservation`](../interfaces/UsageReservation.md) \| `undefined`

***

### getReservationsByMandate()

> **getReservationsByMandate**(`mandateProofId`): [`UsageReservation`](../interfaces/UsageReservation.md)[]

#### Parameters

##### mandateProofId

`string`

#### Returns

[`UsageReservation`](../interfaces/UsageReservation.md)[]

***

### reserveMandateUse()

> **reserveMandateUse**(`mandateProofId`, `intentId`, `ttlMs?`): [`UsageReservation`](../interfaces/UsageReservation.md)

#### Parameters

##### mandateProofId

`string`

##### intentId

`string`

##### ttlMs?

`number`

#### Returns

[`UsageReservation`](../interfaces/UsageReservation.md)

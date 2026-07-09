[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / OnchainWatermarkProvider

# Class: OnchainWatermarkProvider

Layer 5 — on-chain watermark coin.

## Implements

- [`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md)

## Constructors

### Constructor

> **new OnchainWatermarkProvider**(): `OnchainWatermarkProvider`

#### Returns

`OnchainWatermarkProvider`

## Methods

### burnReservation()

> **burnReservation**(`_reservationId`, `_reason`): `Promise`\<`void`\>

#### Parameters

##### \_reservationId

`string`

##### \_reason

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`burnReservation`](../interfaces/WotsLeaseProvider.md#burnreservation)

***

### commitKeyUse()

> **commitKeyUse**(`_reservationId`, `_txId`): `Promise`\<`void`\>

#### Parameters

##### \_reservationId

`string`

##### \_txId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`commitKeyUse`](../interfaces/WotsLeaseProvider.md#commitkeyuse)

***

### getLocalWatermark()

> **getLocalWatermark**(`_treeId`): `Promise`\<[`LocalWatermark`](../interfaces/LocalWatermark.md)\>

#### Parameters

##### \_treeId

`string`

#### Returns

`Promise`\<[`LocalWatermark`](../interfaces/LocalWatermark.md)\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`getLocalWatermark`](../interfaces/WotsLeaseProvider.md#getlocalwatermark)

***

### publishWatermark()

> **publishWatermark**(`_treeId`): `Promise`\<`void`\>

#### Parameters

##### \_treeId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`publishWatermark`](../interfaces/WotsLeaseProvider.md#publishwatermark)

***

### reserveKeyUse()

> **reserveKeyUse**(`_params`): `Promise`\<[`LeaseReservation`](../interfaces/LeaseReservation.md)\>

#### Parameters

##### \_params

[`ReserveParams`](../interfaces/ReserveParams.md)

#### Returns

`Promise`\<[`LeaseReservation`](../interfaces/LeaseReservation.md)\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`reserveKeyUse`](../interfaces/WotsLeaseProvider.md#reservekeyuse)

***

### syncLeaseJournal()

> **syncLeaseJournal**(): `Promise`\<[`SyncResult`](../interfaces/SyncResult.md)\>

#### Returns

`Promise`\<[`SyncResult`](../interfaces/SyncResult.md)\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`syncLeaseJournal`](../interfaces/WotsLeaseProvider.md#syncleasejournal)

***

### verifyLeaseCertificate()

> **verifyLeaseCertificate**(`_cert?`): `Promise`\<`boolean`\>

#### Parameters

##### \_cert?

[`LeaseCertificate`](../interfaces/LeaseCertificate.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`verifyLeaseCertificate`](../interfaces/WotsLeaseProvider.md#verifyleasecertificate)

[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / WotsLeaseProvider

# Interface: WotsLeaseProvider

## Methods

### burnReservation()

> **burnReservation**(`reservationId`, `reason`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### commitKeyUse()

> **commitKeyUse**(`reservationId`, `txId`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### txId

`string`

#### Returns

`Promise`\<`void`\>

***

### getLocalWatermark()

> **getLocalWatermark**(`treeId`): `Promise`\<[`LocalWatermark`](LocalWatermark.md)\>

#### Parameters

##### treeId

`string`

#### Returns

`Promise`\<[`LocalWatermark`](LocalWatermark.md)\>

***

### publishWatermark()

> **publishWatermark**(`treeId`): `Promise`\<`void`\>

#### Parameters

##### treeId

`string`

#### Returns

`Promise`\<`void`\>

***

### reserveKeyUse()

> **reserveKeyUse**(`params`): `Promise`\<[`LeaseReservation`](LeaseReservation.md)\>

#### Parameters

##### params

[`ReserveParams`](ReserveParams.md)

#### Returns

`Promise`\<[`LeaseReservation`](LeaseReservation.md)\>

***

### syncLeaseJournal()

> **syncLeaseJournal**(): `Promise`\<[`SyncResult`](SyncResult.md)\>

#### Returns

`Promise`\<[`SyncResult`](SyncResult.md)\>

***

### verifyLeaseCertificate()

> **verifyLeaseCertificate**(`cert?`): `Promise`\<`boolean`\>

#### Parameters

##### cert?

[`LeaseCertificate`](LeaseCertificate.md)

#### Returns

`Promise`\<`boolean`\>

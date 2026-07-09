[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / AxiaLeaseProvider

# Class: AxiaLeaseProvider

## Implements

- [`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md)

## Constructors

### Constructor

> **new AxiaLeaseProvider**(`config`): `AxiaLeaseProvider`

#### Parameters

##### config

[`AxiaLeaseProviderConfig`](../interfaces/AxiaLeaseProviderConfig.md)

#### Returns

`AxiaLeaseProvider`

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

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`burnReservation`](../interfaces/WotsLeaseProvider.md#burnreservation)

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

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`commitKeyUse`](../interfaces/WotsLeaseProvider.md#commitkeyuse)

***

### getLocalWatermark()

> **getLocalWatermark**(`treeId`): `Promise`\<[`LocalWatermark`](../interfaces/LocalWatermark.md)\>

#### Parameters

##### treeId

`string`

#### Returns

`Promise`\<[`LocalWatermark`](../interfaces/LocalWatermark.md)\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`getLocalWatermark`](../interfaces/WotsLeaseProvider.md#getlocalwatermark)

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

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

> **reserveKeyUse**(`params`): `Promise`\<[`LeaseReservation`](../interfaces/LeaseReservation.md)\>

#### Parameters

##### params

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

> **verifyLeaseCertificate**(`cert?`): `Promise`\<`boolean`\>

#### Parameters

##### cert?

[`LeaseCertificate`](../interfaces/LeaseCertificate.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md).[`verifyLeaseCertificate`](../interfaces/WotsLeaseProvider.md#verifyleasecertificate)

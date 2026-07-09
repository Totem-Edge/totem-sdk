[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / HybridLeaseProvider

# Class: HybridLeaseProvider

## Implements

- [`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md)

## Constructors

### Constructor

> **new HybridLeaseProvider**(`config`): `HybridLeaseProvider`

#### Parameters

##### config

[`HybridLeaseProviderConfig`](../interfaces/HybridLeaseProviderConfig.md)

#### Returns

`HybridLeaseProvider`

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

### publishWatermark()

> **publishWatermark**(`treeId`): `Promise`\<`void`\>

#### Parameters

##### treeId

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

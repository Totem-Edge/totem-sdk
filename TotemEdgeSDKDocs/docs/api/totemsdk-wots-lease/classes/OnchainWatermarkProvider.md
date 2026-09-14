[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / OnchainWatermarkProvider

# Class: OnchainWatermarkProvider

## Implements

- [`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md)

## Constructors

### Constructor

> **new OnchainWatermarkProvider**(`config`): `OnchainWatermarkProvider`

#### Parameters

##### config

[`OnchainWatermarkProviderConfig`](../interfaces/OnchainWatermarkProviderConfig.md)

#### Returns

`OnchainWatermarkProvider`

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

> **publishWatermark**(`treeId`): `Promise`\<`void`\>

Publish the local watermark cursor on-chain by spending the watermark
coin back to itself with STATE(statePort) = flat cursor.

Rate-limited by minBlocksBetweenPublishes using the chain tip.

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

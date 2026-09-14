[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / LocalLeaseProvider

# Class: LocalLeaseProvider

## Implements

- [`WotsLeaseProvider`](../interfaces/WotsLeaseProvider.md)

## Constructors

### Constructor

> **new LocalLeaseProvider**(`storage`, `logger?`, `deviceId?`): `LocalLeaseProvider`

#### Parameters

##### storage

`StorageAdapter`

##### logger?

`LoggerAdapter` = `...`

##### deviceId?

`string` = `'local'`

#### Returns

`LocalLeaseProvider`

## Methods

### advanceToRemoteWatermark()

> **advanceToRemoteWatermark**(`treeId`, `remote`): `Promise`\<`boolean`\>

Advance the local watermark to a remote cursor (monotonic merge).
Used by quorum sync and the lookup-node LeaseCoordinator when a peer
publishes a watermark ahead of ours. Returns false when the remote
cursor is behind (no-op).

#### Parameters

##### treeId

`string`

##### remote

###### addressCursor

`number`

###### l1Cursor

`number`

###### l2Cursor

`number`

#### Returns

`Promise`\<`boolean`\>

***

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

### getJournal()

> **getJournal**(): [`LeaseJournal`](LeaseJournal.md)

Expose the journal for quorum/on-chain providers to merge remote entries.

#### Returns

[`LeaseJournal`](LeaseJournal.md)

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

### listTrees()

> **listTrees**(): `string`[]

List all tree IDs known to the local watermark store.

#### Returns

`string`[]

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

### reserveSpecificKeyUse()

> **reserveSpecificKeyUse**(`params`, `indices`): `Promise`\<[`LeaseReservation`](../interfaces/LeaseReservation.md)\>

Reserve a specific set of indices (used by quorum coordination so every
peer attests to the same slot). Throws IndicesUnavailableError when the
slot is already taken.

#### Parameters

##### params

[`ReserveParams`](../interfaces/ReserveParams.md)

##### indices

[`SigningIndices`](../interfaces/SigningIndices.md)

#### Returns

`Promise`\<[`LeaseReservation`](../interfaces/LeaseReservation.md)\>

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

[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / LeaseStore

# Class: LeaseStore

## Constructors

### Constructor

> **new LeaseStore**(`storage`, `logger?`, `config?`): `LeaseStore`

#### Parameters

##### storage

[`StorageAdapter`](../interfaces/StorageAdapter.md)

##### logger?

[`LoggerAdapter`](../interfaces/LoggerAdapter.md)

##### config?

[`LeaseStoreConfig`](../interfaces/LeaseStoreConfig.md)

#### Returns

`LeaseStore`

## Methods

### calculateMonitoringInterval()

> **calculateMonitoringInterval**(): `number`

#### Returns

`number`

***

### cleanupExpired()

> **cleanupExpired**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### delete()

> **delete**(`leaseId`): `Promise`\<`boolean`\>

#### Parameters

##### leaseId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### deleteByToken()

> **deleteByToken**(`leaseToken`): `Promise`\<`boolean`\>

#### Parameters

##### leaseToken

`string`

#### Returns

`Promise`\<`boolean`\>

***

### get()

> **get**(`leaseId`): [`StoredLease`](../interfaces/StoredLease.md) \| `undefined`

#### Parameters

##### leaseId

`string`

#### Returns

[`StoredLease`](../interfaces/StoredLease.md) \| `undefined`

***

### getActive()

> **getActive**(): [`StoredLease`](../interfaces/StoredLease.md)[]

#### Returns

[`StoredLease`](../interfaces/StoredLease.md)[]

***

### getAll()

> **getAll**(): [`StoredLease`](../interfaces/StoredLease.md)[]

#### Returns

[`StoredLease`](../interfaces/StoredLease.md)[]

***

### getByToken()

> **getByToken**(`leaseToken`): [`StoredLease`](../interfaces/StoredLease.md) \| `undefined`

#### Parameters

##### leaseToken

`string`

#### Returns

[`StoredLease`](../interfaces/StoredLease.md) \| `undefined`

***

### getExpiringSoon()

> **getExpiringSoon**(`thresholdMs?`): [`StoredLease`](../interfaces/StoredLease.md)[]

#### Parameters

##### thresholdMs?

`number`

#### Returns

[`StoredLease`](../interfaces/StoredLease.md)[]

***

### getMinimumTTL()

> **getMinimumTTL**(): `number` \| `null`

#### Returns

`number` \| `null`

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

#### Returns

`boolean`

***

### save()

> **save**(`lease`): `Promise`\<`void`\>

#### Parameters

##### lease

[`StoredLease`](../interfaces/StoredLease.md)

#### Returns

`Promise`\<`void`\>

***

### updateStatus()

> **updateStatus**(`leaseId`, `status`): `Promise`\<`void`\>

#### Parameters

##### leaseId

`string`

##### status

[`LeaseStatus`](../type-aliases/LeaseStatus.md)

#### Returns

`Promise`\<`void`\>

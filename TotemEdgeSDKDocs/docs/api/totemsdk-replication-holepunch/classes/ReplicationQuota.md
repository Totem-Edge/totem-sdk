[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / ReplicationQuota

# Class: ReplicationQuota

Process-local quota accounting; callers persist consumption with the store.

## Constructors

### Constructor

> **new ReplicationQuota**(`policy`): `ReplicationQuota`

#### Parameters

##### policy

[`ReplicationQuotaPolicy`](../interfaces/ReplicationQuotaPolicy.md)

#### Returns

`ReplicationQuota`

## Accessors

### usedBytes

#### Get Signature

> **get** **usedBytes**(): `number`

##### Returns

`number`

***

### usedRecords

#### Get Signature

> **get** **usedRecords**(): `number`

##### Returns

`number`

## Methods

### consume()

> **consume**(`bytes`, `records?`): `void`

#### Parameters

##### bytes

`number`

##### records?

`number` = `1`

#### Returns

`void`

***

### reset()

> **reset**(): `void`

#### Returns

`void`

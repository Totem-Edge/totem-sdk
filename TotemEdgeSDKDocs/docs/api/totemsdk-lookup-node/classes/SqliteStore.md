[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / SqliteStore

# Class: SqliteStore

## Constructors

### Constructor

> **new SqliteStore**(`dbPath`): `SqliteStore`

#### Parameters

##### dbPath

`string`

#### Returns

`SqliteStore`

## Methods

### agentDeleteExpired()

> **agentDeleteExpired**(`now`): `void`

#### Parameters

##### now

`number`

#### Returns

`void`

***

### agentQuery()

> **agentQuery**(`now`): [`AgentRow`](../interfaces/AgentRow.md)[]

#### Parameters

##### now

`number`

#### Returns

[`AgentRow`](../interfaces/AgentRow.md)[]

***

### agentUpsert()

> **agentUpsert**(`row`): `void`

#### Parameters

##### row

[`AgentRow`](../interfaces/AgentRow.md)

#### Returns

`void`

***

### appDeleteExpired()

> **appDeleteExpired**(`now`): `void`

#### Parameters

##### now

`number`

#### Returns

`void`

***

### appQuery()

> **appQuery**(`now`, `authorAddress?`, `isFree?`): [`AppRow`](../interfaces/AppRow.md)[]

#### Parameters

##### now

`number`

##### authorAddress?

`string`

##### isFree?

`boolean`

#### Returns

[`AppRow`](../interfaces/AppRow.md)[]

***

### appUpsert()

> **appUpsert**(`row`): `void`

#### Parameters

##### row

[`AppRow`](../interfaces/AppRow.md)

#### Returns

`void`

***

### cacheEvictExpired()

> **cacheEvictExpired**(): `void`

#### Returns

`void`

***

### cacheGet()

> **cacheGet**(`key`): `string` \| `null`

#### Parameters

##### key

`string`

#### Returns

`string` \| `null`

***

### cacheSet()

> **cacheSet**(`key`, `data`, `ttlMs`): `void`

#### Parameters

##### key

`string`

##### data

`string`

##### ttlMs

`number`

#### Returns

`void`

***

### close()

> **close**(): `void`

#### Returns

`void`

***

### kvClear()

> **kvClear**(): `void`

#### Returns

`void`

***

### kvGet()

> **kvGet**(`key`): `string` \| `null`

#### Parameters

##### key

`string`

#### Returns

`string` \| `null`

***

### kvHas()

> **kvHas**(`key`): `boolean`

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### kvKeys()

> **kvKeys**(`prefix?`): `string`[]

#### Parameters

##### prefix?

`string`

#### Returns

`string`[]

***

### kvRemove()

> **kvRemove**(`key`): `boolean`

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### kvSet()

> **kvSet**(`key`, `value`): `void`

#### Parameters

##### key

`string`

##### value

`string`

#### Returns

`void`

***

### relayEvictOldest()

> **relayEvictOldest**(`maxCount`): `void`

Keep only the newest `maxCount` entries (evict oldest).

#### Parameters

##### maxCount

`number`

#### Returns

`void`

***

### relayHasSeen()

> **relayHasSeen**(`key`): `boolean`

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### relayMarkSeen()

> **relayMarkSeen**(`key`): `void`

#### Parameters

##### key

`string`

#### Returns

`void`

***

### trustQuery()

> **trustQuery**(`subjectId`): [`TrustRow`](../interfaces/TrustRow.md)[]

#### Parameters

##### subjectId

`string`

#### Returns

[`TrustRow`](../interfaces/TrustRow.md)[]

***

### trustUpsert()

> **trustUpsert**(`row`): `void`

#### Parameters

##### row

[`TrustRow`](../interfaces/TrustRow.md)

#### Returns

`void`

***

### watchlistAdd()

> **watchlistAdd**(`sessionId`, `addresses`): `void`

#### Parameters

##### sessionId

`string`

##### addresses

`string`[]

#### Returns

`void`

***

### watchlistGetAll()

> **watchlistGetAll**(): `object`[]

All (sessionId, address) pairs (to rebuild in-memory map on restart).

#### Returns

`object`[]

***

### watchlistGetAllAddresses()

> **watchlistGetAllAddresses**(): `string`[]

All unique addresses currently being watched (for recovery polling after restart).

#### Returns

`string`[]

***

### watchlistRemove()

> **watchlistRemove**(`sessionId`, `addresses`): `void`

#### Parameters

##### sessionId

`string`

##### addresses

`string`[]

#### Returns

`void`

***

### watchlistRemoveSession()

> **watchlistRemoveSession**(`sessionId`): `void`

#### Parameters

##### sessionId

`string`

#### Returns

`void`

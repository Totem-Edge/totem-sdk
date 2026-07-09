[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / WatchlistManager

# Class: WatchlistManager

## Constructors

### Constructor

> **new WatchlistManager**(`_config`): `WatchlistManager`

#### Parameters

##### \_config

`WatchlistManagerConfig`

#### Returns

`WatchlistManager`

## Methods

### forcePoll()

> **forcePoll**(): `Promise`\<`void`\>

Exposed for testing: trigger a poll manually.

#### Returns

`Promise`\<`void`\>

***

### getWatchedAddresses()

> **getWatchedAddresses**(): `string`[]

#### Returns

`string`[]

***

### register()

> **register**(`sessionId`, `addresses`, `transport`): `void`

#### Parameters

##### sessionId

`string`

##### addresses

`string`[]

##### transport

[`ITransport`](../interfaces/ITransport.md)

#### Returns

`void`

***

### remove()

> **remove**(`sessionId`, `addresses`): `void`

#### Parameters

##### sessionId

`string`

##### addresses

`string`[]

#### Returns

`void`

***

### removeSession()

> **removeSession**(`sessionId`): `void`

#### Parameters

##### sessionId

`string`

#### Returns

`void`

***

### start()

> **start**(): `void`

#### Returns

`void`

***

### stop()

> **stop**(): `void`

#### Returns

`void`

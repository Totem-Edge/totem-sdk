[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / MegBalanceStreamManager

# Class: MegBalanceStreamManager

## Constructors

### Constructor

> **new MegBalanceStreamManager**(`deps`, `config`): `MegBalanceStreamManager`

#### Parameters

##### deps

[`MegBalanceStreamDependencies`](../interfaces/MegBalanceStreamDependencies.md)

##### config

[`BalanceStreamConfig`](../interfaces/BalanceStreamConfig.md)

#### Returns

`MegBalanceStreamManager`

## Methods

### addListener()

> **addListener**(`listener`): `void`

#### Parameters

##### listener

[`BalanceStreamListener`](../interfaces/BalanceStreamListener.md)

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

#### Returns

`void`

***

### getCachedBalance()

> **getCachedBalance**(`address`): `Promise`\<[`CachedBalance`](../interfaces/CachedBalance.md) \| `null`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`CachedBalance`](../interfaces/CachedBalance.md) \| `null`\>

***

### getConnectionState()

> **getConnectionState**(): [`ConnectionState`](../type-aliases/ConnectionState.md)

#### Returns

[`ConnectionState`](../type-aliases/ConnectionState.md)

***

### removeListener()

> **removeListener**(`listener`): `void`

#### Parameters

##### listener

[`BalanceStreamListener`](../interfaces/BalanceStreamListener.md)

#### Returns

`void`

***

### start()

> **start**(`addresses`): `Promise`\<`void`\>

#### Parameters

##### addresses

`string`[]

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `void`

#### Returns

`void`

***

### updateAddresses()

> **updateAddresses**(`addresses`): `Promise`\<`void`\>

#### Parameters

##### addresses

`string`[]

#### Returns

`Promise`\<`void`\>

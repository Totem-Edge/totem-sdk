[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / BalanceCache

# Class: BalanceCache

## Constructors

### Constructor

> **new BalanceCache**(`deps`, `config?`): `BalanceCache`

#### Parameters

##### deps

[`BalanceCacheDependencies`](../interfaces/BalanceCacheDependencies.md)

##### config?

[`BalanceCacheConfig`](../interfaces/BalanceCacheConfig.md) = `{}`

#### Returns

`BalanceCache`

## Methods

### cleanup()

> **cleanup**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`address`): `Promise`\<[`CachedBalance`](../interfaces/CachedBalance.md) \| `null`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`CachedBalance`](../interfaces/CachedBalance.md) \| `null`\>

***

### getAll()

> **getAll**(): `Promise`\<`Record`\<`string`, [`CachedBalance`](../interfaces/CachedBalance.md)\>\>

#### Returns

`Promise`\<`Record`\<`string`, [`CachedBalance`](../interfaces/CachedBalance.md)\>\>

***

### getInMemory()

> **getInMemory**(`address`): [`CachedBalance`](../interfaces/CachedBalance.md) \| `null`

#### Parameters

##### address

`string`

#### Returns

[`CachedBalance`](../interfaces/CachedBalance.md) \| `null`

***

### remove()

> **remove**(`address`): `Promise`\<`void`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`void`\>

***

### set()

> **set**(`address`, `balance`): `Promise`\<`void`\>

#### Parameters

##### address

`string`

##### balance

[`CachedBalance`](../interfaces/CachedBalance.md)

#### Returns

`Promise`\<`void`\>

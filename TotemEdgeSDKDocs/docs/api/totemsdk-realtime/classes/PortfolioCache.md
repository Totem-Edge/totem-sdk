[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / PortfolioCache

# Class: PortfolioCache

## Constructors

### Constructor

> **new PortfolioCache**(`deps`, `config?`): `PortfolioCache`

#### Parameters

##### deps

[`PortfolioCacheDependencies`](../interfaces/PortfolioCacheDependencies.md)

##### config?

[`PortfolioCacheConfig`](../interfaces/PortfolioCacheConfig.md) = `{}`

#### Returns

`PortfolioCache`

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

> **get**(`address`): `Promise`\<[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[] \| `null`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[] \| `null`\>

***

### getAll()

> **getAll**(): `Promise`\<`Record`\<`string`, [`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]\>\>

#### Returns

`Promise`\<`Record`\<`string`, [`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]\>\>

***

### getInMemory()

> **getInMemory**(`address`): [`PortfolioEntry`](../interfaces/PortfolioEntry.md)[] \| `null`

#### Parameters

##### address

`string`

#### Returns

[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[] \| `null`

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

> **set**(`address`, `entries`): `Promise`\<`void`\>

#### Parameters

##### address

`string`

##### entries

[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]

#### Returns

`Promise`\<`void`\>

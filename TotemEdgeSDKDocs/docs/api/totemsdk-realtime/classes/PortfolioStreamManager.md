[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / PortfolioStreamManager

# Class: PortfolioStreamManager

## Constructors

### Constructor

> **new PortfolioStreamManager**(`deps`, `config`): `PortfolioStreamManager`

#### Parameters

##### deps

[`PortfolioStreamDependencies`](../interfaces/PortfolioStreamDependencies.md)

##### config

[`PortfolioStreamConfig`](../interfaces/PortfolioStreamConfig.md)

#### Returns

`PortfolioStreamManager`

## Methods

### addListener()

> **addListener**(`listener`): `void`

#### Parameters

##### listener

[`PortfolioStreamListener`](../interfaces/PortfolioStreamListener.md)

#### Returns

`void`

***

### dispose()

> **dispose**(): `void`

#### Returns

`void`

***

### forceRefresh()

> **forceRefresh**(): `Promise`\<`void`\>

Force an immediate HTTP portfolio fetch.
Rate-limited to once every 5 seconds.

#### Returns

`Promise`\<`void`\>

***

### getCachedPortfolio()

> **getCachedPortfolio**(`address`): `Promise`\<[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[] \| `null`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`PortfolioEntry`](../interfaces/PortfolioEntry.md)[] \| `null`\>

***

### getConnectionState()

> **getConnectionState**(): [`ConnectionState`](../type-aliases/ConnectionState.md)

#### Returns

[`ConnectionState`](../type-aliases/ConnectionState.md)

***

### getSnapshot()

> **getSnapshot**(`addresses?`): `Promise`\<\{ `connectionState`: [`ConnectionState`](../type-aliases/ConnectionState.md); `error?`: `string`; `portfolios`: `Record`\<`string`, [`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]\>; \}\>

Get a snapshot of cached portfolios for a set of addresses.

#### Parameters

##### addresses?

`string`[]

#### Returns

`Promise`\<\{ `connectionState`: [`ConnectionState`](../type-aliases/ConnectionState.md); `error?`: `string`; `portfolios`: `Record`\<`string`, [`PortfolioEntry`](../interfaces/PortfolioEntry.md)[]\>; \}\>

***

### isCurrentlyStreaming()

> **isCurrentlyStreaming**(): `boolean`

#### Returns

`boolean`

***

### removeListener()

> **removeListener**(`listener`): `void`

#### Parameters

##### listener

[`PortfolioStreamListener`](../interfaces/PortfolioStreamListener.md)

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

### triggerReplay()

> **triggerReplay**(): `Promise`\<`void`\>

Replay the current cache to all listeners without triggering a new subscription.

#### Returns

`Promise`\<`void`\>

***

### updateAddresses()

> **updateAddresses**(`addresses`): `Promise`\<`void`\>

#### Parameters

##### addresses

`string`[]

#### Returns

`Promise`\<`void`\>

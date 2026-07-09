[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / LookupNode

# Class: LookupNode

@totemsdk/lookup-node — public API

## Implements

- [`NodeDispatcher`](../interfaces/NodeDispatcher.md)

## Constructors

### Constructor

> **new LookupNode**(`config`): `LookupNode`

#### Parameters

##### config

[`LookupNodeConfig`](../interfaces/LookupNodeConfig.md)

#### Returns

`LookupNode`

## Properties

### agentRegistry?

> `readonly` `optional` **agentRegistry?**: [`AgentRegistry`](AgentRegistry.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`agentRegistry`](../interfaces/NodeDispatcher.md#agentregistry)

***

### appRegistry?

> `readonly` `optional` **appRegistry?**: [`AppRegistry`](AppRegistry.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`appRegistry`](../interfaces/NodeDispatcher.md#appregistry)

***

### config

> `readonly` **config**: [`LookupNodeConfig`](../interfaces/LookupNodeConfig.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`config`](../interfaces/NodeDispatcher.md#config)

***

### lease?

> `readonly` `optional` **lease?**: [`LeaseCoordinator`](LeaseCoordinator.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`lease`](../interfaces/NodeDispatcher.md#lease)

***

### nodeId

> **nodeId**: `string`

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`nodeId`](../interfaces/NodeDispatcher.md#nodeid)

***

### provider

> `readonly` **provider**: `ChainStateProvider`

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`provider`](../interfaces/NodeDispatcher.md#provider)

***

### relay?

> `readonly` `optional` **relay?**: [`TxPoWRelay`](TxPoWRelay.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`relay`](../interfaces/NodeDispatcher.md#relay)

***

### store

> `readonly` **store**: [`SqliteStore`](SqliteStore.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`store`](../interfaces/NodeDispatcher.md#store)

***

### trustIndex?

> `readonly` `optional` **trustIndex?**: [`TrustIndex`](TrustIndex.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`trustIndex`](../interfaces/NodeDispatcher.md#trustindex)

***

### watchlist

> `readonly` **watchlist**: [`WatchlistManager`](WatchlistManager.md)

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`watchlist`](../interfaces/NodeDispatcher.md#watchlist)

## Accessors

### isMegaMMRMode

#### Get Signature

> **get** **isMegaMMRMode**(): `boolean`

Whether this node is running in MegaMMR/indexer mode.
When true, the provider is expected to support wider chain-state queries
such as full balance indexing and chain-wide analytics endpoints.
The provider's `getCoins()` may be called without an address filter to
retrieve all coins from the indexer.

##### Returns

`boolean`

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`isMegaMMRMode`](../interfaces/NodeDispatcher.md#ismegammrmode)

***

### sessionCount

#### Get Signature

> **get** **sessionCount**(): `number`

##### Returns

`number`

## Methods

### getSessions()

> **getSessions**(): `ClientSession`[]

#### Returns

`ClientSession`[]

***

### handleConnection()

> **handleConnection**(`transport`): `ClientSession`

Register a new client connection.
In production: called for each Hyperswarm connection.
In tests: inject a TestTransport (see __tests__/helpers.ts).

#### Parameters

##### transport

[`ITransport`](../interfaces/ITransport.md)

#### Returns

`ClientSession`

***

### onSessionClosed()

> **onSessionClosed**(`sessionId`): `void`

#### Parameters

##### sessionId

`string`

#### Returns

`void`

#### Implementation of

[`NodeDispatcher`](../interfaces/NodeDispatcher.md).[`onSessionClosed`](../interfaces/NodeDispatcher.md#onsessionclosed)

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

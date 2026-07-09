[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / NodeDispatcher

# Interface: NodeDispatcher

## Properties

### agentRegistry?

> `readonly` `optional` **agentRegistry?**: [`AgentRegistry`](../classes/AgentRegistry.md)

***

### appRegistry?

> `readonly` `optional` **appRegistry?**: [`AppRegistry`](../classes/AppRegistry.md)

***

### config

> `readonly` **config**: [`LookupNodeConfig`](LookupNodeConfig.md)

***

### isMegaMMRMode

> **isMegaMMRMode**: `boolean`

***

### lease?

> `readonly` `optional` **lease?**: [`LeaseCoordinator`](../classes/LeaseCoordinator.md)

***

### nodeId

> **nodeId**: `string`

***

### provider

> `readonly` **provider**: `ChainStateProvider`

***

### relay?

> `readonly` `optional` **relay?**: [`TxPoWRelay`](../classes/TxPoWRelay.md)

***

### store?

> `readonly` `optional` **store?**: [`SqliteStore`](../classes/SqliteStore.md)

***

### trustIndex?

> `readonly` `optional` **trustIndex?**: [`TrustIndex`](../classes/TrustIndex.md)

***

### watchlist

> `readonly` **watchlist**: [`WatchlistManager`](../classes/WatchlistManager.md)

## Methods

### onSessionClosed()

> **onSessionClosed**(`sessionId`): `void`

#### Parameters

##### sessionId

`string`

#### Returns

`void`

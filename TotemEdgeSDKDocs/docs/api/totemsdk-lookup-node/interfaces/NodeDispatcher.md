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

### nodeIdentity

> `readonly` **nodeIdentity**: `NodeIdentity`

RFC-032-A: node WOTS identity (signs session tickets).

***

### provider

> `readonly` **provider**: `ChainStateProvider`

***

### relay?

> `readonly` `optional` **relay?**: [`TxPoWRelay`](../classes/TxPoWRelay.md)

***

### replayGuard

> `readonly` **replayGuard**: `ReplayGuard`

RFC-032: node-wide replay guard shared across sessions.

***

### store?

> `readonly` `optional` **store?**: [`SqliteStore`](../classes/SqliteStore.md)

***

### tickets

> `readonly` **tickets**: `SessionTicketStore`

RFC-032-A: session ticket store (lifetime/budget/seq).

***

### trustIndex?

> `readonly` `optional` **trustIndex?**: [`TrustIndex`](../classes/TrustIndex.md)

***

### watchlist

> `readonly` **watchlist**: [`WatchlistManager`](../classes/WatchlistManager.md)

## Methods

### checkIdentityRate()

> **checkIdentityRate**(`publicKeyHex`, `rpm`, `now?`): `boolean`

RFC-020 H11: per-identity rate limit that survives reconnects.

#### Parameters

##### publicKeyHex

`string` \| `undefined`

##### rpm

`number`

##### now?

`number`

#### Returns

`boolean`

***

### onSessionClosed()

> **onSessionClosed**(`sessionId`): `void`

#### Parameters

##### sessionId

`string`

#### Returns

`void`

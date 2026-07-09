[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / LookupNodeConfig

# Interface: LookupNodeConfig

## Properties

### agentRegistry?

> `optional` **agentRegistry?**: [`AgentRegistryConfig`](AgentRegistryConfig.md)

***

### appRegistry?

> `optional` **appRegistry?**: [`AppRegistryConfig`](AppRegistryConfig.md)

***

### challengeTtlMs?

> `optional` **challengeTtlMs?**: `number`

Auth challenge TTL in ms. Default: 30_000

***

### lease?

> `optional` **lease?**: [`LeaseConfig`](LeaseConfig.md)

***

### megammr?

> `optional` **megammr?**: [`MegaMMRConfig`](MegaMMRConfig.md)

MegaMMR / indexer mode — enables chain-wide GET_COINS without address filter.

***

### nodeId?

> `optional` **nodeId?**: `string`

Unique node identifier (hex string). Generated randomly if omitted.

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Block polling interval in ms. Default: 5_000

***

### provider

> **provider**: `ChainStateProvider`

Chain state source — PureMinimaRpcProvider or any ChainStateProvider

***

### rateLimitRpm?

> `optional` **rateLimitRpm?**: `number`

Max authenticated requests per minute per client. Default: 120

***

### relay?

> `optional` **relay?**: [`RelayConfig`](RelayConfig.md)

***

### sqlite?

> `optional` **sqlite?**: [`SqliteConfig`](SqliteConfig.md)

SQLite persistence. Defaults to ':memory:' (always SQLite, never plain Maps).

***

### trustIndex?

> `optional` **trustIndex?**: [`TrustIndexConfig`](TrustIndexConfig.md)

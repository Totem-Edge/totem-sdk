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

### authRequiredTypes?

> `optional` **authRequiredTypes?**: readonly `string`[]

RFC-032-A: message types that must carry a full WOTS `auth` envelope and may
NOT be authenticated by a session ticket alone. Defaults to the high-value
mutating families (LEASE_*, BROADCAST_TXPOW, TRUST_RECORD, *_ANNOUNCE).

***

### lease?

> `optional` **lease?**: [`LeaseConfig`](LeaseConfig.md)

***

### maxSessions?

> `optional` **maxSessions?**: `number`

RFC-020 H11: max concurrent sessions. Default: 64.

***

### megammr?

> `optional` **megammr?**: [`MegaMMRConfig`](MegaMMRConfig.md)

MegaMMR / indexer mode — enables chain-wide GET_COINS without address filter.

***

### nodeId?

> `optional` **nodeId?**: `string`

Unique node identifier (hex string). Generated randomly if omitted.

***

### nodeIdentityUses?

> `optional` **nodeIdentityUses?**: `number`

RFC-032-A: restore value for the node identity's WOTS use counter (tickets
signed so far). Persist `nodeIdentity.uses` and pass it back to avoid reusing
a signing leaf across restarts. Default 0.

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Block polling interval in ms. Default: 5_000

***

### provider

> **provider**: `ChainStateProvider`

Chain state source — MinimaRpcProvider or any ChainStateProvider

***

### rateLimitRpm?

> `optional` **rateLimitRpm?**: `number`

Max authenticated requests per minute per client. Default: 120

***

### relay?

> `optional` **relay?**: [`RelayConfig`](RelayConfig.md)

***

### sessionMaxRequests?

> `optional` **sessionMaxRequests?**: `number`

RFC-032-A: max requests per session ticket. Default: 1000

***

### sessionTtlMs?

> `optional` **sessionTtlMs?**: `number`

RFC-032-A: issued session-ticket lifetime in ms. Default: 60_000

***

### sqlite?

> `optional` **sqlite?**: [`SqliteConfig`](SqliteConfig.md)

SQLite persistence. Defaults to ':memory:' (always SQLite, never plain Maps).

***

### trustIndex?

> `optional` **trustIndex?**: [`TrustIndexConfig`](TrustIndexConfig.md)

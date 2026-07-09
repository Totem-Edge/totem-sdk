[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / OmniaSwarmConfig

# Interface: OmniaSwarmConfig

## Properties

### localPubkey?

> `optional` **localPubkey?**: `string`

The local node's 32-byte hex public key.
When provided, the swarm automatically calls `advertise(localPubkey)` on
construction so remote peers can discover and connect to us via
SHA3-256('omnia:peer:' + localPubkey).

***

### maxReconnectAttempts?

> `optional` **maxReconnectAttempts?**: `number`

Maximum reconnect attempts per peer before giving up.
Default: 5

***

### reconnectBaseDelayMs?

> `optional` **reconnectBaseDelayMs?**: `number`

Base delay in ms for reconnect exponential backoff.
Actual delay = baseDelay × 2^attempt (capped at 30 s).
Default: 500

***

### relay?

> `optional` **relay?**: [`RelayConfig`](../type-aliases/RelayConfig.md)

Relay transport configuration. Defaults to `{ mode: 'native' }` (raw
Hyperswarm). Set to `{ mode: 'hosted', apiKey: 'axia_...' }` to use
Axia's managed relay without needing the `hyperswarm` binary.

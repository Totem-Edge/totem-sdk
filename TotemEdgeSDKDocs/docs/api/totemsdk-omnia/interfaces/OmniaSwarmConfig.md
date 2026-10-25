[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / OmniaSwarmConfig

# Interface: OmniaSwarmConfig

## Properties

### bootstrap?

> `optional` **bootstrap?**: `string`[]

Native Hyperswarm only: override the DHT bootstrap nodes (`'host:port'`).
Useful for an isolated/local DHT in tests. Defaults to the public DHT.

***

### host?

> `optional` **host?**: `string`

Native Hyperswarm only: local interface to bind/announce (e.g. a specific
LAN/VPN address in a multi-homed or namespace setup). Defaults to all.

***

### keyPair?

> `optional` **keyPair?**: `object`

Native Hyperswarm only: stable ed25519 keypair for the transport identity.
When omitted, Hyperswarm generates an ephemeral one.

#### publicKey

> **publicKey**: `Uint8Array`

#### secretKey

> **secretKey**: `Uint8Array`

***

### localPubkey?

> `optional` **localPubkey?**: `string`

***

### maxReconnectAttempts?

> `optional` **maxReconnectAttempts?**: `number`

***

### port?

> `optional` **port?**: `number`

Native Hyperswarm only: local UDP port. Defaults to an ephemeral port.

***

### reconnectBaseDelayMs?

> `optional` **reconnectBaseDelayMs?**: `number`

***

### relay?

> `optional` **relay?**: [`RelayConfig`](../type-aliases/RelayConfig.md)

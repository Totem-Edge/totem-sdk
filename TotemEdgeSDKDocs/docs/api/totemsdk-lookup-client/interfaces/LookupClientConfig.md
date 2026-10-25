[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupClientConfig

# Interface: LookupClientConfig

## Properties

### address?

> `optional` **address?**: `string`

RFC-032: optional Minima address (trusted only when the proof verifies).

***

### authRequiredTypes?

> `optional` **authRequiredTypes?**: readonly `string`[]

RFC-032-A: message types that must always carry a full WOTS envelope.

***

### authTtlMs?

> `optional` **authTtlMs?**: `number`

RFC-032: auth envelope TTL in ms. Default 60_000.

***

### hyperswarmTopic?

> `optional` **hyperswarmTopic?**: `string`

Hex-encoded 32-byte Hyperswarm topic key (64 hex chars). Primary P2P transport.

***

### identity?

> `optional` **identity?**: [`LookupIdentity`](../classes/LookupIdentity.md)

RFC-032: pre-built identity (takes precedence over `identitySeed`).

***

### identityOptions?

> `optional` **identityOptions?**: [`LookupIdentityOptions`](LookupIdentityOptions.md)

RFC-032: identity derivation options (address index, resume uses).

***

### identitySeed?

> `optional` **identitySeed?**: `Uint8Array`\<`ArrayBufferLike`\>

RFC-032: 32-byte seed for the post-quantum (WOTS/TreeKey) lookup identity.
Defaults to an all-zero seed for tests; production callers should derive
this from `@totemsdk/root-identity`. Ignored when `identity` is provided.

***

### identitySlot?

> `optional` **identitySlot?**: [`IdentitySlot`](../type-aliases/IdentitySlot.md)

RFC-032: wallet slot (`'root'` or child index). Default `'root'`.

***

### identityWallet?

> `optional` **identityWallet?**: `UnifiedIdentityWallet`

RFC-032 §9 Q1: use a `@totemsdk/root-identity` `UnifiedIdentityWallet` as the
lookup identity (its root key by default). Takes precedence over
`identitySeed` but not over `identity`. Persist the wallet's watermark so
the one-time counter survives restarts.

***

### nodeUrl?

> `optional` **nodeUrl?**: `string`

Direct HTTP/WS URL fallback — used when Hyperswarm is unavailable.
 The client will convert http(s):// to ws(s):// automatically.

***

### reconnectBaseMs?

> `optional` **reconnectBaseMs?**: `number`

Initial reconnect backoff delay in ms. Default: 1_000.

***

### reconnectMaxMs?

> `optional` **reconnectMaxMs?**: `number`

Maximum reconnect backoff delay in ms. Default: 30_000.

***

### rootIdentityProof?

> `optional` **rootIdentityProof?**: `string`

RFC-032: optional root-identity proof binding (verified by the node).

***

### sessionTtlMs?

> `optional` **sessionTtlMs?**: `number`

RFC-032-A: requested session-ticket lifetime in ms (node clamps).

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Per-request timeout in milliseconds. Default: 10_000.

***

### useSessionTickets?

> `optional` **useSessionTickets?**: `boolean`

RFC-032-A: open a session on connect and reuse a node-issued ticket for
non-high-value messages (amortises WOTS use). Default false (per-message WOTS).

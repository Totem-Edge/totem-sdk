[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / AuthenticatorOptions

# Interface: AuthenticatorOptions

## Properties

### address?

> `optional` **address?**: `string`

Optional Minima address (only trusted by the node when the proof verifies).

***

### authRequiredTypes?

> `optional` **authRequiredTypes?**: readonly `string`[]

RFC-032-A: message types that always require a full WOTS envelope.

***

### identity

> **identity**: [`LookupIdentity`](../classes/LookupIdentity.md)

***

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### rootIdentityProof?

> `optional` **rootIdentityProof?**: `string`

Optional root-identity proof binding (RFC-032 §5.1.1).

***

### sessionTtlMs?

> `optional` **sessionTtlMs?**: `number`

RFC-032-A: requested ticket lifetime (node clamps).

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Auth envelope TTL in ms. Default [DEFAULT\_AUTH\_TTL\_MS](../variables/DEFAULT_AUTH_TTL_MS.md).

***

### useTickets?

> `optional` **useTickets?**: `boolean`

RFC-032-A: request a session ticket on connect and use it (instead of
per-message WOTS) for non-high-value messages. Default false until the
caller has performed a SESSION_OPEN.

[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PrincipalNegotiationStore

# Interface: PrincipalNegotiationStore

Per-principal anti-abuse accounting.

Concurrent negotiations, cooldown, and window counts must not reset
trivially on process restart. This is protocol admission accounting only —
NOT a global reputation system.

`tryOpen` is ATOMIC: checking limits and consuming capacity is one
operation. Two negotiations cannot simultaneously inspect a limit, both
decide admission is allowed, then both record themselves and exceed it.

## Methods

### close()

> **close**(`principal`, `negotiationId`): `Promise`\<`void`\>

Atomically release capacity for a principal for a specific negotiation.
Safe to call multiple times (no double-release).

#### Parameters

##### principal

`string`

##### negotiationId

`string`

#### Returns

`Promise`\<`void`\>

***

### getCooldownUntil()

> **getCooldownUntil**(`principal`): `Promise`\<`number`\>

Get the cooldown-until timestamp for a principal (0 = none).

#### Parameters

##### principal

`string`

#### Returns

`Promise`\<`number`\>

***

### reconcile()

> **reconcile**(`principal`, `activeNegotiationIds`): `Promise`\<`void`\>

Reconcile open slots against the set of still-active negotiation IDs.
Any slot whose negotiation is terminal, expired, or no longer present is
released. This is the recovery hook that prevents capacity leaks when a
process crashes before close().

#### Parameters

##### principal

`string`

##### activeNegotiationIds

`string`[]

#### Returns

`Promise`\<`void`\>

***

### setCooldownUntil()

> **setCooldownUntil**(`principal`, `until`): `Promise`\<`void`\>

Set the cooldown-until timestamp for a principal.

#### Parameters

##### principal

`string`

##### until

`number`

#### Returns

`Promise`\<`void`\>

***

### tryOpen()

> **tryOpen**(`principal`, `negotiationId`, `now`, `limits`): `Promise`\<\{ `allowed`: `true`; \} \| \{ `allowed`: `false`; `reason`: `"CONCURRENCY_LIMIT"` \| `"COOLDOWN"` \| `"WINDOW_LIMIT"`; \}\>

Atomically check limits AND consume capacity. Returns `{ allowed: true }`
when the principal may open a negotiation, or a typed rejection reason.

Each consumed slot is bound to its `negotiationId` so recovery can
reconcile open slots against actual negotiation records — a crashed
process cannot leak capacity permanently.

#### Parameters

##### principal

`string`

##### negotiationId

`string`

##### now

`number`

##### limits

###### cooldownMs

`number`

###### maxConcurrentNegotiations

`number`

###### maxNegotiationsPerWindow

`number`

###### windowMs

`number`

#### Returns

`Promise`\<\{ `allowed`: `true`; \} \| \{ `allowed`: `false`; `reason`: `"CONCURRENCY_LIMIT"` \| `"COOLDOWN"` \| `"WINDOW_LIMIT"`; \}\>

[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / InMemoryPrincipalNegotiationStore

# Class: InMemoryPrincipalNegotiationStore

In-memory principal anti-abuse store. No crash guarantees — dev/test only.

## Implements

- [`PrincipalNegotiationStore`](../interfaces/PrincipalNegotiationStore.md)

## Constructors

### Constructor

> **new InMemoryPrincipalNegotiationStore**(): `InMemoryPrincipalNegotiationStore`

#### Returns

`InMemoryPrincipalNegotiationStore`

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

#### Implementation of

[`PrincipalNegotiationStore`](../interfaces/PrincipalNegotiationStore.md).[`close`](../interfaces/PrincipalNegotiationStore.md#close)

***

### getCooldownUntil()

> **getCooldownUntil**(`principal`): `Promise`\<`number`\>

Get the cooldown-until timestamp for a principal (0 = none).

#### Parameters

##### principal

`string`

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`PrincipalNegotiationStore`](../interfaces/PrincipalNegotiationStore.md).[`getCooldownUntil`](../interfaces/PrincipalNegotiationStore.md#getcooldownuntil)

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

#### Implementation of

[`PrincipalNegotiationStore`](../interfaces/PrincipalNegotiationStore.md).[`reconcile`](../interfaces/PrincipalNegotiationStore.md#reconcile)

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

#### Implementation of

[`PrincipalNegotiationStore`](../interfaces/PrincipalNegotiationStore.md).[`setCooldownUntil`](../interfaces/PrincipalNegotiationStore.md#setcooldownuntil)

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

#### Implementation of

[`PrincipalNegotiationStore`](../interfaces/PrincipalNegotiationStore.md).[`tryOpen`](../interfaces/PrincipalNegotiationStore.md#tryopen)

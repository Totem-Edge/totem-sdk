[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PrincipalLimits

# Interface: PrincipalLimits

Per-principal anti-abuse limits.

Keyed on the authenticated principal/root identity, never on an arbitrary
child agentId.

## Properties

### cooldownMs?

> `optional` **cooldownMs?**: `number`

***

### maxConcurrentNegotiations?

> `optional` **maxConcurrentNegotiations?**: `number`

***

### maxNegotiationsPerWindow?

> `optional` **maxNegotiationsPerWindow?**: `number`

***

### windowMs?

> `optional` **windowMs?**: `number`

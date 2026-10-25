[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / CreateEdgeDecisionPortOptions

# Interface: CreateEdgeDecisionPortOptions

## Properties

### capabilities?

> `readonly` `optional` **capabilities?**: readonly [`DecisionCapability`](../type-aliases/DecisionCapability.md)[]

Advertised capabilities. Defaults to the runtime's actual capabilities; an
override may narrow that set but must not expand it.

***

### runtimeId?

> `readonly` `optional` **runtimeId?**: `string`

Stable runtime id. Defaults to `'decision'`.

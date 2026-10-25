[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionClientQuestion

# Interface: DecisionClientQuestion

## Properties

### candidates?

> `readonly` `optional` **candidates?**: readonly `TypedBackendCandidate`[]

***

### goal?

> `readonly` `optional` **goal?**: `string`

Action goal, when the question is an action head (RFC-012 §24).

***

### id

> `readonly` **id**: `string`

***

### instruction?

> `readonly` `optional` **instruction?**: `string`

***

### operation?

> `readonly` `optional` **operation?**: `TypedBackendOperation`

The operation this head selects for / belongs to, when applicable.

***

### proposition?

> `readonly` `optional` **proposition?**: `string`

***

### rubric?

> `readonly` `optional` **rubric?**: readonly `TypedBackendCandidate`[]

***

### type

> `readonly` **type**: `string`

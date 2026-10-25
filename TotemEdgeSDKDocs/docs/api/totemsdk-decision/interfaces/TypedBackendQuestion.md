[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / TypedBackendQuestion

# Interface: TypedBackendQuestion

A backend question in canonical form. Preserves the full semantic request
(instruction, descriptions, metadata, action goal/operations/targets) so
provider adapters format their native shape from complete information rather
than from bare IDs.

## Properties

### action?

> `readonly` `optional` **action?**: `TypedBackendAction`

***

### candidates?

> `readonly` `optional` **candidates?**: readonly `TypedBackendCandidate`[]

***

### id

> `readonly` **id**: `string`

***

### instruction?

> `readonly` `optional` **instruction?**: `string`

***

### proposition?

> `readonly` `optional` **proposition?**: `string`

***

### rubric?

> `readonly` `optional` **rubric?**: readonly `TypedBackendCandidate`[]

Ordered increasing.

***

### type

> `readonly` **type**: [`DecisionType`](../type-aliases/DecisionType.md)

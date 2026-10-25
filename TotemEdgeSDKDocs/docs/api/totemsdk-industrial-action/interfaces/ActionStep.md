[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ActionStep

# Interface: ActionStep

## Properties

### compensation?

> `optional` **compensation?**: `ActionStep`

Compensating step (saga rollback) run if a later step fails.

***

### definition

> **definition**: `string`

Industrial action kind (registered with the edge action registry).

***

### dependsOn?

> `optional` **dependsOn?**: `string`[]

Step ids that must complete before this step starts.

***

### id

> **id**: `string`

***

### params?

> `optional` **params?**: `Record`\<`string`, `unknown`\>

***

### when?

> `optional` **when?**: [`Condition`](Condition.md)[]

Conditional inclusion: skipped when any condition fails.

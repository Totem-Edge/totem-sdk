[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionRoute

# Interface: DecisionRoute

## Properties

### accept?

> `readonly` `optional` **accept?**: [`DecisionAcceptanceRule`](DecisionAcceptanceRule.md)

***

### escalateOnTimeout?

> `readonly` `optional` **escalateOnTimeout?**: `boolean`

Escalate to the next route after a **route timeout**. Defaults to `true`.
Caller cancellation is always terminal and never escalates (RFC-012 §27).

***

### maxCandidatesPerQuestion?

> `readonly` `optional` **maxCandidatesPerQuestion?**: `number`

***

### maxOperations?

> `readonly` `optional` **maxOperations?**: `number`

***

### maxQuestions?

> `readonly` `optional` **maxQuestions?**: `number`

***

### maxStateBytes?

> `readonly` `optional` **maxStateBytes?**: `number`

***

### maxTargetsPerOperation?

> `readonly` `optional` **maxTargetsPerOperation?**: `number`

***

### provider

> `readonly` **provider**: `string` \| [`DecisionProvider`](DecisionProvider.md)

A provider instance, or a provider id resolving into `providers`.

***

### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

***

### types?

> `readonly` `optional` **types?**: readonly [`DecisionType`](../type-aliases/DecisionType.md)[]

Restrict this route to specific decision types.

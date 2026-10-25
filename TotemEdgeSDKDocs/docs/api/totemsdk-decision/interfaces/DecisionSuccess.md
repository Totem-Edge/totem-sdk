[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionSuccess

# Interface: DecisionSuccess\<T\>

A decision success — a proposal, never an authorization.

## Type Parameters

### T

`T` = [`DecisionResult`](../type-aliases/DecisionResult.md)

## Properties

### attempts

> `readonly` **attempts**: readonly [`DecisionAttempt`](DecisionAttempt.md)[]

***

### bindings

> `readonly` **bindings**: [`DecisionBindings`](DecisionBindings.md)

***

### confidence?

> `readonly` `optional` **confidence?**: `number`

Aggregate confidence (min across answers when batched). `undefined` if unknown.

***

### decision

> `readonly` **decision**: `T`

***

### ok

> `readonly` **ok**: `true`

***

### provenance?

> `readonly` `optional` **provenance?**: [`DecisionProvenance`](DecisionProvenance.md)

Call-specific provider provenance (underlying model/runtime), if reported.

***

### provider

> `readonly` **provider**: [`DecisionProviderRef`](DecisionProviderRef.md)

***

### rawProviderOutput?

> `readonly` `optional` **rawProviderOutput?**: `unknown`

Raw provider output, only when `includeRawProviderOutput` is enabled.

***

### receipt

> `readonly` **receipt**: [`DecisionReceipt`](DecisionReceipt.md)

***

### requestId

> `readonly` **requestId**: `string`

***

### upstreamRequestId?

> `readonly` `optional` **upstreamRequestId?**: `string`

Provider-side (upstream) request id, when reported.

***

### usage?

> `readonly` `optional` **usage?**: [`DecisionUsage`](DecisionUsage.md)

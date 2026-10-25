[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionProviderSuccess

# Interface: DecisionProviderSuccess\<T\>

A provider's proposed decision. Contains **no** runtime bindings, receipt, or
attempt history — those are runtime constructs.

## Type Parameters

### T

`T` = [`DecisionResult`](../type-aliases/DecisionResult.md)

## Properties

### confidence?

> `readonly` `optional` **confidence?**: [`DecisionConfidence`](DecisionConfidence.md)

***

### decision

> `readonly` **decision**: `T`

***

### ok

> `readonly` **ok**: `true`

***

### provenance?

> `readonly` `optional` **provenance?**: [`DecisionProvenance`](DecisionProvenance.md)

***

### rawProviderOutput?

> `readonly` `optional` **rawProviderOutput?**: `unknown`

Only populated when explicitly requested.

***

### requestId

> `readonly` **requestId**: `string`

***

### upstreamRequestId?

> `readonly` `optional` **upstreamRequestId?**: `string`

***

### usage?

> `readonly` `optional` **usage?**: [`DecisionUsage`](DecisionUsage.md)

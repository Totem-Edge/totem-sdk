[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceResult

# Interface: IntelligenceResult\<T\>

Successful result of an intelligence operation.

## Type Parameters

### T

`T` = `unknown`

## Properties

### data

> `readonly` **data**: `T`

***

### ok

> `readonly` **ok**: `true`

***

### receipt?

> `readonly` `optional` **receipt?**: `unknown`

***

### requestId

> `readonly` **requestId**: `string`

***

### upstreamRequestId?

> `readonly` `optional` **upstreamRequestId?**: `string`

The provider-side (upstream) request id, when the wrapped runtime is
cancellable by id — e.g. `@qvac/sdk` decorates promises/run objects with
a `requestId` that its own `cancel({ requestId })` targets.

***

### usage?

> `readonly` `optional` **usage?**: [`IntelligenceUsage`](IntelligenceUsage.md)

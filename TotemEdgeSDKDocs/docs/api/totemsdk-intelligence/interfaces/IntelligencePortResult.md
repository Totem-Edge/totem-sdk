[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligencePortResult

# Interface: IntelligencePortResult\<T\>

Port-facing result shape used by [EdgeIntelligencePort](EdgeIntelligencePort.md).

Mirrors @totemsdk/edge's `EdgeOperationResult` so the port stays
host-agnostic; created by ../port.ts!createEdgeIntelligencePort.

## Type Parameters

### T

`T` = `unknown`

## Properties

### data?

> `optional` **data?**: `T`

***

### error?

> `optional` **error?**: `string`

***

### errorCode?

> `optional` **errorCode?**: `string`

***

### ok

> **ok**: `boolean`

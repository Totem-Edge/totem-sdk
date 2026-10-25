[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / ContextValue

# Interface: ContextValue\<T\>

Context value with observation metadata. Required when a schema field
declares `maxAgeMs`, so freshness is enforced deterministically.

## Type Parameters

### T

`T` = `unknown`

## Properties

### observedAt

> **observedAt**: `number`

***

### proofId?

> `optional` **proofId?**: `string`

***

### source?

> `optional` **source?**: `string`

***

### value

> **value**: `T`

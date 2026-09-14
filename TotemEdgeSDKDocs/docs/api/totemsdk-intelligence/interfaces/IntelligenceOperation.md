[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceOperation

# Interface: IntelligenceOperation\<T\>

A single provider-neutral inference operation.

`params` is intentionally `Record<string, unknown>` at the contract level;
each provider adapter narrows it to its domain's typed parameter set.

## Type Parameters

### T

`T` = `unknown`

## Properties

### context?

> `readonly` `optional` **context?**: [`IntelligenceContext`](IntelligenceContext.md)

***

### domain

> `readonly` **domain**: [`IntelligenceDomainOrString`](../type-aliases/IntelligenceDomainOrString.md)

***

### op

> `readonly` **op**: `string`

***

### params

> `readonly` **params**: `Record`\<`string`, `unknown`\>

***

### requestId?

> `readonly` `optional` **requestId?**: `string`

***

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

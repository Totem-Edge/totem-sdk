[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceStreamOperation

# Interface: IntelligenceStreamOperation

Streaming operation shape — the provider decides the chunk vocabulary.

## Properties

### context?

> `readonly` `optional` **context?**: [`IntelligenceContext`](IntelligenceContext.md)

***

### domain

> `readonly` **domain**: [`IntelligenceDomainOrString`](../type-aliases/IntelligenceDomainOrString.md)

***

### onChunk?

> `readonly` `optional` **onChunk?**: ((`chunk`) => `void`) \| ((`partial`, `kind?`) => `void`)

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

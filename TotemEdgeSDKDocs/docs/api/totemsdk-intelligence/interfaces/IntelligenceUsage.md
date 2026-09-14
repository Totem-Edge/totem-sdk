[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceUsage

# Interface: IntelligenceUsage

Usage metering for a single inference operation.

The unit of consumption is provider-specific. `@totemsdk/qvac` reports
tokens and milliseconds; other providers may report their own units.
Policy layers convert this into budget spend.

## Properties

### domain

> `readonly` **domain**: [`IntelligenceDomainOrString`](../type-aliases/IntelligenceDomainOrString.md)

***

### durationMs?

> `readonly` `optional` **durationMs?**: `number`

***

### metadata?

> `readonly` `optional` **metadata?**: `Record`\<`string`, `string` \| `number`\>

***

### model?

> `readonly` `optional` **model?**: `string`

***

### op

> `readonly` **op**: `string`

***

### tokensIn?

> `readonly` `optional` **tokensIn?**: `number`

***

### tokensOut?

> `readonly` `optional` **tokensOut?**: `number`

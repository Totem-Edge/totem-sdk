[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / ChoiceAnswer

# Interface: ChoiceAnswer

## Properties

### complete?

> `readonly` `optional` **complete?**: `boolean`

When true, `probabilities` must cover the candidate set and sum ≈ 1.

***

### confidence?

> `readonly` `optional` **confidence?**: [`DecisionConfidence`](DecisionConfidence.md)

***

### probabilities?

> `readonly` `optional` **probabilities?**: `Record`\<`string`, `number`\>

Partial or complete distribution. Never padded or renormalized silently.

***

### questionId

> `readonly` **questionId**: `string`

***

### selected

> `readonly` **selected**: `string`

***

### type

> `readonly` **type**: `"choice"`

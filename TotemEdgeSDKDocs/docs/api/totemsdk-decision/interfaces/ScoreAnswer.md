[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / ScoreAnswer

# Interface: ScoreAnswer

## Properties

### complete?

> `readonly` `optional` **complete?**: `boolean`

When true, `distribution` must cover the rubric and sum ≈ 1.

***

### confidence?

> `readonly` `optional` **confidence?**: [`DecisionConfidence`](DecisionConfidence.md)

***

### distribution?

> `readonly` `optional` **distribution?**: `Record`\<`string`, `number`\>

***

### expectedScore?

> `readonly` `optional` **expectedScore?**: `number`

Zero-based expectation over rubric order:
`Σ index(criterion) · P(criterion)`.

***

### questionId

> `readonly` **questionId**: `string`

***

### selected

> `readonly` **selected**: `string`

***

### type

> `readonly` **type**: `"score"`

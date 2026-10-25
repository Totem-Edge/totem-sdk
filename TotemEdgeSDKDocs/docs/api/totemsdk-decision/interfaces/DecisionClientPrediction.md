[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionClientPrediction

# Interface: DecisionClientPrediction

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### calibrated?

> `readonly` `optional` **calibrated?**: `boolean`

***

### complete?

> `readonly` `optional` **complete?**: `boolean`

When true, `probabilities`/`distribution` covers the candidate set and sums ≈ 1.

***

### confidence?

> `readonly` `optional` **confidence?**: `number`

***

### distribution?

> `readonly` `optional` **distribution?**: `Record`\<`string`, `number`\>

***

### expectedScore?

> `readonly` `optional` **expectedScore?**: `number`

***

### probabilities?

> `readonly` `optional` **probabilities?**: `Record`\<`string`, `number`\>

***

### probability?

> `readonly` `optional` **probability?**: `number`

***

### selected?

> `readonly` `optional` **selected?**: `string`

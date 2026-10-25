[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / ActionAnswer

# Interface: ActionAnswer

## Properties

### ~~confidence?~~

> `readonly` `optional` **confidence?**: [`DecisionConfidence`](DecisionConfidence.md)

#### Deprecated

0.x alias for [ActionAnswer.operationConfidence](#operationconfidence).

***

### operation

> `readonly` **operation**: `string`

***

### operationConfidence?

> `readonly` `optional` **operationConfidence?**: [`DecisionConfidence`](DecisionConfidence.md)

Operation confidence. `confidence` is the 0.x alias retained for
compatibility; prefer this field.

***

### operationProbabilities?

> `readonly` `optional` **operationProbabilities?**: `Record`\<`string`, `number`\>

***

### operationProbabilitiesComplete?

> `readonly` `optional` **operationProbabilitiesComplete?**: `boolean`

When true, `operationProbabilities` covers every operation and sums ≈ 1.

***

### target?

> `readonly` `optional` **target?**: `string`

Present only when a target-bearing operation was selected.

***

### targetConfidence?

> `readonly` `optional` **targetConfidence?**: [`DecisionConfidence`](DecisionConfidence.md)

Target-head confidence. Distinct from the target *probability* — a target
head can be uncertain (low probability) yet high-confidence, or vice versa.

***

### targetProbabilities?

> `readonly` `optional` **targetProbabilities?**: `Record`\<`string`, `number`\>

***

### targetProbabilitiesComplete?

> `readonly` `optional` **targetProbabilitiesComplete?**: `boolean`

When true, `targetProbabilities` covers every target and sums ≈ 1.

***

### type

> `readonly` **type**: `"action"`

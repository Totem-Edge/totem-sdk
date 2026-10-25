[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / TypedBackendPrediction

# Interface: TypedBackendPrediction

## Properties

### calibrated?

> `readonly` `optional` **calibrated?**: `boolean`

***

### complete?

> `readonly` `optional` **complete?**: `boolean`

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

### operation?

> `readonly` `optional` **operation?**: `string`

***

### operationProbabilities?

> `readonly` `optional` **operationProbabilities?**: `Record`\<`string`, `number`\>

***

### probabilities?

> `readonly` `optional` **probabilities?**: `Record`\<`string`, `number`\>

***

### probabilityTrue?

> `readonly` `optional` **probabilityTrue?**: `number`

***

### selected?

> `readonly` `optional` **selected?**: `string`

***

### target?

> `readonly` `optional` **target?**: `string`

***

### targetHeads?

> `readonly` `optional` **targetHeads?**: `Record`\<`string`, \{ `calibrated?`: `boolean`; `complete?`: `boolean`; `confidence?`: `number`; `probabilities?`: `Record`\<`string`, `number`\>; `probability?`: `number`; `target`: `string`; \}\>

One target head per operation key. Only the selected operation's head is used.

***

### targetProbabilities?

> `readonly` `optional` **targetProbabilities?**: `Record`\<`string`, `number`\>

***

### type

> `readonly` **type**: [`DecisionType`](../type-aliases/DecisionType.md)

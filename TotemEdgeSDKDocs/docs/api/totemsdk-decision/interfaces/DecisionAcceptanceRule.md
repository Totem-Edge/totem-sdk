[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionAcceptanceRule

# Interface: DecisionAcceptanceRule

Built-in acceptance rules. Acceptance answers only "is this good enough to
become the `DecisionResult`?" — never "may this happen?".

## Properties

### maxEntropy?

> `readonly` `optional` **maxEntropy?**: `number`

Maximum **normalized** Shannon entropy in `[0,1]`. Applies only when the
distribution is complete.

***

### minConfidence?

> `readonly` `optional` **minConfidence?**: `number`

Every answer (batched) must meet the threshold.

***

### minOperationConfidence?

> `readonly` `optional` **minOperationConfidence?**: `number`

Action: minimum operation confidence.

***

### minOperationProbability?

> `readonly` `optional` **minOperationProbability?**: `number`

Action: minimum probability of the selected operation.

***

### minSelectedProbability?

> `readonly` `optional` **minSelectedProbability?**: `number`

Selected-candidate probability threshold. Questions: the selected
candidate. Action: the selected operation **and**, when a target exists,
the selected target (never just the operation).

***

### minTargetConfidence?

> `readonly` `optional` **minTargetConfidence?**: `number`

Action: minimum target confidence (ignored when no target is required).

***

### minTargetProbability?

> `readonly` `optional` **minTargetProbability?**: `number`

Action: minimum probability of the selected target (ignored when no target is required).

***

### predicate?

> `readonly` `optional` **predicate?**: (`context`) => `boolean` \| [`DecisionAcceptanceEvaluation`](DecisionAcceptanceEvaluation.md)

Custom predicate. Returns boolean or a full evaluation.

#### Parameters

##### context

[`DecisionAcceptanceContext`](DecisionAcceptanceContext.md)

#### Returns

`boolean` \| [`DecisionAcceptanceEvaluation`](DecisionAcceptanceEvaluation.md)

***

### requireProbabilities?

> `readonly` `optional` **requireProbabilities?**: `boolean`

Require explicit probabilities. Questions: each choice question. Action:
the operation distribution **and** the target distribution when a target
exists.

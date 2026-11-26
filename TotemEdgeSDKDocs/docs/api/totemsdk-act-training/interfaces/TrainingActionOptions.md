[**@totemsdk/act-training**](../index.md)

***

[@totemsdk/act-training](../index.md) / TrainingActionOptions

# Interface: TrainingActionOptions

## Properties

### actionKind?

> `readonly` `optional` **actionKind?**: `string`

Defaults to `intelligence:train`.

***

### capability?

> `readonly` `optional` **capability?**: `EdgeCapability`

Defaults to `intelligence:llm:finetune`.

***

### plans

> `readonly` **plans**: `Readonly`\<`Record`\<`string`, [`TrainingPlan`](TrainingPlan.md)\>\>

Host-owned plans, keyed by plan id.

***

### port

> `readonly` **port**: `TrainingPort`

Provider-neutral training port (QVAC is one implementation).

***

### resourceId

> `readonly` **resourceId**: `string`

Approved host/resource pool used for compute effects.

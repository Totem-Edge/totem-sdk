[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / StepEffects

# Interface: StepEffects

## Properties

### channels?

> `optional` **channels?**: [`ChannelEffect`](ChannelEffect.md)[]

***

### compute?

> `optional` **compute?**: [`ComputeEffect`](ComputeEffect.md)[]

RFC-077 §8: compute resources (not financial cost).

***

### fees?

> `optional` **fees?**: [`StepEffect`](StepEffect.md)[]

***

### physical?

> `optional` **physical?**: [`PhysicalEffects`](PhysicalEffects.md)

RFC-023: typed physical effects derived from the prepared command.

***

### spends

> **spends**: [`StepEffect`](StepEffect.md)[]

***

### stateChanges?

> `optional` **stateChanges?**: `Record`\<`string`, `unknown`\>

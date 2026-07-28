[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildPrevStateWorkflow

# Function: buildPrevStateWorkflow()

> **buildPrevStateWorkflow**(`id`, `name`, `transitions`, `additionalScript?`): [`PrevStateWorkflow`](../interfaces/PrevStateWorkflow.md)

Build a complete PREVSTATE workflow from a list of transitions.

## Parameters

### id

`string`

Workflow identifier.

### name

`string`

Human-readable name.

### transitions

[`StateTransition`](../interfaces/StateTransition.md)[]

Ordered list of state transitions.

### additionalScript?

`string` = `''`

Additional KISSVM script logic (assertions, verifications).

## Returns

[`PrevStateWorkflow`](../interfaces/PrevStateWorkflow.md)

[**@totemsdk/act-training**](../index.md)

***

[@totemsdk/act-training](../index.md) / TrainingPlan

# Interface: TrainingPlan

Host-owned, reviewed plan for one training run. The agent selects a plan by
id; it never supplies or mutates the descriptor, collection or envelope.

## Properties

### descriptor

> `readonly` **descriptor**: `TrainingRunDescriptorV1`

***

### planId

> `readonly` **planId**: `string`

***

### resourceEnvelope

> `readonly` **resourceEnvelope**: `ComputeEffect`

***

### trainingExampleIds

> `readonly` **trainingExampleIds**: readonly `string`[]

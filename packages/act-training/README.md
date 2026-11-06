# @totemsdk/act-training

Governed training action for Totem. Binds a frozen
`TrainingRunDescriptorV1` to the `@totemsdk/act-core` lifecycle and dispatches
through a provider-neutral `TrainingPort`.

This package is the Act boundary for RFC-077. It does **not** train a model
itself, does not depend on QVAC, and does not certify a model. QVAC (or another
provider) implements `TrainingPort` behind the governed action.

## What it provides

- `createTrainingActionDefinitions({ plans, port, resourceId })`
- `TrainingPlan` (host-owned descriptor + training examples + compute envelope)
- compute/duration effects derived from the prepared plan
- accepted/confirmed/failed reconciliation through the training port
- cancellation through the training port

The action requires `intelligence:llm:finetune`, not the broader
`intelligence:llm` domain capability. Agents receive the registered action
through `AgentEdgeRuntime.executeAction`; they never receive the plan map or
the `TrainingPort`.

## Status

Slice/G1 implementation. No model-quality or production-training claim is
made. Real QVAC training remains gated on provider and hardware evidence.

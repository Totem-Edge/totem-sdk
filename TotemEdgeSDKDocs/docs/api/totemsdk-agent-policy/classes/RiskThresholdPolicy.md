[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RiskThresholdPolicy

# Class: RiskThresholdPolicy

A single composable middleware layer in the policy evaluation pipeline.

Each middleware receives the full AgentProposal and returns a decision.
Evaluation is read-only. Implementors that need state (rate limits, daily
caps) expose the optional reservation lifecycle below.

The middleware API replaces the boolean-based AgentPolicy with a richer
three-state result that includes a reason string for auditability.

## Implements

- [`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)

## Constructors

### Constructor

> **new RiskThresholdPolicy**(`maxRisk`): `RiskThresholdPolicy`

#### Parameters

##### maxRisk

`"low"` \| `"medium"` \| `"high"`

#### Returns

`RiskThresholdPolicy`

## Methods

### evaluate()

> **evaluate**(`proposal`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`evaluate`](../interfaces/PolicyMiddleware.md#evaluate)

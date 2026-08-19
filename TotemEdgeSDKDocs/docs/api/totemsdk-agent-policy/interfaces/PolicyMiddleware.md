[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / PolicyMiddleware

# Interface: PolicyMiddleware

A single composable middleware layer in the policy evaluation pipeline.

Each middleware receives the full AgentProposal and returns a decision.
Evaluation is read-only. Implementors that need state (rate limits, daily
caps) expose the optional reservation lifecycle below.

The middleware API replaces the boolean-based AgentPolicy with a richer
three-state result that includes a reason string for auditability.

## Methods

### commit()?

> `optional` **commit**(`operationId`): `Promise`\<`void`\>

Commit a prior reservation after execution succeeds.

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

***

### evaluate()

> **evaluate**(`proposal`): `Promise`\<[`PolicyEvalResult`](PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](AgentProposal.md)

#### Returns

`Promise`\<[`PolicyEvalResult`](PolicyEvalResult.md)\>

***

### release()?

> `optional` **release**(`operationId`): `Promise`\<`void`\>

Release a prior reservation after execution fails or is cancelled.

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

***

### reserve()?

> `optional` **reserve**(`proposal`): `Promise`\<[`PolicyEvalResult`](PolicyEvalResult.md)\>

Reserve state for execution using `proposal.id` as the idempotency key.
Implementations must not consume committed quota during evaluation.

#### Parameters

##### proposal

[`AgentProposal`](AgentProposal.md)

#### Returns

`Promise`\<[`PolicyEvalResult`](PolicyEvalResult.md)\>

***

### reset()?

> `optional` **reset**(): `Promise`\<`void`\>

Optional: reset internal state (useful in tests or at midnight rollover).

#### Returns

`Promise`\<`void`\>

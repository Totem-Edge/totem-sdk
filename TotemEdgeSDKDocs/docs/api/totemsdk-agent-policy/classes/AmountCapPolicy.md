[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / AmountCapPolicy

# Class: AmountCapPolicy

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

> **new AmountCapPolicy**(`config`): `AmountCapPolicy`

#### Parameters

##### config

[`AmountCapConfig`](../interfaces/AmountCapConfig.md)

#### Returns

`AmountCapPolicy`

## Methods

### commit()

> **commit**(`operationId`): `Promise`\<`void`\>

Commit a prior reservation after execution succeeds.

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`commit`](../interfaces/PolicyMiddleware.md#commit)

***

### evaluate()

> **evaluate**(`proposal`, `now?`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

##### now?

`number` = `...`

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`evaluate`](../interfaces/PolicyMiddleware.md#evaluate)

***

### release()

> **release**(`operationId`): `Promise`\<`void`\>

Release a reservation. Monotonic: only `reserved → released` is allowed;
releasing a `committed` operation is a no-op so committed quota can never
be recycled by a later reservation under the same operation ID.

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`release`](../interfaces/PolicyMiddleware.md#release)

***

### reserve()

> **reserve**(`proposal`, `now?`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Reserve state for execution using `proposal.id` as the idempotency key.
Implementations must not consume committed quota during evaluation.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

##### now?

`number` = `...`

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`reserve`](../interfaces/PolicyMiddleware.md#reserve)

***

### reset()

> **reset**(): `Promise`\<`void`\>

Optional: reset internal state (useful in tests or at midnight rollover).

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`reset`](../interfaces/PolicyMiddleware.md#reset)

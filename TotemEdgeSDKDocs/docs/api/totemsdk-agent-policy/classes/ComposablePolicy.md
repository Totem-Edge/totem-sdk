[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / ComposablePolicy

# Class: ComposablePolicy

ComposablePolicy chains multiple PolicyMiddleware layers into a single
evaluation pipeline. Layers are evaluated in registration order with
short-circuit semantics: if any layer returns `rejected`, subsequent
layers are skipped and the rejection is returned immediately.

ComposablePolicy also implements the legacy `AgentPolicy` interface
(`canAutoApprove` / `requiresUserApproval`) so it can be used anywhere
the old interface is expected (e.g. `@totemsdk/omnia`'s `executeIntent`).

## Middleware contract

- `approved`       → continue to next layer
- `rejected`       → short-circuit, return rejection
- `requires_human` → short-circuit, return requires_human

An empty middleware list approves all proposals (pass-through).

## Implements

- [`AgentPolicy`](../interfaces/AgentPolicy.md)
- [`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)

## Constructors

### Constructor

> **new ComposablePolicy**(`layers`): `ComposablePolicy`

#### Parameters

##### layers

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md)[]

#### Returns

`ComposablePolicy`

## Methods

### canAutoApprove()

> **canAutoApprove**(`proposal`): `Promise`\<`boolean`\>

Return true if the wallet should sign the intent without user interaction.
Implementations typically check risk, amount thresholds, and known agents.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`AgentPolicy`](../interfaces/AgentPolicy.md).[`canAutoApprove`](../interfaces/AgentPolicy.md#canautoapprove)

***

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

> **evaluate**(`proposal`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Evaluate a proposal. Called in sequence by ComposablePolicy.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

#### Returns

`Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`evaluate`](../interfaces/PolicyMiddleware.md#evaluate)

***

### release()

> **release**(`operationId`): `Promise`\<`void`\>

Release a prior reservation after execution fails or is cancelled.

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PolicyMiddleware`](../interfaces/PolicyMiddleware.md).[`release`](../interfaces/PolicyMiddleware.md#release)

***

### requiresUserApproval()

> **requiresUserApproval**(`proposal`): `Promise`\<`boolean`\>

Return true if the wallet must show a user-approval UI before signing.
Generally the complement of canAutoApprove, but may have independent logic
(e.g. always require approval for settlements regardless of risk).

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`AgentPolicy`](../interfaces/AgentPolicy.md).[`requiresUserApproval`](../interfaces/AgentPolicy.md#requiresuserapproval)

***

### reserve()

> **reserve**(`proposal`): `Promise`\<[`PolicyEvalResult`](../interfaces/PolicyEvalResult.md)\>

Optional reservation lifecycle for stateful policies.

The execution boundary calls `reserve` before executing, then `commit`
after a successful execution or `release` on any failure path. When
implemented, quota is only consumed through reserve/commit — a read-only
`evaluate` / `canAutoApprove` never touches the limits.

#### Parameters

##### proposal

[`AgentProposal`](../interfaces/AgentProposal.md)

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

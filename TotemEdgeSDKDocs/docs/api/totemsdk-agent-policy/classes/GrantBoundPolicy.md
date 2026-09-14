[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / GrantBoundPolicy

# Class: GrantBoundPolicy

## Constructors

### Constructor

> **new GrantBoundPolicy**(`options`): `GrantBoundPolicy`

#### Parameters

##### options

[`GrantBoundPolicyOptions`](../interfaces/GrantBoundPolicyOptions.md)

#### Returns

`GrantBoundPolicy`

## Methods

### abortStep()

> **abortStep**(`reservationId`, `reason`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### authorizeStep()

> **authorizeStep**(`run`, `step`, `now?`): `Promise`\<[`AuthorizeStepResult`](../interfaces/AuthorizeStepResult.md)\>

Evaluate and reserve a step atomically:
 1. resolve applicable mandates;
 2. verify scope, constraints, expiry and revocation;
 3. check remaining count/amount/window budget;
 4. apply local bounds (tighten, never broaden);
 5. reserve mandate usage + local quotas atomically;
 6. return the full decision + reservation.

#### Parameters

##### run

[`AutonomousRun`](../interfaces/AutonomousRun.md)

##### step

[`AgentStep`](../interfaces/AgentStep.md)

##### now?

`number` = `...`

#### Returns

`Promise`\<[`AuthorizeStepResult`](../interfaces/AuthorizeStepResult.md)\>

***

### commitStep()

> **commitStep**(`reservationId`, `executionProof?`): `Promise`\<`void`\>

#### Parameters

##### reservationId

`string`

##### executionProof?

`unknown`

#### Returns

`Promise`\<`void`\>

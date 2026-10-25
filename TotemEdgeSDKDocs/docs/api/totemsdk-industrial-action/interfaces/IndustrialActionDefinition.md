[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / IndustrialActionDefinition

# Interface: IndustrialActionDefinition\<TResult\>

An industrial action definition that compiles to an edge
`EdgeActionDefinition` via [toEdgeActionDefinition](../functions/toEdgeActionDefinition.md).

## Type Parameters

### TResult

`TResult` = `unknown`

## Properties

### capability

> **capability**: `EdgeCapability`

Runtime capability the action requires (support check, not authorization).

***

### description

> **description**: `string`

***

### effect

> **effect**: `EdgeActionEffect`

Effect class — device writes are `'write'`.

***

### errorTaxonomy?

> `optional` **errorTaxonomy?**: [`DeviceErrorTaxonomy`](DeviceErrorTaxonomy.md)

Device error taxonomy for retry/safety classification (RFC-011 §4.7).

***

### fallback?

> `optional` **fallback?**: (`op`) => `Promise`\<`EdgeOperationResult`\<`TResult`\>\>

Fallback/redundant path used by `fail-operational`.

#### Parameters

##### op

[`PreparedDeviceOp`](PreparedDeviceOp.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`TResult`\>\>

***

### guardrails?

> `optional` **guardrails?**: [`Condition`](Condition.md)[]

Pre-execution guardrails evaluated before authorization.

***

### kind

> **kind**: `string`

***

### policy?

> `optional` **policy?**: [`ExecutionPolicy`](ExecutionPolicy.md)

Timeout / retry / rollback / failure-mode policy.

***

### protocol?

> `optional` **protocol?**: `string`

Field protocol (error classification / wire units; RFC-011 §4.7).

***

### safeState?

> `optional` **safeState?**: (`op`) => `Promise`\<`EdgeOperationResult`\<`unknown`\>\>

Command the resource's safe state (required for `fail-safe`).

#### Parameters

##### op

[`PreparedDeviceOp`](PreparedDeviceOp.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>\>

***

### schema

> **schema**: [`ActionSchema`](ActionSchema.md)

Parameter + context schema, validated before authorization.

***

### version?

> `optional` **version?**: `number`

Monotonic definition version (default 1; RFC-011 §4.5).

## Methods

### actuate()

> **actuate**(`op`): `Promise`\<`EdgeOperationResult`\<`TResult`\>\>

Actuate the device through the edge port.

#### Parameters

##### op

[`PreparedDeviceOp`](PreparedDeviceOp.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`TResult`\>\>

***

### deriveEffects()

> **deriveEffects**(`op`): `StepEffects`

Canonical safety facts derived from the PREPARED operation.

#### Parameters

##### op

[`PreparedDeviceOp`](PreparedDeviceOp.md)

#### Returns

`StepEffects`

***

### prepare()

> **prepare**(`params`, `context`): `Promise`\<[`DeviceOpBase`](DeviceOpBase.md)\>

Build the real device operation from validated inputs.

#### Parameters

##### params

`Record`\<`string`, `unknown`\>

##### context

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<[`DeviceOpBase`](DeviceOpBase.md)\>

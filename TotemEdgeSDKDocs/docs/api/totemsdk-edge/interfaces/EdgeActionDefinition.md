[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeActionDefinition

# Interface: EdgeActionDefinition

## Properties

### capability

> **capability**: [`EdgeCapability`](../type-aliases/EdgeCapability.md)

Runtime capability the action requires (support check, not authorization).

***

### effect

> **effect**: [`EdgeActionEffect`](../type-aliases/EdgeActionEffect.md)

Effect class — used for capability gating and audit.

## Methods

### classifyFailure()?

> `optional` **classifyFailure**(`error`, `prepared`): `"definitely-not-executed"` \| `"unknown"`

RFC-019 P1: classify an execution failure. Return `'definitely-not-executed'`
only when the operation provably did not take effect (the reservation may be
released — this is the default for non-dispatching port actions); return
`'unknown'` for ambiguous post-dispatch outcomes, where the reservation is
held for reconciliation rather than released.

#### Parameters

##### error

`unknown`

##### prepared

`unknown`

#### Returns

`"definitely-not-executed"` \| `"unknown"`

***

### deriveEffects()

> **deriveEffects**(`prepared`): `StepEffects`

Extract canonical security facts from the PREPARED operation.

#### Parameters

##### prepared

`unknown`

#### Returns

`StepEffects`

***

### execute()

> **execute**(`prepared`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<`unknown`\>\>

Execute the prepared operation through the private port.

#### Parameters

##### prepared

`unknown`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<`unknown`\>\>

***

### prepare()

> **prepare**(`input`): `unknown`

Build the real operation from the request (wallet builds/simulates first).

#### Parameters

##### input

[`EdgeActionInput`](EdgeActionInput.md)

#### Returns

`unknown`

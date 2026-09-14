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

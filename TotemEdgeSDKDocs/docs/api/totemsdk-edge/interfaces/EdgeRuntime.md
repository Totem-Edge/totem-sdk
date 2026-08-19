[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeRuntime

# Interface: EdgeRuntime

## Properties

### capabilities

> **capabilities**: [`EdgeCapabilitySet`](../type-aliases/EdgeCapabilitySet.md)

***

### deviceId

> **deviceId**: `string`

***

### ports

> **ports**: [`EdgeRuntimePorts`](EdgeRuntimePorts.md)

***

### version

> **version**: `number`

## Methods

### assertCapability()

> **assertCapability**(`cap`): `void`

#### Parameters

##### cap

[`EdgeCapability`](../type-aliases/EdgeCapability.md)

#### Returns

`void`

***

### executeAction()

> **executeAction**(`params`): `Promise`\<`EdgeActionResult`\>

Execute an action through the runtime.

If a policy port is configured, the action is first checked against it.
If the policy rejects the action, execution is blocked and the rejection
reason is returned.

The action string determines which port handles execution:
  - 'payment:*'        → EdgePaymentPort.pay()
  - 'lookup:*'         → EdgeLookupPort.query() / announce()
  - 'proof:*'          → EdgeProofPort.createProof() / verifyProof()

Unknown action strings return an error without attempting execution.

#### Parameters

##### params

`EdgeActionParams`

#### Returns

`Promise`\<`EdgeActionResult`\>

***

### hasCapability()

> **hasCapability**(`cap`): `boolean`

#### Parameters

##### cap

[`EdgeCapability`](../type-aliases/EdgeCapability.md)

#### Returns

`boolean`

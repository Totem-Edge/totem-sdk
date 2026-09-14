[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / AgentEdgeRuntime

# Interface: AgentEdgeRuntime

## Properties

### deviceId

> `readonly` **deviceId**: `string`

***

### version

> `readonly` **version**: `number`

## Methods

### executeAction()

> **executeAction**(`input`): `Promise`\<`EdgeActionResult`\>

Execute a single governed action. The agent has no other entry point.

#### Parameters

##### input

[`EdgeActionInput`](EdgeActionInput.md)

#### Returns

`Promise`\<`EdgeActionResult`\>

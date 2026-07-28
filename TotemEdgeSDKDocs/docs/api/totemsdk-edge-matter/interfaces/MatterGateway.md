[**@totemsdk/edge-matter**](../index.md)

***

[@totemsdk/edge-matter](../index.md) / MatterGateway

# Interface: MatterGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### commission()

> **commission**(`discriminator`, `setupCode`): `Promise`\<`EdgeOperationResult`\<\{ `node`: [`MatterNode`](MatterNode.md); \}\>\>

Commission a device onto the fabric.

#### Parameters

##### discriminator

`number`

##### setupCode

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `node`: [`MatterNode`](MatterNode.md); \}\>\>

***

### invokeCommand()

> **invokeCommand**(`nodeId`, `endpointId`, `clusterId`, `commandId`, `args`): `Promise`\<`EdgeOperationResult`\<\{ `result`: `unknown`; \}\>\>

Invoke a command on a node.

#### Parameters

##### nodeId

`string`

##### endpointId

`number`

##### clusterId

`number`

##### commandId

`number`

##### args

`unknown`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `result`: `unknown`; \}\>\>

***

### readAttribute()

> **readAttribute**(`nodeId`, `endpointId`, `clusterId`, `attributeId`): `Promise`\<`EdgeOperationResult`\<\{ `value`: [`MatterAttributeValue`](MatterAttributeValue.md); \}\>\>

Read an attribute from a node.

#### Parameters

##### nodeId

`string`

##### endpointId

`number`

##### clusterId

`number`

##### attributeId

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `value`: [`MatterAttributeValue`](MatterAttributeValue.md); \}\>\>

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### writeAttribute()

> **writeAttribute**(`nodeId`, `endpointId`, `clusterId`, `attributeId`, `value`): `Promise`\<`EdgeOperationResult`\>

Write an attribute to a node.

#### Parameters

##### nodeId

`string`

##### endpointId

`number`

##### clusterId

`number`

##### attributeId

`number`

##### value

`unknown`

#### Returns

`Promise`\<`EdgeOperationResult`\>

[**@totemsdk/edge-opcua**](../index.md)

***

[@totemsdk/edge-opcua](../index.md) / OpcuaGateway

# Interface: OpcuaGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### browse()

> **browse**(`nodeId`): `Promise`\<`EdgeOperationResult`\<\{ `nodes`: [`OpcuaNode`](OpcuaNode.md)[]; \}\>\>

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `nodes`: [`OpcuaNode`](OpcuaNode.md)[]; \}\>\>

***

### call()

> **call**(`objectId`, `methodId`, `args`): `Promise`\<`EdgeOperationResult`\<\{ `results`: [`OpcuaValue`](OpcuaValue.md)[]; \}\>\>

#### Parameters

##### objectId

`string`

##### methodId

`string`

##### args

[`OpcuaValue`](OpcuaValue.md)[]

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `results`: [`OpcuaValue`](OpcuaValue.md)[]; \}\>\>

***

### read()

> **read**(`nodeId`): `Promise`\<`EdgeOperationResult`\<\{ `value`: [`OpcuaValue`](OpcuaValue.md); \}\>\>

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `value`: [`OpcuaValue`](OpcuaValue.md); \}\>\>

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

### write()

> **write**(`nodeId`, `value`): `Promise`\<`EdgeOperationResult`\<`unknown`\>\>

#### Parameters

##### nodeId

`string`

##### value

[`OpcuaValue`](OpcuaValue.md)

#### Returns

`Promise`\<`EdgeOperationResult`\<`unknown`\>\>

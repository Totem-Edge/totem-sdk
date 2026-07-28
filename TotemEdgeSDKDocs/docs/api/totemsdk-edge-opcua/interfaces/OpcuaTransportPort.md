[**@totemsdk/edge-opcua**](../index.md)

***

[@totemsdk/edge-opcua](../index.md) / OpcuaTransportPort

# Interface: OpcuaTransportPort

OPC-UA transport port — injected by the caller.

OPC-UA (IEC 62541) is a binary protocol for industrial automation.
Supports secure channels, sessions, node browsing, subscriptions,
and method calls. The caller provides the OPC-UA stack.

## Methods

### browse()

> **browse**(`nodeId`): `Promise`\<[`OpcuaNode`](OpcuaNode.md)[]\>

Browse the server's address space.

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<[`OpcuaNode`](OpcuaNode.md)[]\>

***

### call()

> **call**(`objectId`, `methodId`, `args`): `Promise`\<[`OpcuaValue`](OpcuaValue.md)[]\>

Call a method on an object node.

#### Parameters

##### objectId

`string`

##### methodId

`string`

##### args

[`OpcuaValue`](OpcuaValue.md)[]

#### Returns

`Promise`\<[`OpcuaValue`](OpcuaValue.md)[]\>

***

### connect()

> **connect**(`endpointUrl`): `Promise`\<`void`\>

Connect to an OPC-UA server endpoint.

#### Parameters

##### endpointUrl

`string`

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Disconnect and close the session.

#### Returns

`Promise`\<`void`\>

***

### onError()

> **onError**(`handler`): () => `void`

Register handler for session errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### read()

> **read**(`nodeId`): `Promise`\<[`OpcuaValue`](OpcuaValue.md)\>

Read the value of a node.

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<[`OpcuaValue`](OpcuaValue.md)\>

***

### subscribe()

> **subscribe**(`nodeIds`, `samplingInterval`): `Promise`\<[`OpcuaSubscription`](OpcuaSubscription.md)\>

Create a monitored item subscription.

#### Parameters

##### nodeIds

`string`[]

##### samplingInterval

`number`

#### Returns

`Promise`\<[`OpcuaSubscription`](OpcuaSubscription.md)\>

***

### write()

> **write**(`nodeId`, `value`): `Promise`\<`void`\>

Write a value to a node.

#### Parameters

##### nodeId

`string`

##### value

[`OpcuaValue`](OpcuaValue.md)

#### Returns

`Promise`\<`void`\>

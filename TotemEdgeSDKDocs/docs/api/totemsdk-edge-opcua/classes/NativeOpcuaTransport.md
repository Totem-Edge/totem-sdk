[**@totemsdk/edge-opcua**](../index.md)

***

[@totemsdk/edge-opcua](../index.md) / NativeOpcuaTransport

# Class: NativeOpcuaTransport

OPC-UA transport port — injected by the caller.

OPC-UA (IEC 62541) is a binary protocol for industrial automation.
Supports secure channels, sessions, node browsing, subscriptions,
and method calls. The caller provides the OPC-UA stack.

## Implements

- [`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md)

## Constructors

### Constructor

> **new NativeOpcuaTransport**(`config?`): `NativeOpcuaTransport`

#### Parameters

##### config?

[`NativeOpcuaConfig`](../interfaces/NativeOpcuaConfig.md) = `{}`

#### Returns

`NativeOpcuaTransport`

## Methods

### browse()

> **browse**(`nodeId`): `Promise`\<[`OpcuaNode`](../interfaces/OpcuaNode.md)[]\>

Browse the server's address space.

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<[`OpcuaNode`](../interfaces/OpcuaNode.md)[]\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`browse`](../interfaces/OpcuaTransportPort.md#browse)

***

### call()

> **call**(`objectId`, `methodId`, `args`): `Promise`\<[`OpcuaValue`](../interfaces/OpcuaValue.md)[]\>

Call a method on an object node.

#### Parameters

##### objectId

`string`

##### methodId

`string`

##### args

[`OpcuaValue`](../interfaces/OpcuaValue.md)[]

#### Returns

`Promise`\<[`OpcuaValue`](../interfaces/OpcuaValue.md)[]\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`call`](../interfaces/OpcuaTransportPort.md#call)

***

### connect()

> **connect**(`endpointUrl`): `Promise`\<`void`\>

Connect to an OPC-UA server endpoint.

#### Parameters

##### endpointUrl

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`connect`](../interfaces/OpcuaTransportPort.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Disconnect and close the session.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`disconnect`](../interfaces/OpcuaTransportPort.md#disconnect)

***

### onError()

> **onError**(`handler`): () => `void`

Register handler for session errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`onError`](../interfaces/OpcuaTransportPort.md#onerror)

***

### read()

> **read**(`nodeId`): `Promise`\<[`OpcuaValue`](../interfaces/OpcuaValue.md)\>

Read the value of a node.

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<[`OpcuaValue`](../interfaces/OpcuaValue.md)\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`read`](../interfaces/OpcuaTransportPort.md#read)

***

### subscribe()

> **subscribe**(`nodeIds`, `samplingInterval`): `Promise`\<[`OpcuaSubscription`](../interfaces/OpcuaSubscription.md)\>

Create a monitored item subscription.

#### Parameters

##### nodeIds

`string`[]

##### samplingInterval

`number`

#### Returns

`Promise`\<[`OpcuaSubscription`](../interfaces/OpcuaSubscription.md)\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`subscribe`](../interfaces/OpcuaTransportPort.md#subscribe)

***

### write()

> **write**(`nodeId`, `value`): `Promise`\<`void`\>

Write a value to a node.

#### Parameters

##### nodeId

`string`

##### value

[`OpcuaValue`](../interfaces/OpcuaValue.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`OpcuaTransportPort`](../interfaces/OpcuaTransportPort.md).[`write`](../interfaces/OpcuaTransportPort.md#write)

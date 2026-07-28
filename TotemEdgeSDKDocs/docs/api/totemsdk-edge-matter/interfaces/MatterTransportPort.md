[**@totemsdk/edge-matter**](../index.md)

***

[@totemsdk/edge-matter](../index.md) / MatterTransportPort

# Interface: MatterTransportPort

Matter transport port — injected by the caller.

Matter (formerly Project CHIP) is a smart home standard supporting
BLE, WiFi, and Thread transports. The caller provides the Matter SDK.

## Methods

### commission()

> **commission**(`device`, `setupCode`): `Promise`\<[`MatterNode`](MatterNode.md)\>

Commission a device onto the fabric.

#### Parameters

##### device

[`MatterCommissionableDevice`](MatterCommissionableDevice.md)

##### setupCode

`string`

#### Returns

`Promise`\<[`MatterNode`](MatterNode.md)\>

***

### decommission()

> **decommission**(`nodeId`): `Promise`\<`void`\>

Remove a device from the fabric.

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<`void`\>

***

### init()

> **init**(`vendorId`, `productId`): `Promise`\<`void`\>

Initialise the Matter stack.

#### Parameters

##### vendorId

`number`

##### productId

`number`

#### Returns

`Promise`\<`void`\>

***

### invokeCommand()

> **invokeCommand**(`nodeId`, `endpointId`, `clusterId`, `commandId`, `args`): `Promise`\<`unknown`\>

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

`Promise`\<`unknown`\>

***

### onCommissioned()

> **onCommissioned**(`handler`): () => `void`

Register handler for commissioning events.

#### Parameters

##### handler

(`node`) => `void`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

Register handler for errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### readAttribute()

> **readAttribute**(`nodeId`, `endpointId`, `clusterId`, `attributeId`): `Promise`\<[`MatterAttributeValue`](MatterAttributeValue.md)\>

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

`Promise`\<[`MatterAttributeValue`](MatterAttributeValue.md)\>

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Shutdown the Matter stack.

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`nodeId`, `endpointId`, `clusterId`, `attributeIds`, `minInterval`, `maxInterval`): `Promise`\<[`MatterSubscription`](MatterSubscription.md)\>

Subscribe to attribute changes.

#### Parameters

##### nodeId

`string`

##### endpointId

`number`

##### clusterId

`number`

##### attributeIds

`number`[]

##### minInterval

`number`

##### maxInterval

`number`

#### Returns

`Promise`\<[`MatterSubscription`](MatterSubscription.md)\>

***

### writeAttribute()

> **writeAttribute**(`nodeId`, `endpointId`, `clusterId`, `attributeId`, `value`): `Promise`\<`void`\>

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

`Promise`\<`void`\>

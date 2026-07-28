[**@totemsdk/edge-bacnet**](../index.md)

***

[@totemsdk/edge-bacnet](../index.md) / BacnetTransportPort

# Interface: BacnetTransportPort

BACnet transport port — injected by the caller.

BACnet (ASHRAE 135) is a building automation protocol.
Supports BACnet/IP (UDP 47808) and BACnet/MSTP (RS-485).
The caller provides the BACnet stack.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Shutdown the BACnet stack.

#### Returns

`Promise`\<`void`\>

***

### discoverDevices()

> **discoverDevices**(): `Promise`\<[`BacnetDevice`](BacnetDevice.md)[]\>

Discover devices on the network (Who-Is).

#### Returns

`Promise`\<[`BacnetDevice`](BacnetDevice.md)[]\>

***

### init()

> **init**(`deviceId`, `deviceName`): `Promise`\<`void`\>

Initialise the BACnet stack.

#### Parameters

##### deviceId

`number`

##### deviceName

`string`

#### Returns

`Promise`\<`void`\>

***

### onDeviceDiscovered()

> **onDeviceDiscovered**(`handler`): () => `void`

Register handler for I-Am responses.

#### Parameters

##### handler

(`device`) => `void`

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

### readProperty()

> **readProperty**(`deviceId`, `objectType`, `objectInstance`, `propertyId`): `Promise`\<[`BacnetPropertyValue`](BacnetPropertyValue.md)\>

Read a property from a remote device.

#### Parameters

##### deviceId

`number`

##### objectType

`string`

##### objectInstance

`number`

##### propertyId

`number`

#### Returns

`Promise`\<[`BacnetPropertyValue`](BacnetPropertyValue.md)\>

***

### subscribeCov()

> **subscribeCov**(`deviceId`, `objectType`, `objectInstance`, `lifetime?`): `Promise`\<[`BacnetSubscription`](BacnetSubscription.md)\>

Subscribe to COV (Change of Value) notifications.

#### Parameters

##### deviceId

`number`

##### objectType

`string`

##### objectInstance

`number`

##### lifetime?

`number`

#### Returns

`Promise`\<[`BacnetSubscription`](BacnetSubscription.md)\>

***

### writeProperty()

> **writeProperty**(`deviceId`, `objectType`, `objectInstance`, `propertyId`, `value`, `priority?`): `Promise`\<`void`\>

Write a property to a remote device.

#### Parameters

##### deviceId

`number`

##### objectType

`string`

##### objectInstance

`number`

##### propertyId

`number`

##### value

`unknown`

##### priority?

`number`

#### Returns

`Promise`\<`void`\>

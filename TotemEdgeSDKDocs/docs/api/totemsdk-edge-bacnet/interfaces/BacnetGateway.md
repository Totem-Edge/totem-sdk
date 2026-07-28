[**@totemsdk/edge-bacnet**](../index.md)

***

[@totemsdk/edge-bacnet](../index.md) / BacnetGateway

# Interface: BacnetGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### discoverDevices()

> **discoverDevices**(): `Promise`\<`EdgeOperationResult`\<\{ `devices`: [`BacnetDevice`](BacnetDevice.md)[]; \}\>\>

Discover devices on the network.

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `devices`: [`BacnetDevice`](BacnetDevice.md)[]; \}\>\>

***

### readProperty()

> **readProperty**(`deviceId`, `objectType`, `objectInstance`, `propertyId`): `Promise`\<`EdgeOperationResult`\<\{ `value`: [`BacnetPropertyValue`](BacnetPropertyValue.md); \}\>\>

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

`Promise`\<`EdgeOperationResult`\<\{ `value`: [`BacnetPropertyValue`](BacnetPropertyValue.md); \}\>\>

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

### writeProperty()

> **writeProperty**(`deviceId`, `objectType`, `objectInstance`, `propertyId`, `value`, `priority?`): `Promise`\<`EdgeOperationResult`\>

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

`Promise`\<`EdgeOperationResult`\>

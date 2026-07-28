[**@totemsdk/edge-ble**](../index.md)

***

[@totemsdk/edge-ble](../index.md) / BleTransportPort

# Interface: BleTransportPort

BLE transport port — injected by the caller.

Platform-agnostic BLE interface. Works with noble (Node.js),
Web Bluetooth API (browser), or platform-native stacks.

## Methods

### connect()

> **connect**(`peripheralId`): `Promise`\<`void`\>

Connect to a peripheral by ID or address.

#### Parameters

##### peripheralId

`string`

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(`peripheralId`): `Promise`\<`void`\>

Disconnect from a peripheral.

#### Parameters

##### peripheralId

`string`

#### Returns

`Promise`\<`void`\>

***

### discover()

> **discover**(`peripheralId`): `Promise`\<[`BleService`](BleService.md)[]\>

Discover services and characteristics.

#### Parameters

##### peripheralId

`string`

#### Returns

`Promise`\<[`BleService`](BleService.md)[]\>

***

### onDisconnect()

> **onDisconnect**(`handler`): () => `void`

Register handler for disconnection.

#### Parameters

##### handler

(`peripheralId`) => `void`

#### Returns

() => `void`

***

### onDiscover()

> **onDiscover**(`handler`): () => `void`

Register handler for discovered peripherals.

#### Parameters

##### handler

(`peripheral`) => `void`

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

### onNotification()

> **onNotification**(`handler`): () => `void`

Register handler for characteristic notifications.

#### Parameters

##### handler

(`event`) => `void`

#### Returns

() => `void`

***

### read()

> **read**(`peripheralId`, `serviceUuid`, `characteristicUuid`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Read a characteristic value.

#### Parameters

##### peripheralId

`string`

##### serviceUuid

`string`

##### characteristicUuid

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### startScanning()

> **startScanning**(`serviceUUIDs?`): `Promise`\<`void`\>

Start scanning for peripherals.

#### Parameters

##### serviceUUIDs?

`string`[]

#### Returns

`Promise`\<`void`\>

***

### stopScanning()

> **stopScanning**(): `Promise`\<`void`\>

Stop scanning.

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`peripheralId`, `serviceUuid`, `characteristicUuid`): `Promise`\<`void`\>

Subscribe to characteristic notifications.

#### Parameters

##### peripheralId

`string`

##### serviceUuid

`string`

##### characteristicUuid

`string`

#### Returns

`Promise`\<`void`\>

***

### unsubscribe()

> **unsubscribe**(`peripheralId`, `serviceUuid`, `characteristicUuid`): `Promise`\<`void`\>

Unsubscribe from characteristic notifications.

#### Parameters

##### peripheralId

`string`

##### serviceUuid

`string`

##### characteristicUuid

`string`

#### Returns

`Promise`\<`void`\>

***

### write()

> **write**(`peripheralId`, `serviceUuid`, `characteristicUuid`, `data`): `Promise`\<`void`\>

Write a characteristic value.

#### Parameters

##### peripheralId

`string`

##### serviceUuid

`string`

##### characteristicUuid

`string`

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

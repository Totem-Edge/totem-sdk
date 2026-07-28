[**@totemsdk/edge-ble**](../index.md)

***

[@totemsdk/edge-ble](../index.md) / BleGateway

# Interface: BleGateway

## Properties

### peripherals

> `readonly` **peripherals**: [`BlePeripheral`](BlePeripheral.md)[]

Discovered peripherals.

***

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### connect()

> **connect**(`peripheralId`): `Promise`\<`void`\>

Connect to a peripheral.

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

### read()

> **read**(`peripheralId`, `serviceUuid`, `characteristicUuid`): `Promise`\<`EdgeOperationResult`\<\{ `value`: `Uint8Array`; \}\>\>

Read a characteristic.

#### Parameters

##### peripheralId

`string`

##### serviceUuid

`string`

##### characteristicUuid

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `value`: `Uint8Array`; \}\>\>

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

### subscribe()

> **subscribe**(`peripheralId`, `serviceUuid`, `characteristicUuid`): `Promise`\<`EdgeOperationResult`\>

Subscribe to notifications.

#### Parameters

##### peripheralId

`string`

##### serviceUuid

`string`

##### characteristicUuid

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\>

***

### write()

> **write**(`peripheralId`, `serviceUuid`, `characteristicUuid`, `data`): `Promise`\<`EdgeOperationResult`\>

Write a characteristic.

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

`Promise`\<`EdgeOperationResult`\>

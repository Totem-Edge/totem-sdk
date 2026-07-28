[**@totemsdk/edge-modbus**](../index.md)

***

[@totemsdk/edge-modbus](../index.md) / ModbusGateway

# Interface: ModbusGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### readCoils()

> **readCoils**(`unitId`, `address`, `count`): `Promise`\<`EdgeOperationResult`\<\{ `values`: `boolean`[]; \}\>\>

Read coils (function code 1).

#### Parameters

##### unitId

`number`

##### address

`number`

##### count

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `values`: `boolean`[]; \}\>\>

***

### readRegisters()

> **readRegisters**(`unitId`, `address`, `count`): `Promise`\<`EdgeOperationResult`\<\{ `values`: `number`[]; \}\>\>

Read holding registers (function code 3).

#### Parameters

##### unitId

`number`

##### address

`number`

##### count

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<\{ `values`: `number`[]; \}\>\>

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

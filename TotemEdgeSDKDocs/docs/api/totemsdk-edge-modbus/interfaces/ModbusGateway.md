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

### readDiscreteInputs()

> **readDiscreteInputs**(`unitId`, `address`, `count`): `Promise`\<`EdgeOperationResult`\<\{ `values`: `boolean`[]; \}\>\>

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

### readHoldingRegisters()

> **readHoldingRegisters**(`unitId`, `address`, `count`): `Promise`\<`EdgeOperationResult`\<\{ `values`: `number`[]; \}\>\>

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

### readInputRegisters()

> **readInputRegisters**(`unitId`, `address`, `count`): `Promise`\<`EdgeOperationResult`\<\{ `values`: `number`[]; \}\>\>

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

***

### writeMultipleCoils()

> **writeMultipleCoils**(`unitId`, `address`, `values`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### unitId

`number`

##### address

`number`

##### values

`boolean`[]

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### writeMultipleRegisters()

> **writeMultipleRegisters**(`unitId`, `address`, `values`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### unitId

`number`

##### address

`number`

##### values

`number`[]

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### writeSingleCoil()

> **writeSingleCoil**(`unitId`, `address`, `value`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### unitId

`number`

##### address

`number`

##### value

`boolean`

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

***

### writeSingleRegister()

> **writeSingleRegister**(`unitId`, `address`, `value`): `Promise`\<`EdgeOperationResult`\<`void`\>\>

#### Parameters

##### unitId

`number`

##### address

`number`

##### value

`number`

#### Returns

`Promise`\<`EdgeOperationResult`\<`void`\>\>

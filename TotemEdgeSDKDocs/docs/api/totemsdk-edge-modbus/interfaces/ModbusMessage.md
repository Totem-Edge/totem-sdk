[**@totemsdk/edge-modbus**](../index.md)

***

[@totemsdk/edge-modbus](../index.md) / ModbusMessage

# Interface: ModbusMessage

## Properties

### address

> **address**: `number`

Starting address (0-based).

***

### functionCode

> **functionCode**: `number`

Modbus function code (1-6, 15, 16).

***

### raw

> **raw**: `Uint8Array`

Raw frame bytes.

***

### receivedAt

> **receivedAt**: `number`

Timestamp of receipt.

***

### unitId

> **unitId**: `number`

Unit/slave ID (1-247).

***

### value

> **value**: `number` \| `number`[]

Register/coil count or value.

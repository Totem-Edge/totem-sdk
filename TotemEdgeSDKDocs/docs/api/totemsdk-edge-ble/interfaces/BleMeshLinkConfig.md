[**@totemsdk/edge-ble**](../index.md)

***

[@totemsdk/edge-ble](../index.md) / BleMeshLinkConfig

# Interface: BleMeshLinkConfig

## Properties

### mtu?

> `optional` **mtu?**: `number`

ATT MTU. Defaults to 185, the usual negotiated value.

***

### peripheralId

> **peripheralId**: `string`

***

### rxCharacteristicUuid

> **rxCharacteristicUuid**: `string`

Characteristic the peer reads; packets are written here.

***

### serviceUuid

> **serviceUuid**: `string`

***

### transport

> **transport**: [`BleTransportPort`](BleTransportPort.md)

***

### txCharacteristicUuid

> **txCharacteristicUuid**: `string`

Characteristic we subscribe to; packets arrive here.

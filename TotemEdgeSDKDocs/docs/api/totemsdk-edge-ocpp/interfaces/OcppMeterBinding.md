[**@totemsdk/edge-ocpp**](../index.md)

***

[@totemsdk/edge-ocpp](../index.md) / OcppMeterBinding

# Interface: OcppMeterBinding

## Properties

### connectorId

> **connectorId**: `number`

***

### intervalMs

> **intervalMs**: `number`

***

### read

> **read**: () => `Promise`\<[`OcppMeterSample`](OcppMeterSample.md)[]\>

Read the current sample(s) for this connector.

#### Returns

`Promise`\<[`OcppMeterSample`](OcppMeterSample.md)[]\>

***

### sensorId

> **sensorId**: `string`

[**@totemsdk/edge-mavlink**](../index.md)

***

[@totemsdk/edge-mavlink](../index.md) / MavlinkSensorBinding

# Interface: MavlinkSensorBinding

## Properties

### dataType?

> `optional` **dataType?**: `string`

***

### extract?

> `optional` **extract?**: (`message`) => `unknown`

Optional extractor; defaults to the decoded payload.

#### Parameters

##### message

[`MavlinkMessage`](MavlinkMessage.md)

#### Returns

`unknown`

***

### messageId

> **messageId**: `number`

***

### sensorId

> **sensorId**: `string`

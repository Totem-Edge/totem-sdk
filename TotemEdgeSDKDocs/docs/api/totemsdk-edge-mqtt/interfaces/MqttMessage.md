[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttMessage

# Interface: MqttMessage

MqttClientPort — transport-agnostic MQTT port interface.

This package does NOT import mqtt.js, net, tls, ws, http, fs, or browser APIs.
All network behavior is injected via MqttClientPort.

## Properties

### payload

> **payload**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

***

### properties?

> `optional` **properties?**: `Record`\<`string`, `unknown`\>

***

### qos?

> `optional` **qos?**: `0` \| `1` \| `2`

***

### receivedAt

> **receivedAt**: `number`

***

### retain?

> `optional` **retain?**: `boolean`

***

### topic

> **topic**: `string`

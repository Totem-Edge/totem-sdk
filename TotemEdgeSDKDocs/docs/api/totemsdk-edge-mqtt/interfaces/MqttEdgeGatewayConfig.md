[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttEdgeGatewayConfig

# Interface: MqttEdgeGatewayConfig

## Properties

### client

> **client**: [`MqttClientPort`](MqttClientPort.md)

***

### commandHandler?

> `optional` **commandHandler?**: [`MqttCommandHandler`](MqttCommandHandler.md)

***

### deviceId

> **deviceId**: `string`

***

### identity?

> `optional` **identity?**: `TotemIdentityDocument`

***

### manifest?

> `optional` **manifest?**: `SignedManifest`\<`EdgeServiceManifest`\>

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### proofPublisher?

> `optional` **proofPublisher?**: [`MqttProofPublisher`](MqttProofPublisher.md)

***

### queue?

> `optional` **queue?**: [`MqttEdgeQueue`](MqttEdgeQueue.md)

***

### rules?

> `optional` **rules?**: [`MqttTopicRule`](MqttTopicRule.md)[]

***

### runtime

> **runtime**: `EdgeRuntime`

***

### sensorBridge?

> `optional` **sensorBridge?**: [`MqttSensorBridge`](MqttSensorBridge.md)

***

### topics?

> `optional` **topics?**: `Partial`\<[`MqttTopicSet`](MqttTopicSet.md)\>

***

### transport?

> `optional` **transport?**: [`MqttTransportInfo`](MqttTransportInfo.md)

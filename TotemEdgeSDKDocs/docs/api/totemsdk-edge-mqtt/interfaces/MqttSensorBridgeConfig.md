[**@totemsdk/edge-mqtt**](../index.md)

***

[@totemsdk/edge-mqtt](../index.md) / MqttSensorBridgeConfig

# Interface: MqttSensorBridgeConfig

## Properties

### bindings

> **bindings**: [`MqttSensorBinding`](MqttSensorBinding.md)[]

***

### client?

> `optional` **client?**: [`MqttClientPort`](MqttClientPort.md)

***

### deadLetterQueue?

> `optional` **deadLetterQueue?**: [`MqttEdgeQueue`](MqttEdgeQueue.md)

Queue that receives failed proof events instead of silently dropping them.
When set, any error thrown by proofPublisher.createProofFromMessage or
publishProof is caught and the raw message is enqueued for later retry
or inspection, rather than being lost.

***

### gateway

> **gateway**: [`MqttEdgeGateway`](MqttEdgeGateway.md)

***

### proofPublisher?

> `optional` **proofPublisher?**: [`MqttProofPublisher`](MqttProofPublisher.md)
